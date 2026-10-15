"use client";

import { ApprovalControls } from "./approval-controls";
import {
  PHASE_LABEL,
  TOOL_LABELS,
  isSideEffect,
  phaseOf,
  summarizeOutput,
  toolNameOf,
  type Phase,
  type ToolPartView,
} from "@/lib/ui/tool-meta";

const PHASE_STYLE: Record<Phase, string> = {
  planning: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  waiting: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  denied: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  stopped: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

type Props = {
  part: ToolPartView;
  // False once the chat stream has ended (finished or stopped).
  active?: boolean;
  onApproval: (r: { id: string; approved: boolean; reason?: string }) => void;
};

export function ToolCallCard({ part, active = true, onApproval }: Props) {
  const name = toolNameOf(part);
  const phase = phaseOf(part, active);
  const summary = summarizeOutput(name, part.output);
  const progress =
    name === "analyzeIncidents" && part.state === "output-available"
      ? (part.output as { progress?: number })?.progress
      : undefined;
  const denialReason = part.approval && part.approval.approved === false ? part.approval.reason : undefined;

  return (
    <div
      className="my-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      data-testid={`tool-${name}`}
      data-phase={phase}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{TOOL_LABELS[name] ?? name}</span>
          {isSideEffect(name) && (
            <span className="rounded border border-zinc-300 px-1.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
              side effect
            </span>
          )}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_STYLE[phase]}`} role="status">
          {PHASE_LABEL[phase]}
        </span>
      </div>

      {part.input !== undefined && (
        <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2 font-mono text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {JSON.stringify(part.input, null, 2)}
        </pre>
      )}

      {progress !== undefined && phase === "running" && (
        <div className="mt-2" aria-label="Progress">
          <div className="h-1.5 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {phase === "stopped" && <p className="mt-2 text-zinc-600 dark:text-zinc-400">Stopped before it finished.</p>}
      {summary && phase !== "stopped" && <p className="mt-2 text-zinc-600 dark:text-zinc-400">{summary}</p>}
      {part.state === "output-error" && <p className="mt-2 text-red-600">{part.errorText}</p>}
      {phase === "denied" && (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {part.approval?.isAutomatic ? "Blocked by policy" : "Declined"}
          {denialReason ? `: ${denialReason}` : "."}
        </p>
      )}

      {part.state === "approval-requested" && part.approval && !part.approval.isAutomatic && (
        <ApprovalControls approvalId={part.approval.id} onRespond={onApproval} />
      )}
    </div>
  );
}
