import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";

// Gate signed-in-only pages and API routes. Identity comes from the JWT
// session; org/role hydration happens inside each route via
// `getRequestContext()` so middleware stays edge-safe (no DB calls).
const PUBLIC_API = [/^\/api\/health(\/|$)/, /^\/api\/auth(\/|$)/];
const PUBLIC_PAGE = [/^\/login(\/|$)/, /^\/signup(\/|$)/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.some((re) => re.test(pathname))) return NextResponse.next();
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (PUBLIC_PAGE.some((re) => re.test(pathname))) return NextResponse.next();

  const session = await auth();
  if (!session?.user?.id) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\..*).*)",
  ],
};
