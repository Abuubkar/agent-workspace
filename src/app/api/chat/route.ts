import { createAgentUIStreamResponse } from "ai";
import { createWorkspaceAgent, pickModel } from "@/lib/agent/agent";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { messages } = await request.json();
  const { model, label } = pickModel();
  const agent = createWorkspaceAgent({ model });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    abortSignal: request.signal,
    headers: { "x-agent-model": label },
  });
}
