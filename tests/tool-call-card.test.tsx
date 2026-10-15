import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallCard } from "@/components/tool-call-card";
import type { ToolPartView } from "@/lib/ui/tool-meta";

const ticket = (over: Partial<ToolPartView>): ToolPartView => ({
  type: "tool-createTicket",
  toolCallId: "call-1",
  state: "approval-requested",
  input: { title: "Checkout error spike", priority: "P1", summary: "Peak 240/h" },
  approval: { id: "appr-1" },
  ...over,
});

describe("ToolCallCard", () => {
  it("pauses a side-effect call until someone approves it", async () => {
    const onApproval = vi.fn();
    render(<ToolCallCard part={ticket({})} onApproval={onApproval} />);

    expect(screen.getByRole("status")).toHaveTextContent("Needs approval");
    await userEvent.type(screen.getByLabelText("Reason (optional)"), "confirmed with lead");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(onApproval).toHaveBeenCalledWith({ id: "appr-1", approved: true, reason: "confirmed with lead" });
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("sends a denial without a reason when none is given", async () => {
    const onApproval = vi.fn();
    render(<ToolCallCard part={ticket({})} onApproval={onApproval} />);
    await userEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onApproval).toHaveBeenCalledWith({ id: "appr-1", approved: false, reason: undefined });
  });

  it("shows no buttons for a decision the policy already made", () => {
    render(
      <ToolCallCard
        part={ticket({
          type: "tool-notifyChannel",
          state: "output-denied",
          approval: { id: "a", approved: false, isAutomatic: true, reason: "Never in #all-hands." },
        })}
        onApproval={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByText(/Blocked by policy: Never in #all-hands\./)).toBeInTheDocument();
  });

  it("shows live progress while a long tool is still running", () => {
    render(
      <ToolCallCard
        part={{
          type: "tool-analyzeIncidents",
          toolCallId: "c2",
          state: "output-available",
          preliminary: true,
          input: { service: "checkout", hours: 6 },
          output: { status: "running", stage: "Comparing with baseline", progress: 33 },
        }}
        onApproval={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Running");
    expect(screen.getByText("Comparing with baseline")).toBeInTheDocument();
    expect(screen.getByLabelText("Progress")).toBeInTheDocument();
  });
});

describe("ToolCallCard after Stop", () => {
  it("shows a call cut off by Stop as stopped, not running", () => {
    render(
      <ToolCallCard
        active={false}
        part={{
          type: "tool-analyzeIncidents",
          toolCallId: "c3",
          state: "output-available",
          preliminary: true,
          input: { service: "search", hours: 6 },
          output: { status: "running", stage: "Comparing with baseline", progress: 33 },
        }}
        onApproval={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Stopped");
    expect(screen.queryByLabelText("Progress")).toBeNull();
  });
});
