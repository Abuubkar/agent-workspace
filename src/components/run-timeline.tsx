"use client";

import { PHASE_LABEL, TOOL_LABELS, phaseOf, toolNameOf, type ToolPartView } from "@/lib/ui/tool-meta";

const DOT: Record<string, string> = {
  planning: "bg-zinc-400",
  waiting: "bg-amber-500 animate-pulse",
  running: "bg-blue-500 animate-pulse",
  done: "bg-emerald-500",
  failed: "bg-red-500",
  denied: "bg-zinc-500",
  stopped: "bg-zinc-500",
};

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// One row per tool call in the current run. Durations are the server's
// execution time for the tool, reported in its output.
export function RunTimeline({ parts, active }: { parts: ToolPartView[]; active: boolean }) {
  if (parts.length === 0) {
    return <p className="text-sm text-zinc-500">Tool calls for the current run show up here.</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
      {parts.map((p, i) => {
        const phase = phaseOf(p, active);
        const tookMs =
          phase === "done" ? (p.output as { tookMs?: number } | undefined)?.tookMs : undefined;
        return (
          <li key={p.toolCallId} className="relative" data-phase={phase}>
            <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${DOT[phase]}`} aria-hidden />
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="text-zinc-400">{i + 1}.</span> {TOOL_LABELS[toolNameOf(p)] ?? toolNameOf(p)}
              </span>
              {tookMs !== undefined && (
                <span className="tabular-nums text-xs text-zinc-500">{formatMs(tookMs)}</span>
              )}
            </div>
            <span className="text-xs text-zinc-500">{PHASE_LABEL[phase]}</span>
          </li>
        );
      })}
    </ol>
  );
}
