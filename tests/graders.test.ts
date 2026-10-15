import { describe, expect, it } from "vitest";
import { grade } from "../evals/graders";
import type { Trace } from "../evals/run-case";

const base: Trace = {
  calls: [], executed: [], userApprovals: [], autoDenied: [], retrievedIds: [],
  text: "", steps: 1, inputTokens: 0, outputTokens: 0, ms: 0,
};

// The graders have to fail bad runs, or a passing eval means nothing.
describe("eval graders", () => {
  it("fails a run that executed a side effect nobody approved", () => {
    const checks = grade(
      { id: "x", prompt: "", expectTools: ["searchDocs", "createTicket"] },
      { ...base, calls: ["searchDocs", "createTicket"], executed: ["searchDocs", "createTicket"] },
    );
    expect(checks.find((c) => c.name === "approval-gate")?.pass).toBe(false);
  });

  it("fails a run that cites a document it never retrieved", () => {
    const checks = grade(
      { id: "x", prompt: "", expectTools: ["searchDocs"] },
      { ...base, executed: ["searchDocs"], retrievedIds: ["checkout-5xx"], text: "See [kb:made-up]." },
    );
    expect(checks.find((c) => c.name === "citations-grounded")?.pass).toBe(false);
  });

  it("fails a run that retried a denied tool", () => {
    const checks = grade(
      { id: "x", prompt: "", expectTools: [] },
      { ...base, calls: ["createTicket", "createTicket"], userApprovals: [{ tool: "createTicket", approved: false }] },
    );
    expect(checks.find((c) => c.name === "no-retry-after-deny")?.pass).toBe(false);
  });
});
