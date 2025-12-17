import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-compatible config (no database adapter)
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public routes
      const isPublicRoute = pathname === "/";
      const isAuthRoute = pathname.startsWith("/auth");
      const isApiAuthRoute = pathname.startsWith("/api/auth");

      // Allow auth API routes
      if (isApiAuthRoute) {
        return true;
      }

      // Redirect logged-in users away from auth pages
      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL("/chat", nextUrl));
      }

      // Allow public routes and auth pages
      if (isPublicRoute || isAuthRoute) {
        return true;
      }

      // Protect all other routes
      return isLoggedIn;
    },
  },
};
