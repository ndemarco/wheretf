import { orgRoles, type OrgRole } from "@/db/schema/orgs";

const rank: Record<OrgRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function isOrgRole(value: string): value is OrgRole {
  return (orgRoles as readonly string[]).includes(value);
}

export function roleAtLeast(role: OrgRole, min: OrgRole): boolean {
  return rank[role] >= rank[min];
}

export class AuthzError extends Error {
  readonly status = 403;
}

export function assertRole(
  role: OrgRole | null | undefined,
  min: OrgRole,
): asserts role is OrgRole {
  if (!role) throw new AuthzError("not a member of this org");
  if (!roleAtLeast(role, min)) {
    throw new AuthzError(`requires ${min}, have ${role}`);
  }
}
