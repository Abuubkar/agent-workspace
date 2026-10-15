import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4Message,
  LanguageModelV4StreamPart,
  LanguageModelV4Usage,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { SERVICES } from "@/lib/kb/docs";
import type { SearchHit } from "@/lib/kb/search";
import { notifyChannelApproval } from "./policy";

// A scripted model so the workspace runs, and the evals pass in CI, without
// an API key. It reads the conversation the way a real model would see it
// (user text plus tool results) and decides the next step: call a tool, or
// answer with citations. Set OPENAI_API_KEY to use a real model instead.

type PlannedCall = { toolName: string; input: Record<string, unknown> };
type ToolOutcome = { toolName: string; input: unknown; denied: boolean; reason?: string; value: unknown };

type Decision =
  | { kind: "tool"; call: PlannedCall }
  | { kind: "text"; text: string };

export function lastUserText(prompt: LanguageModelV4Message[]): { text: string; index: number } {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const m = prompt[i];
    if (m.role === "user") {
      const text = m.content.map((p) => (p.type === "text" ? p.text : "")).join(" ");
      return { text, index: i };
    }
  }
  return { text: "", index: -1 };
}

export function outcomesSince(prompt: LanguageModelV4Message[], index: number): ToolOutcome[] {
  const inputs = new Map<string, unknown>();
  const out: ToolOutcome[] = [];
  for (const m of prompt.slice(index + 1)) {
    if (m.role === "assistant") {
      for (const p of m.content) if (p.type === "tool-call") inputs.set(p.toolCallId, p.input);
    }
    if (m.role !== "tool") continue;
    for (const p of m.content) {
      if (p.type !== "tool-result") continue;
      const o = p.output;
      const base = { toolName: p.toolName, input: inputs.get(p.toolCallId) };
      if (o.type === "execution-denied") {
        out.push({ ...base, denied: true, reason: o.reason, value: undefined });
      } else if (o.type === "json" || o.type === "text") {
        out.push({ ...base, denied: false, value: o.value });
      } else {
        out.push({ ...base, denied: false, value: undefined });
      }
    }
  }
  return out;
}

const ANALYZE = /\b(incident|outage|spik\w*|errors?|5xx|analy[sz]e|failing|down|latency|slow)\b/i;
const TICKET = /\bticket\b/i;
const NOTIFY = /\b(notify|post|announce|tell|update)\b|#[a-z0-9-]+/i;

export function planFor(text: string): string[] {
  const steps = ["searchDocs"];
  if (ANALYZE.test(text) && findService(text)) steps.push("analyzeIncidents");
  if (TICKET.test(text)) steps.push("createTicket");
  if (NOTIFY.test(text)) steps.push("notifyChannel");
  return steps;
}

function findService(text: string): string | undefined {
  const lower = text.toLowerCase();
  return SERVICES.find((s) => lower.includes(s));
}

type Analysis = {
  service: string;
  peak: number;
  baseline: number;
  peakHoursAgo: number;
  severity: "P1" | "P2" | "none";
};

export function decide(prompt: LanguageModelV4Message[]): Decision {
  const { text, index } = lastUserText(prompt);
  const outcomes = outcomesSince(prompt, index);
  const done = new Set(outcomes.map((o) => o.toolName));
  const next = planFor(text).find((t) => !done.has(t));

  const search = outcomes.find((o) => o.toolName === "searchDocs")?.value as
    | { hits: SearchHit[] }
    | undefined;
  const analysis = outcomes.find((o) => o.toolName === "analyzeIncidents")?.value as
    | Analysis
    | undefined;
  const ticket = outcomes.find((o) => o.toolName === "createTicket");

  if (next) {
    return { kind: "tool", call: inputFor(next, text, analysis, ticket) };
  }
  return { kind: "text", text: answer(outcomes, search?.hits ?? [], analysis) };
}

