import { cookies, headers } from "next/headers";

// Auth.js writes a double-submit CSRF cookie at /api/auth/csrf. Mutation
// routes assert the header matches the cookie before proceeding. GET-shaped
// requests and Auth.js's own endpoints are exempt; call this from any
// non-/api/auth POST/PATCH/PUT/DELETE handler.
export async function requireCsrf(): Promise<void> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookie =
    cookieStore.get("__Host-authjs.csrf-token") ??
    cookieStore.get("authjs.csrf-token");
  const token = headerStore.get("x-csrf-token");

  if (!cookie || !token) throw new CsrfError("missing csrf token");

  // Auth.js stores `${token}|${hash}` — compare the token half.
  const cookieToken = cookie.value.split("|")[0];
  if (cookieToken !== token) throw new CsrfError("csrf token mismatch");
}

export class CsrfError extends Error {
  readonly status = 403;
}
