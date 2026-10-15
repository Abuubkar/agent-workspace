import type { ModelMessage, ToolApprovalResponse } from "ai";
import { createWorkspaceAgent } from "@/lib/agent/agent";
import type { LanguageModel } from "ai";
import type { EvalCase } from "./cases";

export type Trace = {
  calls: string[];
  executed: string[];
  userApprovals: { tool: string; approved: boolean }[];
  autoDenied: string[];
  retrievedIds: string[];
  text: string;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  ms: number;
};

// Runs one case end to end, answering approval requests the way the case
// says a human would, and records what the agent actually did.
export async function runCase(c: EvalCase, model: LanguageModel): Promise<Trace> {
  const agent = createWorkspaceAgent({ model, stageDelayMs: 0 });
  const messages: ModelMessage[] = [{ role: "user", content: c.prompt }];
  const trace: Trace = {
    calls: [],
    executed: [],
    userApprovals: [],
    autoDenied: [],
    retrievedIds: [],
    text: "",
    steps: 0,
    inputTokens: 0,
    outputTokens: 0,
    ms: 0,
  };
  const started = Date.now();
  const autoRequests = new Set<string>();

  for (let round = 0; round < 6; round++) {
    const result = await agent.generate({ messages });
    messages.push(...result.responseMessages);
    trace.steps += result.steps.length;
    trace.inputTokens += result.usage.inputTokens ?? 0;
    trace.outputTokens += result.usage.outputTokens ?? 0;

    // Tool results live in the response messages: a tool approved in this
    // round runs before the first step, so it never shows up in result.steps.
    for (const msg of result.responseMessages) {
      if (msg.role !== "tool") continue;
      for (const part of msg.content) {
        if (part.type !== "tool-result" || part.output.type !== "json") continue;
        trace.executed.push(part.toolName);
        if (part.toolName === "searchDocs") {
          const out = part.output.value as { hits: { id: string }[] };
          trace.retrievedIds.push(...out.hits.map((h) => h.id));
        }
      }
    }

    const pending: ToolApprovalResponse[] = [];
    for (const step of result.steps) {
      for (const part of step.content) {
        if (part.type === "tool-call") trace.calls.push(part.toolName);
        if (part.type === "tool-approval-request") {
          if (part.isAutomatic) {
            autoRequests.add(part.approvalId);
            continue;
          }
          const approved = c.approve ?? true;
          trace.userApprovals.push({ tool: part.toolCall.toolName, approved });
          pending.push({
            type: "tool-approval-response",
            approvalId: part.approvalId,
            approved,
            reason: approved ? undefined : "Declined by user",
          });
        }
        if (part.type === "tool-approval-response" && autoRequests.has(part.approvalId) && !part.approved) {
          trace.autoDenied.push(part.toolCall.toolName);
        }
      }
    }

    trace.text = result.text || trace.text;
    if (pending.length === 0) break;
    messages.push({ role: "tool", content: pending });
  }

  trace.ms = Date.now() - started;
  return trace;
}