function inputFor(
  toolName: string,
  text: string,
  analysis: Analysis | undefined,
  ticket: ToolOutcome | undefined,
): PlannedCall {
  const service = analysis?.service ?? findService(text) ?? "checkout";
  const priority = analysis?.severity === "P1" ? "P1" : "P2";
  switch (toolName) {
    case "searchDocs":
      return { toolName, input: { query: text.slice(0, 160) } };
    case "analyzeIncidents":
      return { toolName, input: { service, hours: 6 } };
    case "createTicket":
      return {
        toolName,
        input: {
          title: `${cap(service)} error spike`,
          priority,
          summary: analysis
            ? `${cap(service)} errors peaked at ${analysis.peak}/h against a baseline of ${analysis.baseline}/h.`
            : `Investigating ${service} errors reported in the workspace.`,
        },
      };
    case "notifyChannel": {
      const channel = text.match(/#[a-z0-9-]+/i)?.[0] ?? "#incidents";
      const id = !ticket || ticket.denied ? undefined : (ticket.value as { ticketId?: string })?.ticketId;
      return {
        toolName,
        input: {
          channel,
          message:
            (analysis && analysis.severity === "none"
              ? `Looking into reports of ${service} issues. Error rates are normal so far (peak ${analysis.peak}/h).`
              : `${cap(service)} errors are elevated` + (analysis ? ` (peak ${analysis.peak}/h).` : ".")) +
            (id ? ` Tracking in ${id}.` : "") +
            " Next update in 30 minutes.",
        },
      };
    }
    default:
      throw new Error(`No plan for ${toolName}`);
  }
}

function answer(outcomes: ToolOutcome[], hits: SearchHit[], analysis: Analysis | undefined): string {
  const lines: string[] = [];
  const retrieved = new Set(hits.map((h) => h.id));

  if (hits.length === 0) {
    lines.push("I couldn't find a runbook that covers this, so I won't guess.");
  } else {
    for (const hit of hits.slice(0, 2)) lines.push(`${hit.snippet} [kb:${hit.id}]`);
  }

  if (analysis) {
    const sev =
      analysis.severity === "none"
        ? "That is within normal range."
        : `That fits a ${analysis.severity}${retrieved.has("incident-severity") ? " [kb:incident-severity]" : ""}.`;
    lines.push(
      `${cap(analysis.service)} errors peaked at ${analysis.peak} per hour ${analysis.peakHoursAgo}h ago, against a baseline of ${analysis.baseline}. ${sev}`,
    );
  }

  for (const o of outcomes) {
    if (o.toolName === "createTicket") {
      if (o.denied) lines.push(`You declined the ticket${o.reason ? ` (${o.reason})` : ""}, so I did not open one.`);
      else {
        const t = o.value as { ticketId: string; priority: string };
        lines.push(`I opened ${t.ticketId} as ${t.priority}.`);
      }
    }
    if (o.toolName === "notifyChannel") {
      if (o.denied) {
        const policy = notifyChannelApproval(o.input as { channel: string });
        lines.push(
          typeof policy === "object"
            ? `I did not post the update. ${policy.reason}`
            : `You declined the post${o.reason ? ` (${o.reason})` : ""}, so nothing was sent.`,
        );
      } else {
        const n = o.value as { channel: string };
        lines.push(`Posted the update to ${n.channel}.`);
      }
    }
  }
  return lines.join("\n\n");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const usage = (input: number, output: number): LanguageModelV4Usage => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});

function approxTokens(prompt: LanguageModelV4Message[]): number {
  return Math.ceil(JSON.stringify(prompt).length / 4);
}

export function createDemoModel(opts: { chunkDelayMs?: number } = {}): LanguageModelV4 {
  const chunkDelay = opts.chunkDelayMs ?? 18;
  let seq = 0;
  const id = () => `demo-${Date.now().toString(36)}-${(seq++).toString(36)}`;

  return {
    specificationVersion: "v4",
    provider: "demo",
    modelId: "scripted-ops-agent",
    supportedUrls: {},

    async doGenerate(options: LanguageModelV4CallOptions) {
      const d = decide(options.prompt);
      const content: LanguageModelV4Content[] =
        d.kind === "tool"
          ? [{ type: "tool-call", toolCallId: id(), toolName: d.call.toolName, input: JSON.stringify(d.call.input) }]
          : [{ type: "text", text: d.text }];
      return {
        content,
        finishReason: { unified: d.kind === "tool" ? "tool-calls" : "stop", raw: undefined },
        usage: usage(approxTokens(options.prompt), 40),
        warnings: [],
      };
    },

    async doStream(options: LanguageModelV4CallOptions) {
      const d = decide(options.prompt);
      const chunks: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }];
      if (d.kind === "tool") {
        const callId = id();
        const json = JSON.stringify(d.call.input);
        chunks.push({ type: "tool-input-start", id: callId, toolName: d.call.toolName });
        for (const piece of json.match(/.{1,12}/g) ?? []) {
          chunks.push({ type: "tool-input-delta", id: callId, delta: piece });
        }
        chunks.push({ type: "tool-input-end", id: callId });
        chunks.push({ type: "tool-call", toolCallId: callId, toolName: d.call.toolName, input: json });
      } else {
        const textId = id();
        chunks.push({ type: "text-start", id: textId });
        for (const word of d.text.match(/\S+\s*/g) ?? []) {
          chunks.push({ type: "text-delta", id: textId, delta: word });
        }
        chunks.push({ type: "text-end", id: textId });
      }
      chunks.push({
        type: "finish",
        finishReason: { unified: d.kind === "tool" ? "tool-calls" : "stop", raw: undefined },
        usage: usage(approxTokens(options.prompt), chunks.length),
      });
      return {
        stream: simulateReadableStream({ chunks, chunkDelayInMs: chunkDelay, initialDelayInMs: 150 }),
      };
    },
  };
}
