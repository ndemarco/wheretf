import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// Next.js 16 proxy - replaces middleware
// Auth check using NextAuth's authorized callback
export async function proxy(request: NextRequest) {
  return auth(request as unknown as Parameters<typeof auth>[0]);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
