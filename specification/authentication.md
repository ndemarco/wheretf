# Authentication

## Overview

Authentication uses NextAuth.js (Auth.js) with Google as the OAuth provider. Users must sign in to access the application.

## Tech Stack

- **NextAuth.js v5** (Auth.js) - Authentication framework for Next.js
- **Google OAuth** - Identity provider
- **MongoDB** - Session and user storage (via NextAuth MongoDB adapter)

## User Data Model

```javascript
// schemas/User.js
// NextAuth manages most of this, but we extend with app-specific fields

const userSchema = new Schema({
  // NextAuth managed fields
  name: String,
  email: {
    type: String,
    required: true,
    unique: true
  },
  emailVerified: Date,
  image: String,              // Google profile image

  // App-specific fields
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  settings: {
    defaultModel: {
      type: String,
      default: 'gpt-4o'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  },
  lastActive: Date
}, { timestamps: true });
```

## NextAuth Configuration

```javascript
// lib/auth.js
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  ],
  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      session.user.id = user.id;
      session.user.role = user.role || 'user';
      return session;
    },
    async signIn({ user, account, profile }) {
      // Optional: restrict to specific domains
      // if (!profile.email.endsWith('@yourdomain.com')) {
      //   return false;
      // }
      return true;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
});
```

## Environment Variables

```bash
# .env.local

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# MongoDB
MONGODB_URI=mongodb://localhost:27017/wheretf
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth Client ID
5. Application type: Web application
6. Authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`

## API Routes

### Auth Routes (handled by NextAuth)

```
GET  /api/auth/signin      - Sign in page
GET  /api/auth/signout     - Sign out
GET  /api/auth/session     - Get current session
GET  /api/auth/providers   - List providers
POST /api/auth/callback/*  - OAuth callbacks
```

### Route Handler Setup

```javascript
// app/api/auth/[...nextauth]/route.js
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

## Middleware (Route Protection)

```javascript
// middleware.js
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
  const isApiAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');
  const isPublicRoute = req.nextUrl.pathname === '/';

  // Allow auth routes
  if (isApiAuthRoute) {
    return;
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL('/chat', req.nextUrl));
  }

  // Protect all other routes
  if (!isLoggedIn && !isAuthPage && !isPublicRoute) {
    return Response.redirect(new URL('/auth/signin', req.nextUrl));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
```

## Protected API Routes

```javascript
// Example: app/api/chat/route.js
import { auth } from "@/lib/auth";

export async function POST(req) {
  const session = await auth();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  // ... handle request with userId
}
```

## Client Components

### Session Provider

```javascript
// app/providers.js
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}

// app/layout.js
import { Providers } from "./providers";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Using Session in Components

```javascript
// components/UserMenu.jsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <button onClick={() => signIn("google")}>Sign In</button>;
  }

  return (
    <div>
      <img src={session.user.image} alt={session.user.name} />
      <span>{session.user.name}</span>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

## Sign In Page

```javascript
// app/auth/signin/page.jsx
import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div className="signin-container">
      <h1>WhereTF</h1>
      <p>Workshop Inventory System</p>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/chat" });
        }}
      >
        <button type="submit">
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
```

## Data Relationships

All user-owned data includes a `user` reference:

```javascript
// Sessions belong to users
const sessionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // ...
});

// Items belong to users (multi-tenant)
const itemSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // ...
});

// Modules belong to users
const storageModuleSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // ...
});
```

## Query Patterns with User Scope

```javascript
// Always filter by user
const userItems = await Item.find({ user: session.user.id });

const userModules = await StorageModule.find({ user: session.user.id });

const userSessions = await Session.find({ user: session.user.id })
  .sort({ updatedAt: -1 });
```

## UI Flow

```
+------------------+     +------------------+     +------------------+
|   Landing Page   | --> |   Sign In Page   | --> |    Chat Page     |
|   (public)       |     |   Google OAuth   |     |   (protected)    |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                                                  +------------------+
                                                  |   User Menu      |
                                                  |   - Profile      |
                                                  |   - Settings     |
                                                  |   - Sign Out     |
                                                  +------------------+
```

## Security Considerations

1. **CSRF Protection** - NextAuth handles this automatically
2. **Session Security** - Sessions stored in MongoDB, not JWT by default
3. **HTTPS** - Required in production for OAuth
4. **Environment Variables** - Never commit secrets to git
5. **Domain Restriction** - Optionally restrict sign-in to specific email domains
