import type { SearchHit } from "@/lib/kb/search";
import { SIDE_EFFECT_TOOLS } from "@/lib/agent/policy";

// The slice of a tool UI part the components rely on. Kept loose so the same
// card renders every tool without a switch per tool type.
export type ToolPartView = {
  type: string;
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  preliminary?: boolean;
  approval?: {
    id: string;
    approved?: boolean;
    isAutomatic?: boolean;
    reason?: string;
    requestReason?: string;
  };
};

export const TOOL_LABELS: Record<string, string> = {
  searchDocs: "Search runbooks",
  analyzeIncidents: "Analyze incidents",
  createTicket: "Create ticket",
  notifyChannel: "Post to channel",
};

export function toolNameOf(part: { type: string }): string {
  return part.type.startsWith("tool-") ? part.type.slice(5) : part.type;
}

export function isSideEffect(toolName: string): boolean {
  return (SIDE_EFFECT_TOOLS as readonly string[]).includes(toolName);
}

export type Phase = "planning" | "waiting" | "running" | "done" | "failed" | "denied" | "stopped";

// `active` is false once the chat stream has ended. A call still planning or
// running at that point was cut off by Stop and will not finish.
export function phaseOf(part: ToolPartView, active = true): Phase {
  const phase = basePhase(part);
  return !active && (phase === "planning" || phase === "running") ? "stopped" : phase;
}

function basePhase(part: ToolPartView): Phase {
  switch (part.state) {
    case "input-streaming":
      return "planning";
    case "approval-requested":
      return part.approval?.isAutomatic ? "running" : "waiting";
    case "approval-responded":
      return part.approval?.approved ? "running" : "denied";
    case "input-available":
      return "running";
    case "output-available":
      return part.preliminary ? "running" : "done";
    case "output-error":
      return "failed";
    case "output-denied":
      return "denied";
  }
}

export const PHASE_LABEL: Record<Phase, string> = {
  planning: "Planning",
  waiting: "Needs approval",
  running: "Running",
  done: "Done",
  failed: "Failed",
  denied: "Denied",
  stopped: "Stopped",
};

export function isFinished(phase: Phase): boolean {
  return phase === "done" || phase === "failed" || phase === "denied" || phase === "stopped";
}

// One line that says what the tool produced, for the card and the timeline.
export function summarizeOutput(toolName: string, output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const o = output as Record<string, unknown>;
  switch (toolName) {
    case "searchDocs": {
      const hits = (o.hits as SearchHit[]) ?? [];
      return hits.length ? `${hits.length} runbook${hits.length > 1 ? "s" : ""} matched` : "No runbook matched";
    }
    case "analyzeIncidents":
      return o.status === "running"
        ? String(o.stage)
        : `Peak ${o.peak}/h vs baseline ${o.baseline}/h · ${o.severity === "none" ? "normal" : o.severity}`;
    case "createTicket":
      return `${o.ticketId} opened as ${o.priority}`;
    case "notifyChannel":
      return `Posted to ${o.channel}`;
    default:
      return undefined;
  }
}

export function collectHits(parts: ToolPartView[]): SearchHit[] {
  const seen = new Map<string, SearchHit>();
  for (const p of parts) {
    if (toolNameOf(p) !== "searchDocs" || p.state !== "output-available") continue;
    for (const hit of ((p.output as { hits?: SearchHit[] })?.hits ?? [])) {
      if (!seen.has(hit.id)) seen.set(hit.id, hit);
    }
  }
  return [...seen.values()];
}
