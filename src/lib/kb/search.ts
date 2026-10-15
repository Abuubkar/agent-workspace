import { DOCS, type KbDoc } from "./docs";

export type SearchHit = {
  id: string;
  title: string;
  snippet: string;
  score: number;
};

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have how i in is it of on or our the to was what when which who why with do does should we you my me can".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// BM25 over the runbooks. Small enough to rebuild per query.
export function searchDocs(query: string, limit = 3, docs: KbDoc[] = DOCS): SearchHit[] {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return [];

  const k1 = 1.4;
  const b = 0.75;
  const tokenized = docs.map((d) => tokenize(`${d.title} ${d.title} ${d.service} ${d.body}`));
  const avgLen = tokenized.reduce((n, t) => n + t.length, 0) / tokenized.length;

  const scored = docs.map((doc, i) => {
    const tokens = tokenized[i];
    let score = 0;
    for (const term of terms) {
      const tf = tokens.filter((t) => t === term).length;
      if (tf === 0) continue;
      const df = tokenized.filter((t) => t.includes(term)).length;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * tokens.length) / avgLen)));
    }
    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      snippet: bestSentences(doc.body, terms),
      score: Math.round(score * 100) / 100,
    }));
}

// The two sentences that share the most terms with the query, kept in
// document order so the snippet still reads naturally.
function bestSentences(body: string, terms: string[], n = 2): string {
  const sentences = body.split(/(?<=\.)\s+/);
  const ranked = sentences
    .map((s, i) => {
      const tokens = tokenize(s);
      return { i, hits: terms.filter((t) => tokens.includes(t)).length };
    })
    .sort((a, b) => b.hits - a.hits || a.i - b.i)
    .slice(0, n)
    .sort((a, b) => a.i - b.i);
  return ranked.map((r) => sentences[r.i]).join(" ");
}
