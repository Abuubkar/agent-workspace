import { ToolLoopAgent, isStepCount, type InferAgentUIMessage, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { makeTools } from "./tools";
import { createDemoModel } from "./demo-model";
import { createTicketApproval, notifyChannelApproval } from "./policy";

export const INSTRUCTIONS = `You are the on-call assistant for a storefront's operations team.

- Always call searchDocs before answering, and answer only from what it returns.
- Cite every claim from a runbook inline as [kb:<id>], using ids that searchDocs returned. Never invent an id.
- If no runbook covers the question, say so instead of guessing.
- Use analyzeIncidents when the user asks about errors, latency or an incident for a named service.
- createTicket and notifyChannel change things outside this workspace and wait for a human to approve them.
- When a tool call is denied, do not retry it. Tell the user what was not done.
- Keep answers short and plain.`;

export type ModelChoice = "demo" | "openai";

export function pickModel(choice?: ModelChoice): { model: LanguageModel; label: string } {
  const useOpenAI = choice === "openai" || (choice !== "demo" && !!process.env.OPENAI_API_KEY);
  if (useOpenAI) {
    const id = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    return { model: openai(id), label: `openai/${id}` };
  }
  return { model: createDemoModel(), label: "demo/scripted-ops-agent" };
}

export function createWorkspaceAgent(opts: { model?: LanguageModel; stageDelayMs?: number } = {}) {
  return new ToolLoopAgent({
    model: opts.model ?? pickModel().model,
    instructions: INSTRUCTIONS,
    tools: makeTools({ stageDelayMs: opts.stageDelayMs }),
    stopWhen: isStepCount(8),
    toolApproval: {
      createTicket: () => createTicketApproval(),
      notifyChannel: (input) => notifyChannelApproval(input),
    },
    experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET,
  });
}

export type WorkspaceAgent = ReturnType<typeof createWorkspaceAgent>;
export type WorkspaceUIMessage = InferAgentUIMessage<WorkspaceAgent>;
