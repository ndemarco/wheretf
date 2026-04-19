import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/connection";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

const isProd = process.env.NODE_ENV === "production";

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

if (!isProd) {
  providers.push(
    Credentials({
      id: "dev-impersonate",
      name: "Dev impersonate",
      credentials: { email: { label: "Email", type: "email" } },
      authorize: async (raw) => {
        const email = typeof raw?.email === "string" ? raw.email.toLowerCase() : null;
        if (!email) return null;
        let [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) {
          [user] = await db
            .insert(users)
            .values({ email, name: email.split("@")[0] })
            .returning();
        }
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
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
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
