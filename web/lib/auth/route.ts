import { NextResponse } from "next/server";
import { getRequestContext, type RequestContext } from "./context";

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor(message = "unauthenticated") {
    super(message);
  }
}

// Throws UnauthenticatedError if the caller has no session or no org
// membership. Route handlers call this at the top and let the outer
// try/catch turn it into a 401 via `errorResponse`.
export async function requireContext(): Promise<RequestContext> {
  const ctx = await getRequestContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}

export function errorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Unknown error";
  const rawStatus =
    err && typeof err === "object" && "status" in err
      ? (err as { status: unknown }).status
      : undefined;
  const status =
    typeof rawStatus === "number"
      ? rawStatus
      : message.includes("not found")
        ? 404
        : 500;
  return NextResponse.json({ error: message }, { status });
}
