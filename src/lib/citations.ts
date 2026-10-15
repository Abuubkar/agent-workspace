// The agent cites runbooks inline as [kb:<doc-id>]. These helpers split
// text into plain and citation segments, and check citations against the
// documents a search actually returned.

export type Segment = { type: "text"; text: string } | { type: "cite"; id: string };

const CITE = /\[kb:([a-z0-9-]+)\]/g;

export function splitCitations(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push({ type: "cite", id: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function citedIds(text: string): string[] {
  return [...new Set([...text.matchAll(CITE)].map((m) => m[1]))];
}

// A citation is valid only if a search in the same run returned that doc.
export function invalidCitations(text: string, retrievedIds: string[]): string[] {
  const allowed = new Set(retrievedIds);
  return citedIds(text).filter((id) => !allowed.has(id));
}
