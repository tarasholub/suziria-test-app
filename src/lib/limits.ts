export interface RateWindow {
  limit: number;
  remaining: number;
  /** Provider-reported time until the window resets, as given (e.g. "7.66s", "2m59s"). */
  reset?: string;
}

export interface ProviderLimits {
  requests?: RateWindow;
  tokens?: RateWindow;
  capturedAt: number;
}

function windowFrom(
  headers: Headers,
  limitKey: string,
  remainingKey: string,
  resetKey: string,
): RateWindow | undefined {
  const limit = Number(headers.get(limitKey));
  const remaining = Number(headers.get(remainingKey));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || headers.get(limitKey) === null) {
    return undefined;
  }
  return { limit, remaining, reset: headers.get(resetKey) ?? undefined };
}

/**
 * Normalizes rate-limit response headers across providers.
 * OpenAI and Groq use x-ratelimit-*; Anthropic uses anthropic-ratelimit-*;
 * Google sends none (returns undefined).
 */
export function parseRateLimitHeaders(headers: Headers): ProviderLimits | undefined {
  const requests =
    windowFrom(
      headers,
      "x-ratelimit-limit-requests",
      "x-ratelimit-remaining-requests",
      "x-ratelimit-reset-requests",
    ) ??
    windowFrom(
      headers,
      "anthropic-ratelimit-requests-limit",
      "anthropic-ratelimit-requests-remaining",
      "anthropic-ratelimit-requests-reset",
    );
  const tokens =
    windowFrom(
      headers,
      "x-ratelimit-limit-tokens",
      "x-ratelimit-remaining-tokens",
      "x-ratelimit-reset-tokens",
    ) ??
    windowFrom(
      headers,
      "anthropic-ratelimit-tokens-limit",
      "anthropic-ratelimit-tokens-remaining",
      "anthropic-ratelimit-tokens-reset",
    );
  if (!requests && !tokens) return undefined;
  return { requests, tokens, capturedAt: Date.now() };
}

const globalStore = globalThis as unknown as {
  __providerLimits?: Map<string, ProviderLimits>;
};

function store(): Map<string, ProviderLimits> {
  globalStore.__providerLimits ??= new Map();
  return globalStore.__providerLimits;
}

export function getAllLimits(): Record<string, ProviderLimits> {
  return Object.fromEntries(store());
}

/**
 * fetch wrapper for AI SDK providers: records rate-limit headers from every
 * upstream response (success or 429) into the in-memory store.
 */
export function limitsRecordingFetch(providerId: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    const limits = parseRateLimitHeaders(response.headers);
    if (limits) store().set(providerId, limits);
    return response;
  };
}
