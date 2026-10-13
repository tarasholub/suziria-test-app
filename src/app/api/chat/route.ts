import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { getMcpManager } from "@/lib/mcp/manager";
import { getModel } from "@/lib/providers";

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to tools from connected MCP servers.

Guidelines:
- Tool names are prefixed with the server id, e.g. "fetch__fetch" is the "fetch" tool of the "fetch" server.
- When the user asks about a web page or URL, use the fetch tools.
- When asked about library documentation or APIs, use Context7 tools (resolve the library id first, then fetch docs).
- For complex multi-step problems, use the sequential thinking tool to plan before answering.
- For questions about GitHub repositories, issues or pull requests, use the GitHub tools.
- For questions about local files, use the filesystem tools (restricted to the sandbox folder).
- If a tool call fails, explain the failure briefly and continue with what you know. Never invent tool output.
- Format math as plain text (use ^ and /), not LaTeX.
- Answer in the language the user writes in.`;

interface ChatRequestBody {
  messages: UIMessage[];
  providerId?: string;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const providerId = body.providerId ?? "google";

  let model;
  try {
    model = getModel(providerId);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Provider error" },
      { status: 400 },
    );
  }

  // A failing MCP server is excluded here instead of crashing the chat;
  // its error is visible in the MCP panel via /api/mcp.
  const tools = await getMcpManager().getTools();

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(body.messages),
    tools,
    stopWhen: stepCountIs(10),
    providerOptions: {
      // Reasoning summaries: each provider reads only its own key.
      // OpenAI returns summaries only for identity-verified orgs — harmless otherwise.
      openai: { reasoningEffort: "low", reasoningSummary: "auto" },
      // gpt-oss on Groq emits reasoning; "parsed" turns it into reasoning parts.
      groq: { reasoningFormat: "parsed", reasoningEffort: "low" },
    },
    // 2 retries ride out per-minute rate limits (429); more would burn tiny daily quotas.
    maxRetries: 2,
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) =>
      part.type === "finish"
        ? {
            usage: {
              inputTokens: part.totalUsage.inputTokens,
              outputTokens: part.totalUsage.outputTokens,
            },
          }
        : undefined,
    onError: (error) =>
      error instanceof Error ? error.message : "Сталася помилка під час генерації відповіді.",
  });
}
