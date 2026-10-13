import { NextResponse } from "next/server";

// Availability depends on runtime env vars — never prerender this.
export const dynamic = "force-dynamic";
import { listProviders } from "@/lib/providers";

export function GET() {
  return NextResponse.json({ providers: listProviders() });
}
