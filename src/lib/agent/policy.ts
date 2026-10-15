// Which tool calls a human has to approve. Kept as plain functions so the
// UI, the agent and the evals all read the same rules.

export const RESTRICTED_CHANNELS = ["#all-hands", "#customers"] as const;

export type ApprovalDecision =
  | "user-approval"
  | { type: "denied"; reason: string }
  | undefined;

export function createTicketApproval(): ApprovalDecision {
  return "user-approval";
}

export function notifyChannelApproval(input: { channel: string }): ApprovalDecision {
  const channel = normalizeChannel(input.channel);
  if ((RESTRICTED_CHANNELS as readonly string[]).includes(channel)) {
    return {
      type: "denied",
      reason: `Incident details are never posted in ${channel}.`,
    };
  }
  return "user-approval";
}

export function normalizeChannel(channel: string): string {
  const c = channel.trim().toLowerCase();
  return c.startsWith("#") ? c : `#${c}`;
}

// Tools that change something outside the workspace.
export const SIDE_EFFECT_TOOLS = ["createTicket", "notifyChannel"] as const;
export const READ_ONLY_TOOLS = ["searchDocs", "analyzeIncidents"] as const;
