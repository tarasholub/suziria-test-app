import { readFileSync } from "node:fs";
import path from "node:path";
import {
  experimental_createMCPClient as createMCPClient,
  type MCPClient,
} from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { ToolSet } from "ai";
import { TOOL_SEPARATOR } from "./shared";
import {
  parseMcpConfig,
  resolveServerConfig,
  type McpServerConfig,
} from "./config";

export type McpServerState = "connected" | "connecting" | "error" | "disabled";

export interface McpServerStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  state: McpServerState;
  error?: string;
  toolNames: string[];
}

interface ServerRuntime {
  config: McpServerConfig;
  enabled: boolean;
  client?: MCPClient;
  tools?: ToolSet;
  state: McpServerState;
  error?: string;
  lastAttemptAt: number;
}

const CONNECT_TIMEOUT_MS = 15_000;
const RETRY_COOLDOWN_MS = 30_000;

export { TOOL_SEPARATOR } from "./shared";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}: timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export class McpManager {
  private servers = new Map<string, ServerRuntime>();
  private connecting = new Map<string, Promise<void>>();

  constructor(configs: McpServerConfig[]) {
    for (const config of configs) {
      this.servers.set(config.id, {
        config,
        enabled: config.enabled,
        state: config.enabled ? "connecting" : "disabled",
        lastAttemptAt: 0,
      });
    }
  }

  static fromFile(filePath?: string): McpManager {
    const resolved = filePath ?? path.join(process.cwd(), "mcp.config.json");
    const raw: unknown = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ resolved, "utf8"),
    );
    return new McpManager(parseMcpConfig(raw).servers);
  }

  private async connect(rt: ServerRuntime): Promise<void> {
    const existing = this.connecting.get(rt.config.id);
    if (existing) return existing;

    const task = (async () => {
      rt.state = "connecting";
      rt.error = undefined;
      rt.lastAttemptAt = Date.now();
      try {
        const resolved = resolveServerConfig(rt.config);
        const t = resolved.transport;
        const client = await withTimeout(
          createMCPClient({
            transport:
              t.type === "stdio"
                ? new StdioMCPTransport({
                    command: t.command,
                    args: t.args,
                    env: t.env,
                  })
                : { type: t.type, url: t.url, headers: t.headers },
            // Legacy stdio servers reject the server/discover probe noisily.
            protocolVersionDiscovery: false,
            onUncaughtError: (error) => {
              if (rt.state !== "connected") {
                rt.state = "error";
                rt.error = errorMessage(error);
              }
            },
          }),
          CONNECT_TIMEOUT_MS,
          `connect ${rt.config.id}`,
        );
        const allTools = await withTimeout(
          client.tools(),
          CONNECT_TIMEOUT_MS,
          `list tools ${rt.config.id}`,
        );
        const allowed = resolved.allowedTools;
        const tools: ToolSet = Object.fromEntries(
          Object.entries(allTools).filter(
            ([name]) => !allowed || allowed.includes(name),
          ),
        );
        rt.client = client;
        rt.tools = tools;
        rt.state = "connected";
        rt.error = undefined;
      } catch (e) {
        rt.state = "error";
        rt.error = errorMessage(e);
        await this.closeClient(rt);
      } finally {
        this.connecting.delete(rt.config.id);
      }
    })();

    this.connecting.set(rt.config.id, task);
    return task;
  }

  private async closeClient(rt: ServerRuntime): Promise<void> {
    const client = rt.client;
    rt.client = undefined;
    rt.tools = undefined;
    if (client) {
      try {
        await client.close();
      } catch {
        // already dead — nothing to do
      }
    }
  }

  /** Connects every enabled server that isn't connected yet (errors retried after a cooldown). */
  private async ensureConnections(force = false): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const rt of this.servers.values()) {
      if (!rt.enabled) continue;
      if (rt.state === "connected" && rt.client) continue;
      const retryable =
        force || rt.state === "connecting" || rt.lastAttemptAt === 0 ||
        Date.now() - rt.lastAttemptAt > RETRY_COOLDOWN_MS;
      if (retryable) tasks.push(this.connect(rt));
    }
    await Promise.allSettled(tasks);
  }

  async getStatuses(options?: { refresh?: boolean }): Promise<McpServerStatus[]> {
    await this.ensureConnections(options?.refresh ?? false);
    return [...this.servers.values()].map((rt) => ({
      id: rt.config.id,
      name: rt.config.name,
      description: rt.config.description,
      enabled: rt.enabled,
      state: rt.enabled ? rt.state : "disabled",
      error: rt.enabled && rt.state === "error" ? rt.error : undefined,
      toolNames: Object.keys(rt.tools ?? {}),
    }));
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const rt = this.servers.get(id);
    if (!rt) throw new Error(`Unknown MCP server: ${id}`);
    rt.enabled = enabled;
    if (!enabled) {
      rt.state = "disabled";
      rt.error = undefined;
      await this.closeClient(rt);
    } else {
      rt.state = "connecting";
      rt.lastAttemptAt = 0;
      await this.connect(rt);
    }
  }

  /**
   * Combined tool set across connected servers, keyed `${serverId}__${toolName}`
   * so tool calls in the UI can be attributed to a server and names never collide.
   * A server in error state is simply excluded — the chat keeps working.
   */
  async getTools(): Promise<ToolSet> {
    await this.ensureConnections();
    const combined: ToolSet = {};
    for (const rt of this.servers.values()) {
      if (!rt.enabled || rt.state !== "connected" || !rt.tools) continue;
      for (const [name, tool] of Object.entries(rt.tools)) {
        combined[`${rt.config.id}${TOOL_SEPARATOR}${name}`] = tool;
      }
    }
    return combined;
  }
}

// Survive Next.js dev HMR / route re-evaluation with a global singleton.
const globalStore = globalThis as unknown as { __mcpManager?: McpManager };

export function getMcpManager(): McpManager {
  globalStore.__mcpManager ??= McpManager.fromFile();
  return globalStore.__mcpManager;
}
