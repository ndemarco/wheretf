import { sql } from "drizzle-orm";
import { db } from "@/db/connection";
import { users, orgs, userOrgs, type OrgRole } from "@/db/schema";

// Safety guard: refuse to TRUNCATE anything that doesn't look like a
// test database. Historical footgun: the default connection string
// resolved to 'wheretf' (the dev DB) and every test run wiped the
// workshop. vitest.config.ts now forces DATABASE_URL to wheretf_test;
// this is belt + suspenders.
function assertTestDatabase(dbUrl: string) {
  const dbName = dbUrl.split("/").pop()?.split("?")[0] ?? "";
  if (!/test/i.test(dbName)) {
    throw new Error(
      `tests/setup.ts refuses to TRUNCATE database '${dbName}' — name must contain 'test'. Set DATABASE_URL or DATABASE_URL_TEST to a _test database.`
    );
  }
}
assertTestDatabase(
  process.env.DATABASE_URL ??
    "postgresql://wheretf:wheretf@localhost:5432/wheretf"
);

// Clean all tables between tests
async function cleanDatabase() {
  await db.execute(sql`
    SET client_min_messages TO WARNING;
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
    SET client_min_messages TO NOTICE;
  `);
}

// Default test scope — seeded fresh before every test so repo calls
// have a user + org to scope by. Tests spread `testCtx` into repo
// args: `moduleRepository.create({ ...testCtx, name: "MUSE" })`.
export const testCtx: { userId: string; orgId: string } = {
  userId: "",
  orgId: "",
};

// Mint an extra org (with its own owner user) for isolation tests.
export async function createTestOrg({
  slug,
  plan = "paid",
}: {
  slug: string;
  plan?: "free" | "paid";
}): Promise<{ userId: string; orgId: string }> {
  const [u] = await db
    .insert(users)
    .values({ email: `${slug}@wheretf.local`, name: slug })
    .returning();
  const [o] = await db
    .insert(orgs)
    .values({ name: slug, slug, plan })
    .returning();
  await db.insert(userOrgs).values({
    userId: u.id,
    orgId: o.id,
    role: "owner" satisfies OrgRole,
  });
  return { userId: u.id, orgId: o.id };
}

// Use a unique slug per test so any cleanup hiccup doesn't produce a
// duplicate-key error on users.email / orgs.slug on the next beforeEach.
let testSeq = 0;

beforeEach(async () => {
  testSeq += 1;
  const slug = `tctx-${testSeq}-${Math.random().toString(36).slice(2, 8)}`;
  const seeded = await createTestOrg({ slug });
  testCtx.userId = seeded.userId;
  testCtx.orgId = seeded.orgId;
});

afterEach(async () => {
  await cleanDatabase();
});
