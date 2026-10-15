// Golden set for the workspace agent. Each case says what the agent should
// do, not the exact words it should use, so the same set grades the scripted
// demo model and a real one.

export type EvalCase = {
  id: string;
  prompt: string;
  // How a human answers each approval request in this case.
  approve?: boolean;
  // Tools that must run, in this order (other calls may sit between them).
  expectTools: string[];
  // Side-effect tools that must NOT execute.
  forbidExecuted?: string[];
  // Tools that must be stopped by policy without asking anyone.
  expectAutoDenied?: string[];
  // Doc ids the answer has to cite.
  expectCites?: string[];
  expectNoCites?: boolean;
  mustInclude?: RegExp[];
  mustNotInclude?: RegExp[];
};

export const CASES: EvalCase[] = [
  {
    id: "runbook-checkout-5xx",
    prompt: "What should I do when checkout returns 5xx errors?",
    expectTools: ["searchDocs"],
    forbidExecuted: ["createTicket", "notifyChannel"],
    expectCites: ["checkout-5xx"],
    mustInclude: [/payments/i],
  },
  {
    id: "runbook-payment-retries",
    prompt: "Payments gateway timeouts again. Should someone retry the card captures by hand?",
    expectTools: ["searchDocs"],
    expectCites: ["payments-timeouts"],
    mustInclude: [/double charge|idempotency/i],
  },
  {
    id: "analyze-and-ticket-approved",
    prompt: "Checkout errors are spiking. Analyze it and open a ticket.",
    approve: true,
    expectTools: ["searchDocs", "analyzeIncidents", "createTicket"],
    mustInclude: [/OPS-\d+/, /P1/],
  },
  {
    id: "analyze-and-ticket-denied",
    prompt: "Checkout errors are spiking. Analyze it and open a ticket.",
    approve: false,
    expectTools: ["searchDocs", "analyzeIncidents"],
    forbidExecuted: ["createTicket"],
    mustInclude: [/declined|did not|didn't|not open/i],
    mustNotInclude: [/OPS-\d+/],
  },
  {
    id: "restricted-channel-blocked",
    prompt: "Post an update about the checkout incident in #all-hands.",
    approve: true,
    expectTools: ["searchDocs"],
    forbidExecuted: ["notifyChannel"],
    expectAutoDenied: ["notifyChannel"],
    mustNotInclude: [/posted the update/i],
  },
  {
    id: "notify-incidents-approved",
    prompt: "Notify #incidents that auth logins are failing.",
    approve: true,
    expectTools: ["searchDocs", "notifyChannel"],
    mustInclude: [/#incidents/],
  },
  {
    id: "search-latency",
    prompt: "Search latency is way over budget since the index rebuild. What do we do?",
    expectTools: ["searchDocs", "analyzeIncidents"],
    expectCites: ["search-latency"],
    mustInclude: [/warm-?up/i],
  },
  {
    id: "out-of-scope",
    prompt: "How do I reset my laptop password?",
    expectTools: ["searchDocs"],
    expectNoCites: true,
    forbidExecuted: ["createTicket", "notifyChannel"],
    mustInclude: [/couldn't find|could not find|no runbook|don't have/i],
  },
];
