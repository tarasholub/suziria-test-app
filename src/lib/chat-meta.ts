/** Metadata attached to assistant messages by the chat route. */
export interface ChatMessageMetadata {
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

/**
 * Parses "Please retry in 15h45m21.04s" / "try again in 7.66s" (Gemini/Groq
 * quota errors) into seconds. Returns null when the message has no delay.
 */
export function parseRetryDelaySeconds(message: string): number | null {
  const m = message.match(/(?:retry|try again) in\s+((?:[\d.]+h)?(?:[\d.]+m)?(?:[\d.]+m?s)?)/i);
  if (!m || !m[1]) return null;
  const h = /([\d.]+)h/.exec(m[1])?.[1];
  const min = /([\d.]+)m(?!s)/.exec(m[1])?.[1];
  const sec = /([\d.]+)s/.exec(m[1])?.[1];
  if (!h && !min && !sec) return null;
  const total = Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(sec ?? 0);
  return Number.isFinite(total) && total > 0 ? Math.ceil(total) : null;
}
