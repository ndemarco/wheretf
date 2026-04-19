import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/connection";
import { userOrgs, orgs } from "@/db/schema";
import { auth } from "./config";
import { isOrgRole, type AuthzError } from "./roles";
import type { OrgRole } from "@/db/schema/orgs";

export const ACTIVE_ORG_COOKIE = "wtf-active-org";

export type RequestContext = {
  userId: string;
  activeOrgId: string;
  role: OrgRole;
  plan: "free" | "paid";
};

// Returns null when the request is unauthenticated or the user has no orgs.
// Throws only on DB errors.
export async function getRequestContext(): Promise<RequestContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const memberships = await db
    .select({
      orgId: userOrgs.orgId,
      role: userOrgs.role,
      plan: orgs.plan,
    })
    .from(userOrgs)
    .innerJoin(orgs, eq(orgs.id, userOrgs.orgId))
    .where(eq(userOrgs.userId, userId));

  if (memberships.length === 0) return null;

  const preferred =
    (preferredOrgId && memberships.find((m) => m.orgId === preferredOrgId)) ||
    memberships[0];

  if (!isOrgRole(preferred.role)) return null;
  const plan = preferred.plan === "paid" ? "paid" : "free";

  return {
    userId,
    activeOrgId: preferred.orgId,
    role: preferred.role,
    plan,
  };
}

export type { AuthzError };
