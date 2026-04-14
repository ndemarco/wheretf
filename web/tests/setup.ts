import { sql } from "drizzle-orm";
import { db } from "@/db/connection";

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

afterEach(async () => {
  await cleanDatabase();
});
