import { describe, expect, it } from "vitest";
import { searchDocs, tokenize } from "@/lib/kb/search";

describe("searchDocs", () => {
  it("ranks the runbook that matches the question first", () => {
    expect(searchDocs("checkout is returning 5xx errors")[0].id).toBe("checkout-5xx");
    expect(searchDocs("payments gateway timeouts")[0].id).toBe("payments-timeouts");
  });

  it("returns nothing when no runbook shares a term with the query", () => {
    expect(searchDocs("reset my laptop password")).toEqual([]);
  });

  it("snippets come from the matched document", () => {
    const [hit] = searchDocs("search latency warm-up");
    expect(hit.id).toBe("search-latency");
    expect(hit.snippet).toMatch(/warm-up/);
  });

  it("drops stop words and punctuation", () => {
    expect(tokenize("What is the P1 process?")).toEqual(["p1", "process"]);
  });
});
