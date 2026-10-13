"use client";

import { useEffect, useMemo, useState } from "react";
import { parseRetryDelaySeconds } from "@/lib/chat-meta";

function format(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}г ${m}хв`;
  if (m > 0) return `${m}:${String(s).padStart(2, "0")}`;
  return `${s} с`;
}

export function RetryableError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const initialDelay = useMemo(() => parseRetryDelaySeconds(message), [message]);
  const [left, setLeft] = useState(initialDelay);

  useEffect(() => {
    setLeft(initialDelay);
    if (initialDelay === null) return;
    const timer = setInterval(
      () => setLeft((v) => (v === null || v <= 1 ? 0 : v - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [initialDelay]);

  const waiting = left !== null && left > 0;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      <span className="font-medium">Помилка:</span> {message}
      <div className="mt-1.5 flex items-center gap-2">
        {waiting && (
          <span className="text-xs tabular-nums">
            ⏳ ліміт провайдера — можна повторити через {format(left)}
          </span>
        )}
        <button
          type="button"
          onClick={onRetry}
          disabled={waiting}
          className="rounded border border-red-300 px-2 py-0.5 text-xs hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900"
        >
          ⟳ Спробувати ще раз
        </button>
      </div>
    </div>
  );
}
