import { describe, expect, it } from "vitest";
import { citedIds, invalidCitations, splitCitations } from "@/lib/citations";

describe("citations", () => {
  const text = "Roll back first [kb:deploy-rollback]. Then page on-call [kb:incident-severity].";

  it("splits text and citation markers in order", () => {
    expect(splitCitations(text).map((s) => s.type)).toEqual(["text", "cite", "text", "cite", "text"]);
  });

  it("lists each cited id once", () => {
    expect(citedIds(`${text} [kb:deploy-rollback]`)).toEqual(["deploy-rollback", "incident-severity"]);
  });

  it("flags citations to documents the run never retrieved", () => {
    expect(invalidCitations(text, ["deploy-rollback"])).toEqual(["incident-severity"]);
    expect(invalidCitations(text, ["deploy-rollback", "incident-severity"])).toEqual([]);
  });
});
