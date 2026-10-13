import { beforeEach, describe, expect, it, vi } from "vitest";

const createMCPClientMock = vi.fn();

vi.mock("@ai-sdk/mcp", () => ({
  experimental_createMCPClient: (...args: unknown[]) => createMCPClientMock(...args),
}));
vi.mock("@ai-sdk/mcp/mcp-stdio", () => ({
  Experimental_StdioMCPTransport: class {
    constructor(public config: unknown) {}
  },
}));

import { McpManager } from "../manager";
import type { McpServerConfig } from "../config";

function server(id: string, overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id,
    name: id,
    description: "",
    enabled: true,
    transport: { type: "stdio", command: "noop" },
    ...overrides,
  };
}

function fakeClient(toolNames: string[]) {
  return {
    tools: vi.fn(async () =>
      Object.fromEntries(toolNames.map((n) => [n, { description: n }])),
    ),
    close: vi.fn(async () => {}),
  };
}

beforeEach(() => {
  createMCPClientMock.mockReset();
});

describe("McpManager", () => {
  it("merges tools from connected servers with server-id prefixes", async () => {
    createMCPClientMock
      .mockResolvedValueOnce(fakeClient(["fetch"]))
      .mockResolvedValueOnce(fakeClient(["search_issues"]));

    const manager = new McpManager([server("fetch"), server("github")]);
    const tools = await manager.getTools();

    expect(Object.keys(tools).sort()).toEqual(["fetch__fetch", "github__search_issues"]);
  });

  it("filters tools through allowedTools (read-only filesystem)", async () => {
    createMCPClientMock.mockResolvedValueOnce(
      fakeClient(["read_text_file", "write_file", "list_directory"]),
    );

    const manager = new McpManager([
      server("filesystem", { allowedTools: ["read_text_file", "list_directory"] }),
    ]);
    const tools = await manager.getTools();

    expect(Object.keys(tools).sort()).toEqual([
      "filesystem__list_directory",
      "filesystem__read_text_file",
    ]);
  });

  it("keeps working when one server fails to connect", async () => {
    createMCPClientMock
      .mockRejectedValueOnce(new Error("spawn uvx ENOENT"))
      .mockResolvedValueOnce(fakeClient(["fetch"]));

    const manager = new McpManager([server("broken"), server("fetch")]);
    const tools = await manager.getTools();
    expect(Object.keys(tools)).toEqual(["fetch__fetch"]);

    const statuses = await manager.getStatuses();
    const broken = statuses.find((s) => s.id === "broken");
    expect(broken?.state).toBe("error");
    expect(broken?.error).toMatch(/ENOENT/);
    expect(statuses.find((s) => s.id === "fetch")?.state).toBe("connected");
  });

  it("disabling a server closes its client and removes its tools", async () => {
    const client = fakeClient(["fetch"]);
    createMCPClientMock.mockResolvedValue(client);

    const manager = new McpManager([server("fetch")]);
    await manager.getTools();

    await manager.setEnabled("fetch", false);
    expect(client.close).toHaveBeenCalled();
    expect(await manager.getTools()).toEqual({});

    const statuses = await manager.getStatuses();
    expect(statuses[0].state).toBe("disabled");
  });

  it("disabled-in-config servers are not connected", async () => {
    const manager = new McpManager([server("playwright", { enabled: false })]);
    expect(await manager.getTools()).toEqual({});
    expect(createMCPClientMock).not.toHaveBeenCalled();

    const statuses = await manager.getStatuses();
    expect(statuses[0].state).toBe("disabled");
  });

  it("rejects toggling an unknown server", async () => {
    const manager = new McpManager([]);
    await expect(manager.setEnabled("nope", true)).rejects.toThrow(/Unknown MCP server/);
  });
});

describe("tool output truncation", () => {
  it("truncates oversized text parts and drops structuredContent", async () => {
    const bigText = "x".repeat(20_000);
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({
        search: {
          description: "search",
          execute: async () => ({
            content: [{ type: "text", text: bigText }],
            structuredContent: { huge: bigText },
            isError: false,
          }),
        },
      })),
      close: vi.fn(async () => {}),
    });

    const manager = new McpManager([server("github")]);
    const tools = await manager.getTools();
    const tool = tools["github__search"] as {
      execute: (input: unknown, opts: unknown) => Promise<{
        content: { text: string }[];
        structuredContent?: unknown;
      }>;
    };
    const result = await tool.execute({}, {});

    expect(result.content[0].text.length).toBeLessThan(6_200);
    expect(result.content[0].text).toContain("[truncated");
    expect(result.structuredContent).toBeUndefined();
  });

  it("leaves small results untouched", async () => {
    createMCPClientMock.mockResolvedValueOnce({
      tools: vi.fn(async () => ({
        ping: { description: "ping", execute: async () => ({ content: [{ type: "text", text: "pong" }] }) },
      })),
      close: vi.fn(async () => {}),
    });

    const manager = new McpManager([server("t")]);
    const tools = await manager.getTools();
    const tool = tools["t__ping"] as {
      execute: (i: unknown, o: unknown) => Promise<{ content: { text: string }[] }>;
    };
    const result = await tool.execute({}, {});
    expect(result.content[0].text).toBe("pong");
  });
});
