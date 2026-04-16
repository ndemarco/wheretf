import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/connection";

// Readiness probe. Performs a trivial round-trip against Postgres so
// the deploy system can gate rolling deploys on actual DB connectivity
// rather than mere process existence.
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ready" });
  } catch (err) {
    return NextResponse.json(
      {
        status: "not_ready",
        reason: err instanceof Error ? err.message : "db check failed",
      },
      { status: 503 }
    );
  }
}
