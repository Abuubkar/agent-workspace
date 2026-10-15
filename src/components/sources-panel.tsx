"use client";

import { useEffect, useRef } from "react";
import type { SearchHit } from "@/lib/kb/search";

export function SourcesPanel({ hits, activeId }: { hits: SearchHit[]; activeId?: string }) {
  const refs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (activeId) refs.current[activeId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  if (hits.length === 0) {
    return <p className="text-sm text-zinc-500">Runbooks the agent retrieves are listed here.</p>;
  }

  return (
    <ul className="space-y-2">
      {hits.map((h, i) => (
        <li
          key={h.id}
          ref={(el) => {
            refs.current[h.id] = el;
          }}
          className={`rounded-md border p-2 text-sm transition-colors ${
            activeId === h.id
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">
              <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-blue-100 px-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {i + 1}
              </span>
              {h.title}
            </span>
            <code className="text-[11px] text-zinc-500">{h.id}</code>
          </div>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{h.snippet}</p>
        </li>
      ))}
    </ul>
  );
}
