import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb-client";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      async authorize(credentials) {
        const { email, password } = credentials;

        // Connect to DB - verify this helper exists or use mongoose directly
        // Given we are using mongoose models, we should ensure connection
        const { User } = await import("@/lib/models/User");
        // We might need to ensure connection is established. 
        // clientPromise is for the Adapter, but User model uses Mongoose connection.
        // Let's rely on standard mongoose connection behavior or add a connect helper if needed.
        // For now, let's assume we need to connect.
        const mongoose = await import("mongoose");
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGODB_URI!);
        }

        const user = await User.findOne({ email }).select("+password");
        if (!user) return null;
        if (!user.password) return null;

        const passwordsMatch = await compare(password as string, user.password);
        if (passwordsMatch) return user;

        return null;
      },
    }),
  ],
  adapter: MongoDBAdapter(clientPromise),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Add user data to JWT on sign in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "user";
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data from JWT to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
