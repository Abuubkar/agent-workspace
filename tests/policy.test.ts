import { describe, expect, it } from "vitest";
import { createTicketApproval, notifyChannelApproval } from "@/lib/agent/policy";

describe("approval policy", () => {
  it("always asks a person before opening a ticket", () => {
    expect(createTicketApproval()).toBe("user-approval");
  });

  it("asks a person before posting to a normal channel", () => {
    expect(notifyChannelApproval({ channel: "#incidents" })).toBe("user-approval");
  });

  it("blocks restricted channels without asking, however they are written", () => {
    for (const channel of ["#all-hands", "all-hands", " #Customers "]) {
      expect(notifyChannelApproval({ channel })).toMatchObject({ type: "denied" });
    }
  });
});
