import { describe, expect, it } from "vitest";
import {
  interpolateEnv,
  parseMcpConfig,
  resolveServerConfig,
  type McpServerConfig,
} from "../config";

describe("interpolateEnv", () => {
  it("replaces placeholders with env values", () => {
    expect(interpolateEnv("Bearer ${TOKEN}", { TOKEN: "abc" })).toBe("Bearer abc");
  });

  it("returns undefined when a variable is missing or empty", () => {
    expect(interpolateEnv("Bearer ${TOKEN}", {})).toBeUndefined();
    expect(interpolateEnv("Bearer ${TOKEN}", { TOKEN: "" })).toBeUndefined();
  });

  it("leaves plain strings untouched", () => {
    expect(interpolateEnv("uvx", {})).toBe("uvx");
  });
});

describe("parseMcpConfig", () => {
  const validServer = {
    id: "fetch",
    name: "Fetch",
    transport: { type: "stdio", command: "uvx", args: ["mcp-server-fetch"] },
  };

  it("parses a valid config and applies defaults", () => {
    const config = parseMcpConfig({ servers: [validServer] });
    expect(config.servers).toHaveLength(1);
    expect(config.servers[0].enabled).toBe(true);
    expect(config.servers[0].description).toBe("");
  });

  it("rejects duplicate server ids", () => {
    expect(() =>
      parseMcpConfig({ servers: [validServer, validServer] }),
    ).toThrow(/Duplicate/);
  });

  it("rejects unknown transport types", () => {
    expect(() =>
      parseMcpConfig({
        servers: [{ ...validServer, transport: { type: "websocket", url: "x" } }],
      }),
    ).toThrow(/Invalid mcp.config.json/);
  });

  it("rejects non-kebab-case ids", () => {
    expect(() =>
      parseMcpConfig({ servers: [{ ...validServer, id: "My Server" }] }),
    ).toThrow(/Invalid mcp.config.json/);
  });
});

describe("resolveServerConfig", () => {
  const httpServer: McpServerConfig = {
    id: "github",
    name: "GitHub",
    description: "",
    enabled: true,
    transport: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      headers: { Authorization: "Bearer ${GITHUB_TOKEN}" },
    },
  };

  it("resolves headers from env", () => {
    const resolved = resolveServerConfig(httpServer, { GITHUB_TOKEN: "ghp_x" });
    expect(resolved.transport).toMatchObject({
      headers: { Authorization: "Bearer ghp_x" },
    });
  });

  it("drops headers whose env vars are missing (optional auth)", () => {
    const resolved = resolveServerConfig(httpServer, {});
    const t = resolved.transport;
    expect(t.type).toBe("http");
    if (t.type === "http") expect(t.headers).toEqual({});
  });

  it("throws when the url references a missing var", () => {
    const server: McpServerConfig = {
      ...httpServer,
      transport: { type: "http", url: "https://${HOST}/mcp" },
    };
    expect(() => resolveServerConfig(server, {})).toThrow(/missing env var/);
  });

  it("throws when a stdio arg references a missing var", () => {
    const server: McpServerConfig = {
      id: "fs",
      name: "FS",
      description: "",
      enabled: true,
      transport: { type: "stdio", command: "npx", args: ["${SANDBOX_DIR}"] },
    };
    expect(() => resolveServerConfig(server, {})).toThrow(/missing env var/);
  });
});
