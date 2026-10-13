import { z } from "zod";

const stdioTransportSchema = z.object({
  type: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const httpTransportSchema = z.object({
  type: z.enum(["http", "sse"]),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const serverSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  name: z.string().min(1),
  description: z.string().default(""),
  enabled: z.boolean().default(true),
  transport: z.discriminatedUnion("type", [
    stdioTransportSchema,
    httpTransportSchema,
  ]),
  /** Whitelist of tool names exposed to the model. Omit to expose all. */
  allowedTools: z.array(z.string()).optional(),
});

const configSchema = z.object({
  $schema: z.string().optional(),
  servers: z.array(serverSchema),
});

export type McpServerConfig = z.infer<typeof serverSchema>;
export type McpConfig = z.infer<typeof configSchema>;

const ENV_VAR_PATTERN = /\$\{([A-Z0-9_]+)\}/g;

/**
 * Replaces ${VAR} placeholders with values from `env`.
 * Returns undefined if any referenced variable is missing,
 * so callers can drop optional entries (e.g. auth headers) cleanly.
 */
export function interpolateEnv(
  value: string,
  env: Record<string, string | undefined>,
): string | undefined {
  let missing = false;
  const result = value.replace(ENV_VAR_PATTERN, (_, name: string) => {
    const v = env[name];
    if (v === undefined || v === "") {
      missing = true;
      return "";
    }
    return v;
  });
  return missing ? undefined : result;
}

/**
 * Resolves env placeholders in a server config.
 * - http headers referencing missing vars are dropped (optional auth);
 * - stdio env entries referencing missing vars are dropped;
 * - a missing var in command/args/url is an error (can't run without it).
 */
export function resolveServerConfig(
  server: McpServerConfig,
  env: Record<string, string | undefined> = process.env,
): McpServerConfig {
  const t = server.transport;
  if (t.type === "stdio") {
    const command = interpolateEnv(t.command, env);
    if (command === undefined) {
      throw new Error(
        `MCP server "${server.id}": missing env var in command "${t.command}"`,
      );
    }
    const args = (t.args ?? []).map((a) => {
      const resolved = interpolateEnv(a, env);
      if (resolved === undefined) {
        throw new Error(
          `MCP server "${server.id}": missing env var in arg "${a}"`,
        );
      }
      return resolved;
    });
    const resolvedEnv = t.env
      ? Object.fromEntries(
          Object.entries(t.env).flatMap(([k, v]) => {
            const r = interpolateEnv(v, env);
            return r === undefined ? [] : [[k, r] as const];
          }),
        )
      : undefined;
    return { ...server, transport: { ...t, command, args, env: resolvedEnv } };
  }

  const url = interpolateEnv(t.url, env);
  if (url === undefined) {
    throw new Error(
      `MCP server "${server.id}": missing env var in url "${t.url}"`,
    );
  }
  const headers = t.headers
    ? Object.fromEntries(
        Object.entries(t.headers).flatMap(([k, v]) => {
          const r = interpolateEnv(v, env);
          return r === undefined ? [] : [[k, r] as const];
        }),
      )
    : undefined;
  return { ...server, transport: { ...t, url, headers } };
}

export function parseMcpConfig(json: unknown): McpConfig {
  const parsed = configSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid mcp.config.json: ${parsed.error.message}`);
  }
  const ids = parsed.data.servers.map((s) => s.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    throw new Error(`Duplicate MCP server ids: ${[...new Set(dupes)].join(", ")}`);
  }
  return parsed.data;
}
