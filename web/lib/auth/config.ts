import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/connection";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { orgs, userOrgs } from "@/db/schema/orgs";

const isProd = process.env.NODE_ENV === "production";
// Escape hatch so a production build can still expose the dev-impersonate
// provider when explicitly opted in. Intended for the staging/preview
// environments during early testing; must not be set in real production.
const allowDevImpersonate =
  !isProd || process.env.ALLOW_DEV_IMPERSONATE === "1";

const homelabIssuer = process.env.AUTH_HOMELAB_ISSUER;
const homelabClientId = process.env.AUTH_HOMELAB_CLIENT_ID;
const homelabClientSecret = process.env.AUTH_HOMELAB_CLIENT_SECRET;

const providers: NextAuthConfig["providers"] = [
  Credentials({
    id: "credentials",
    name: "Email & password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (raw) => {
      const email = typeof raw?.email === "string" ? raw.email.toLowerCase() : null;
      const password = typeof raw?.password === "string" ? raw.password : null;
      if (!email || !password) return null;
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user?.passwordHash) return null;
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

if (homelabIssuer && homelabClientId && homelabClientSecret) {
  providers.push({
    id: "homelab",
    name: "Homelab IdP",
    type: "oidc",
    issuer: homelabIssuer,
    clientId: homelabClientId,
    clientSecret: homelabClientSecret,
  });
}

if (allowDevImpersonate) {
  providers.push(
    Credentials({
      id: "dev-impersonate",
      name: "Dev impersonate",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
        isAdmin: { label: "Admin", type: "text" },
        plan: { label: "Plan", type: "text" },
      },
      authorize: async (raw) => {
        const email = typeof raw?.email === "string" ? raw.email.toLowerCase() : null;
        const displayName = typeof raw?.name === "string" && raw.name ? raw.name : null;
        const isAdmin = raw?.isAdmin === "true";
        if (!email) return null;

        // Preset dev personas (Drew/Sam/Jules) are pre-seeded with org
        // memberships by db/seed.ts. Lookup-only path preserves their
        // seeded isAdmin + role.
        let [user] = await db.select().from(users).where(eq(users.email, email));
        if (user) {
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        }

        // Fallback for unseeded emails (free-form impersonate): create
        // the user and a solo org so switching lands somewhere non-empty.
        [user] = await db
          .insert(users)
          .values({ email, name: displayName ?? email.split("@")[0], isAdmin })
          .returning();
        const slug = `org-${user.id.slice(0, 8)}`;
        const [org] = await db
          .insert(orgs)
          .values({ name: `${user.name}'s workspace`, slug, plan: "free" })
          .returning({ id: orgs.id });
        await db
          .insert(userOrgs)
          .values({ userId: user.id, orgId: org.id, role: "admin" });

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // jwt fires after the adapter has written the user row, making it the
    // correct place to provision the default org. signIn fires before the
    // adapter for OIDC providers, so user_id FK constraints fail there.
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        const existing = await db
          .select({ orgId: userOrgs.orgId })
          .from(userOrgs)
          .where(eq(userOrgs.userId, user.id))
          .limit(1);
        if (existing.length === 0) {
          const displayName = user.name ?? user.email?.split("@")[0] ?? "workspace";
          const slug = `org-${user.id.slice(0, 8)}`;
          const [org] = await db
            .insert(orgs)
            .values({ name: `${displayName}'s workspace`, slug, plan: "free" })
            .returning({ id: orgs.id });
          await db
            .insert(userOrgs)
            .values({ userId: user.id, orgId: org.id, role: "owner" });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
