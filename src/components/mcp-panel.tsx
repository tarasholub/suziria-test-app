"use client";

import { useCallback, useEffect, useState } from "react";
import type { McpServerStatus } from "@/lib/mcp/manager";

const DOT: Record<string, string> = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-400 animate-pulse",
  error: "bg-red-500",
  disabled: "bg-zinc-300 dark:bg-zinc-600",
};

export function McpPanel() {
  const [servers, setServers] = useState<McpServerStatus[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/mcp${refresh ? "?refresh=1" : ""}`);
      const data = (await res.json()) as { servers: McpServerStatus[] };
      setServers(data.servers);
    } catch {
      // server unreachable; keep previous state
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 20_000);
    return () => clearInterval(interval);
  }, [load]);

  const toggle = async (id: string, enabled: boolean) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/mcp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      const data = (await res.json()) as { servers?: McpServerStatus[] };
      if (data.servers) setServers(data.servers);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">MCP-сервери</h2>
        <button
          type="button"
          onClick={() => void load(true)}
          className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Перепідключити сервери з помилками"
        >
          {refreshing ? "Оновлення…" : "⟳ Оновити"}
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {servers === null &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}

        {servers?.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-full ${DOT[s.state]}`} />
              <span className="truncate text-sm font-medium">{s.name}</span>
              <label className="ml-auto inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={s.enabled}
                  disabled={busyId === s.id}
                  onChange={(e) => void toggle(s.id, e.target.checked)}
                />
                <span className="relative h-5 w-9 rounded-full bg-zinc-300 transition-colors peer-checked:bg-emerald-500 peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4 dark:bg-zinc-600" />
              </label>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{s.description}</p>
            {s.state === "connected" && s.toolNames.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-zinc-400">
                  {s.toolNames.length} інструм.
                </summary>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-zinc-500">
                  {s.toolNames.map((t) => (
                    <li key={t} className="truncate">{t}</li>
                  ))}
                </ul>
              </details>
            )}
            {s.state === "error" && (
              <p className="mt-1 break-words rounded bg-red-50 p-1.5 text-[11px] text-red-600 dark:bg-red-950 dark:text-red-300">
                {s.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
