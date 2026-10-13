import { NextRequest, NextResponse } from "next/server";
import { getMcpManager } from "@/lib/mcp/manager";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const statuses = await getMcpManager().getStatuses({ refresh });
  return NextResponse.json({ servers: statuses });
}

export async function PATCH(req: NextRequest) {
  const body: unknown = await req.json();
  const { id, enabled } = body as { id?: string; enabled?: boolean };
  if (typeof id !== "string" || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "Expected body { id: string, enabled: boolean }" },
      { status: 400 },
    );
  }
  try {
    await getMcpManager().setEnabled(id, enabled);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Toggle failed" },
      { status: 404 },
    );
  }
  const statuses = await getMcpManager().getStatuses();
  return NextResponse.json({ servers: statuses });
}
