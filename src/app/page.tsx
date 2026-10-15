import { Suspense } from "react";
import { Workspace } from "@/components/workspace";

// useChat creates a random chat id, so the workspace renders on request
// instead of being prerendered.
export default function Home() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading workspace…</div>}>
      <Workspace />
    </Suspense>
  );
}
