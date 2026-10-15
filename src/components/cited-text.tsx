import { splitCitations } from "@/lib/citations";

type Props = {
  text: string;
  // Doc ids returned by search in this conversation, mapped to the number
  // the Sources panel shows. A citation outside this map is shown as
  // unverified instead of being linked.
  sourceNumbers: Map<string, number>;
  activeId?: string;
  onCite?: (id: string) => void;
};

export function CitedText({ text, sourceNumbers, activeId, onCite }: Props) {
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {splitCitations(text).map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.text}</span>;
        const n = sourceNumbers.get(seg.id);
        const known = n !== undefined;
        return (
          <button
            key={i}
            type="button"
            onClick={() => known && onCite?.(seg.id)}
            disabled={!known}
            title={known ? `Show source: ${seg.id}` : `Unverified citation: ${seg.id}`}
            aria-label={known ? `Source ${n}: ${seg.id}` : `Unverified citation ${seg.id}`}
            className={[
              "mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded px-1 align-text-top text-[11px] font-semibold",
              !known
                ? "bg-red-100 text-red-700 line-through dark:bg-red-950 dark:text-red-300"
                : activeId === seg.id
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300",
            ].join(" ")}
          >
            {known ? n : "?"}
          </button>
        );
      })}
    </p>
  );
}
