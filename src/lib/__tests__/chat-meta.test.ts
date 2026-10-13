import { describe, expect, it } from "vitest";
import { parseRetryDelaySeconds } from "../chat-meta";
import { chatToMarkdown } from "../export";
import type { UIMessage } from "ai";

describe("parseRetryDelaySeconds", () => {
  it("parses Groq seconds format", () => {
    expect(parseRetryDelaySeconds("Please try again in 7.66s.")).toBe(8);
  });
  it("parses minutes+seconds", () => {
    expect(parseRetryDelaySeconds("try again in 2m59.56s")).toBe(180);
  });
  it("parses Gemini hours format", () => {
    expect(parseRetryDelaySeconds("Please retry in 15h45m21.04s.")).toBe(15 * 3600 + 45 * 60 + 22);
  });
  it("returns null when no delay present", () => {
    expect(parseRetryDelaySeconds("Invalid API key")).toBeNull();
  });
});

describe("chatToMarkdown", () => {
  it("serializes text, tool calls and reasoning", () => {
    const messages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Питання" }] },
      {
        id: "2",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "думка", state: "done" },
          {
            type: "dynamic-tool",
            toolName: "fs__read",
            toolCallId: "c1",
            state: "output-available",
            input: { path: "a.md" },
            output: { ok: true },
          },
          { type: "text", text: "Відповідь" },
        ],
      },
    ] as unknown as UIMessage[];

    const md = chatToMarkdown("Тест", messages);
    expect(md).toContain("# Тест");
    expect(md).toContain("## 👤 Користувач");
    expect(md).toContain("Питання");
    expect(md).toContain("💭 _думка_");
    expect(md).toContain("🔧 **fs__read**");
    expect(md).toContain('"path": "a.md"');
    expect(md).toContain("Відповідь");
  });
});
