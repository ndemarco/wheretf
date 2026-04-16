import { NextResponse } from "next/server";

// Liveness probe. Returns 200 as long as the Node process is servicing
// HTTP — does not talk to Postgres. Use /api/health/ready for a full
// readiness check.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
