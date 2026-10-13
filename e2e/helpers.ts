import type { Page } from "@playwright/test";

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
};

function sse(chunks: object[]): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
}

/** Canned assistant turn: one dynamic tool call + markdown text. */
export function chatStreamBody(): string {
  const toolCallId = "call_e2e_1";
  return sse([
    { type: "start" },
    { type: "start-step" },
    {
      type: "tool-input-start",
      toolCallId,
      toolName: "filesystem__list_directory",
      dynamic: true,
    },
    {
      type: "tool-input-available",
      toolCallId,
      toolName: "filesystem__list_directory",
      input: { path: "sandbox" },
      dynamic: true,
    },
    {
      type: "tool-output-available",
      toolCallId,
      output: { content: [{ type: "text", text: "notes.md\nteam.json" }] },
      dynamic: true,
    },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: "У папці **два файли**: notes.md і team.json." },
    { type: "text-end", id: "t1" },
    { type: "finish-step" },
    { type: "finish" },
  ]);
}

export interface MockServerStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  state: string;
  error?: string;
  toolNames: string[];
}

export const MOCK_SERVERS: MockServerStatus[] = [
  {
    id: "filesystem",
    name: "Filesystem (read-only)",
    description: "Читання файлів у тестовій папці.",
    enabled: true,
    state: "connected",
    toolNames: ["read_text_file", "list_directory"],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Пошук по репозиторіях.",
    enabled: true,
    state: "error",
    error: "HTTP 401: missing Authorization header",
    toolNames: [],
  },
];

/** Hermetic API mocks: no LLM keys, no MCP servers, no quotas involved. */
export async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/providers", (route) =>
    route.fulfill({
      json: {
        providers: [
          { id: "google", label: "Gemini", model: "gemini-test", available: true },
          { id: "openai", label: "OpenAI", model: "gpt-test", available: false },
        ],
      },
    }),
  );

  await page.route("**/api/mcp**", (route) => {
    if (route.request().method() === "PATCH") {
      const { id, enabled } = route.request().postDataJSON() as {
        id: string;
        enabled: boolean;
      };
      const servers = MOCK_SERVERS.map((s) =>
        s.id === id ? { ...s, enabled, state: enabled ? "connected" : "disabled" } : s,
      );
      return route.fulfill({ json: { servers } });
    }
    return route.fulfill({ json: { servers: MOCK_SERVERS } });
  });

  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 200, headers: SSE_HEADERS, body: chatStreamBody() }),
  );
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByPlaceholder(/Спитай щось/).fill(text);
  await page.keyboard.press("Enter");
}
