"use client";

import { useChat } from "@ai-sdk/react";
import { isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { useMemo, useState } from "react";
import type { WorkspaceUIMessage } from "@/lib/agent/agent";
import { collectHits, type ToolPartView } from "@/lib/ui/tool-meta";
import { CitedText } from "./cited-text";
import { RunTimeline } from "./run-timeline";
import { SourcesPanel } from "./sources-panel";
import { ToolCallCard } from "./tool-call-card";

const SUGGESTIONS = [
  "Checkout errors are spiking. Analyze it and open a ticket.",
  "Notify #incidents that auth logins are failing.",
  "Payments gateway timeouts again. Should someone retry the card captures by hand?",
  "Post an update about the checkout incident in #all-hands.",
];

export function Workspace() {
  const { messages, sendMessage, status, stop, regenerate, error, addToolApprovalResponse } =
    useChat<WorkspaceUIMessage>({
      // Once every pending approval has an answer, send the turn back so the
      // server can run (or skip) the tools and the agent can carry on.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    });
  const [input, setInput] = useState("");
  const [activeCite, setActiveCite] = useState<string>();

  const busy = status === "submitted" || status === "streaming";
  const allToolParts = useMemo(
    () => messages.flatMap((m) => m.parts.filter(isToolUIPart)) as unknown as ToolPartView[],
    [messages],
  );
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const runParts = (lastAssistant?.parts.filter(isToolUIPart) ?? []) as unknown as ToolPartView[];
  const hits = useMemo(() => collectHits(allToolParts), [allToolParts]);
  const sourceNumbers = useMemo(() => new Map(hits.map((h, i) => [h.id, i + 1])), [hits]);
  const waiting = runParts.some((p) => p.state === "approval-requested" && !p.approval?.isAutomatic);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <div className="mx-auto grid h-dvh max-w-7xl grid-rows-[auto_1fr] gap-4 p-4 lg:grid-cols-[1fr_340px] lg:grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between lg:col-span-2">
        <div>
          <h1 className="text-lg font-semibold">On-call Agent Workspace</h1>
          <p className="text-sm text-zinc-500">
            Answers cite runbooks. Tickets and channel posts wait for your approval.
          </p>
        </div>
        <span className="text-xs text-zinc-500" role="status" aria-live="polite">
          {waiting ? "Waiting for your approval" : busy ? "Working…" : status === "error" ? "Error" : "Ready"}
        </span>
      </header>

      <main className="flex min-h-0 flex-col rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-500">Try one of these:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "w-full text-sm"
                }
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "user" ? (
                      <p key={i}>{part.text}</p>
                    ) : (
                      <CitedText
                        key={i}
                        text={part.text}
                        sourceNumbers={sourceNumbers}
                        activeId={activeCite}
                        onCite={setActiveCite}
                      />
                    );
                  }
                  if (isToolUIPart(part)) {
                    return (
                      <ToolCallCard
                        key={part.toolCallId}
                        part={part as unknown as ToolPartView}
                        active={busy}
                        onApproval={addToolApprovalResponse}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              Something went wrong.{" "}
              <button type="button" className="underline" onClick={() => regenerate()}>
                Retry
              </button>
            </div>
          )}
        </div>

        <form
          className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <label htmlFor="prompt" className="sr-only">
            Message
          </label>
          <textarea
            id="prompt"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder={waiting ? "Approve or deny the pending action first" : "Ask about an incident…"}
            disabled={waiting}
            className="max-h-40 flex-1 resize-none rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              Stop
            </button>
          ) : (
            <>
              {lastAssistant && (
                <button
                  type="button"
                  onClick={() => regenerate()}
                  disabled={waiting}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
                >
                  Regenerate
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || waiting}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Send
              </button>
            </>
          )}
        </form>
      </main>

      <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto lg:flex">
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Run timeline</h2>
          <RunTimeline parts={runParts} active={busy} />
        </section>
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold">Sources</h2>
          <SourcesPanel hits={hits} activeId={activeCite} />
        </section>
      </aside>
    </div>
  );
}
