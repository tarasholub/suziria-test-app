"use client";

import { useEffect, useState } from "react";
import type { ProviderLimits } from "@/lib/limits";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

interface LimitsBadgeProps {
  providerId: string;
  /** Bump to refetch (e.g. after each finished response). */
  refreshKey: number;
}

export function LimitsBadge({ providerId, refreshKey }: LimitsBadgeProps) {
  const [limits, setLimits] = useState<Record<string, ProviderLimits>>({});

  useEffect(() => {
    void fetch("/api/limits")
      .then((r) => r.json())
      .then((data: { limits: Record<string, ProviderLimits> }) => setLimits(data.limits))
      .catch(() => {});
  }, [refreshKey]);

  const l = limits[providerId];
  if (!l) return null;

  const parts: string[] = [];
  if (l.requests) parts.push(`${compact(l.requests.remaining)}/${compact(l.requests.limit)} зап.`);
  if (l.tokens) parts.push(`${compact(l.tokens.remaining)}/${compact(l.tokens.limit)} ток.`);
  if (parts.length === 0) return null;

  const low =
    (l.requests && l.requests.remaining / l.requests.limit < 0.15) ||
    (l.tokens && l.tokens.remaining / l.tokens.limit < 0.15);

  const resets = [l.requests?.reset, l.tokens?.reset].filter(Boolean).join(" / ");

  return (
    <span
      className={`hidden whitespace-nowrap rounded-full border px-2 py-1 text-xs sm:inline ${
        low
          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "border-zinc-200 text-zinc-400 dark:border-zinc-700"
      }`}
      title={`Ліміти провайдера (з заголовків останньої відповіді)${resets ? `; скидання: ${resets}` : ""}`}
    >
      {parts.join(" · ")}
    </span>
  );
}
