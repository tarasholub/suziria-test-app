"use client";

import { useState } from "react";
import type { DynamicToolUIPart } from "ai";
import { TOOL_SEPARATOR } from "@/lib/mcp/shared";

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const STATE_LABEL: Record<string, { label: string; className: string }> = {
  "input-streaming": { label: "готує виклик…", className: "bg-amber-100 text-amber-800" },
  "input-available": { label: "виконується…", className: "bg-amber-100 text-amber-800" },
  "output-available": { label: "виконано", className: "bg-emerald-100 text-emerald-800" },
  "output-error": { label: "помилка", className: "bg-red-100 text-red-800" },
};

export function ToolPart({ part }: { part: DynamicToolUIPart }) {
  const [open, setOpen] = useState(false);

  const [serverId, ...rest] = part.toolName.split(TOOL_SEPARATOR);
  const toolName = rest.length > 0 ? rest.join(TOOL_SEPARATOR) : part.toolName;
  const serverLabel = rest.length > 0 ? serverId : "mcp";
  const state = STATE_LABEL[part.state] ?? STATE_LABEL["input-available"];
  const running = part.state === "input-streaming" || part.state === "input-available";

  return (
    <div className="my-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        {running && (
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        )}
        <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
          {serverLabel}
        </span>
        <span className="truncate font-mono text-xs font-semibold">{toolName}</span>
        <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs ${state.className}`}>
          {state.label}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">Параметри</div>
            <pre className="max-h-48 overflow-auto rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-800">
              {formatJson(part.input ?? {})}
            </pre>
          </div>
          {part.state === "output-available" && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">Результат</div>
              <pre className="max-h-64 overflow-auto rounded bg-zinc-100 p-2 font-mono text-xs whitespace-pre-wrap dark:bg-zinc-800">
                {formatJson(part.output)}
              </pre>
            </div>
          )}
          {part.state === "output-error" && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-red-500">Помилка</div>
              <pre className="max-h-48 overflow-auto rounded bg-red-50 p-2 font-mono text-xs whitespace-pre-wrap text-red-700 dark:bg-red-950 dark:text-red-300">
                {part.errorText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
