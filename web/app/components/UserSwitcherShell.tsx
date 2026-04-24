import { eq } from "drizzle-orm";
import { auth, signIn, signOut } from "@/lib/auth/config";
import { db } from "@/db/connection";
import { users } from "@/db/schema";
import { orgs, userOrgs } from "@/db/schema/orgs";
import { DEV_PERSONAS } from "@/lib/auth/dev-personas";
import { UserSwitcher, type UserSwitcherUser } from "./UserSwitcher";

function computeInit(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]!).toUpperCase();
}

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

async function handleImpersonate(personaId: string) {
  "use server";
  const p = DEV_PERSONAS.find((x) => x.id === personaId);
  if (!p) return;
  await signIn("dev-impersonate", {
    email: p.email,
    name: p.name,
    isAdmin: String(p.isAdmin),
    redirectTo: "/",
  });
}

export async function UserSwitcherShell() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const [row] = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      role: userOrgs.role,
      plan: orgs.plan,
    })
    .from(users)
    .leftJoin(userOrgs, eq(userOrgs.userId, users.id))
    .leftJoin(orgs, eq(orgs.id, userOrgs.orgId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;

  const displayName = row.name ?? row.email.split("@")[0];
  const normalizedRole: UserSwitcherUser["role"] =
    row.role === "admin" || row.role === "owner"
      ? "admin"
      : row.role === "member" || row.role === "viewer"
        ? "member"
        : null;
  const normalizedPlan: UserSwitcherUser["plan"] =
    row.plan === "pro" || row.plan === "paid"
      ? "pro"
      : row.plan === "free"
        ? "free"
        : null;

  const user: UserSwitcherUser = {
    id: row.userId,
    name: displayName,
    email: row.email,
    init: computeInit(displayName),
    plan: normalizedPlan,
    role: normalizedRole,
    isAdmin: row.isAdmin,
  };

  const devMode =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEV_IMPERSONATE === "1";

  return (
    <UserSwitcher
      user={user}
      devMode={devMode}
      personas={DEV_PERSONAS}
      onSignOut={handleSignOut}
      onImpersonate={handleImpersonate}
    />
  );
}
