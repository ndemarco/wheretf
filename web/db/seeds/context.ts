import { eq } from "drizzle-orm";
import { db } from "../connection";
import { orgs, users } from "../schema";

export type SeedCtx = { userId: string; orgId: string };

export async function getSeedCtx(): Promise<SeedCtx> {
  const [org] = await db.select().from(orgs).where(eq(orgs.slug, "default"));
  if (!org) throw new Error("default org not seeded — run migrations first");
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, "default@wheretf.local"));
  if (!user) throw new Error("default user not seeded — run migrations first");
  return { userId: user.id, orgId: org.id };
}
