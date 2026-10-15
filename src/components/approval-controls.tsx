"use client";

import { useState } from "react";

type Props = {
  approvalId: string;
  onRespond: (r: { id: string; approved: boolean; reason?: string }) => void;
};

// Shown on a tool call that is paused until a person decides. Nothing runs
// until one of the two buttons is pressed.
export function ApprovalControls({ approvalId, onRespond }: Props) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const respond = (approved: boolean) => {
    setSent(true);
    onRespond({ id: approvalId, approved, reason: reason.trim() || undefined });
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        This action changes something outside the workspace. Approve it to continue.
      </p>
      <label className="sr-only" htmlFor={`reason-${approvalId}`}>
        Reason (optional)
      </label>
      <input
        id={`reason-${approvalId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        disabled={sent}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={sent}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={sent}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
