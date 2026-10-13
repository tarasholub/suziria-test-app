"use client";

import { useState } from "react";
import type { ReasoningUIPart } from "ai";

export function ReasoningPart({ part }: { part: ReasoningUIPart }) {
  const streaming = part.state === "streaming";
  const [open, setOpen] = useState(false);
  const expanded = open || streaming;

  if (!streaming && !part.text.trim()) return null;

  return (
    <div className="my-2 rounded-lg border border-dashed border-zinc-300 text-sm dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-500"
        aria-expanded={expanded}
      >
        <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
        <span className="text-xs font-semibold uppercase tracking-wide">💭 Міркування</span>
        {streaming && (
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
        )}
      </button>
      {expanded && (
        <div className="whitespace-pre-wrap border-t border-dashed border-zinc-300 px-3 py-2 text-xs italic text-zinc-500 dark:border-zinc-700">
          {part.text || "…"}
        </div>
      )}
    </div>
  );
}
