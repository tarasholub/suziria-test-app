import { connection, NextResponse } from "next/server";
import { getAllLimits } from "@/lib/limits";

export async function GET() {
  await connection();
  return NextResponse.json({ limits: getAllLimits() });
}
