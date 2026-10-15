import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CitedText } from "@/components/cited-text";

describe("CitedText", () => {
  const numbers = new Map([["checkout-5xx", 1]]);

  it("links a citation to its numbered source", async () => {
    const onCite = vi.fn();
    render(<CitedText text="Check payments first [kb:checkout-5xx]." sourceNumbers={numbers} onCite={onCite} />);
    await userEvent.click(screen.getByRole("button", { name: "Source 1: checkout-5xx" }));
    expect(onCite).toHaveBeenCalledWith("checkout-5xx");
  });

  it("marks a citation to an unretrieved document as unverified", () => {
    render(<CitedText text="Made up [kb:invented-doc]." sourceNumbers={numbers} />);
    expect(screen.getByRole("button", { name: "Unverified citation invented-doc" })).toBeDisabled();
  });
});
