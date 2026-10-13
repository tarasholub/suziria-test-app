import { describe, expect, it } from "vitest";
import { parseRateLimitHeaders } from "../limits";

describe("parseRateLimitHeaders", () => {
  it("parses OpenAI/Groq style x-ratelimit headers", () => {
    const h = new Headers({
      "x-ratelimit-limit-requests": "1000",
      "x-ratelimit-remaining-requests": "997",
      "x-ratelimit-reset-requests": "2m59s",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7100",
      "x-ratelimit-reset-tokens": "7.66s",
    });
    const l = parseRateLimitHeaders(h);
    expect(l?.requests).toMatchObject({ limit: 1000, remaining: 997, reset: "2m59s" });
    expect(l?.tokens).toMatchObject({ limit: 8000, remaining: 7100, reset: "7.66s" });
  });

  it("parses Anthropic style headers", () => {
    const h = new Headers({
      "anthropic-ratelimit-requests-limit": "50",
      "anthropic-ratelimit-requests-remaining": "49",
      "anthropic-ratelimit-tokens-limit": "40000",
      "anthropic-ratelimit-tokens-remaining": "39000",
    });
    const l = parseRateLimitHeaders(h);
    expect(l?.requests).toMatchObject({ limit: 50, remaining: 49 });
    expect(l?.tokens).toMatchObject({ limit: 40000, remaining: 39000 });
  });

  it("returns undefined when no rate-limit headers present (Google)", () => {
    expect(parseRateLimitHeaders(new Headers({ "content-type": "text/event-stream" }))).toBeUndefined();
  });

  it("handles partial headers (requests only)", () => {
    const h = new Headers({
      "x-ratelimit-limit-requests": "100",
      "x-ratelimit-remaining-requests": "1",
    });
    const l = parseRateLimitHeaders(h);
    expect(l?.requests?.remaining).toBe(1);
    expect(l?.tokens).toBeUndefined();
  });
});
