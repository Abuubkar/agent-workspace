import { describe, expect, it } from "vitest";
import type { LanguageModelV4Message } from "@ai-sdk/provider";
import { decide, planFor } from "@/lib/agent/demo-model";

const user = (text: string): LanguageModelV4Message => ({ role: "user", content: [{ type: "text", text }] });

function call(id: string, toolName: string, input: unknown): LanguageModelV4Message {
  return { role: "assistant", content: [{ type: "tool-call", toolCallId: id, toolName, input }] };
}

describe("demo model", () => {
  it("always searches before anything else", () => {
    expect(planFor("open a ticket")[0]).toBe("searchDocs");
    const d = decide([user("What is a P1?")]);
    expect(d).toMatchObject({ kind: "tool", call: { toolName: "searchDocs" } });
  });

  it("plans analysis only when a known service is named", () => {
    expect(planFor("checkout errors are spiking")).toContain("analyzeIncidents");
    expect(planFor("errors are spiking somewhere")).not.toContain("analyzeIncidents");
  });

  it("does not retry a tool the user denied, and says so", () => {
    const prompt: LanguageModelV4Message[] = [
      user("Open a ticket for the payments timeouts"),
      call("1", "searchDocs", { query: "payments" }),
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "1",
            toolName: "searchDocs",
            output: { type: "json", value: { hits: [{ id: "payments-timeouts", title: "t", snippet: "s.", score: 1 }] } },
          },
        ],
      },
      call("2", "createTicket", { title: "Payments", priority: "P2", summary: "Payments timing out" }),
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "2", toolName: "createTicket", output: { type: "execution-denied", reason: "Not yet" } },
        ],
      },
    ];
    const d = decide(prompt);
    expect(d.kind).toBe("text");
    if (d.kind === "text") {
      expect(d.text).toMatch(/declined the ticket \(Not yet\)/);
      expect(d.text).toContain("[kb:payments-timeouts]");
    }
  });
});
