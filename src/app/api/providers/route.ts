import { connection, NextResponse } from "next/server";
import { listProviders } from "@/lib/providers";

export async function GET() {
  // Availability depends on runtime env vars — never prerender this.
  await connection();
  return NextResponse.json({ providers: listProviders() });
}
