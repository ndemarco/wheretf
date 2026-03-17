import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://wheretf:wheretf@localhost:5432/wheretf_test";

const client = postgres(connectionString);
export const testDb = drizzle(client);

// Clean all tables between tests
export async function cleanDatabase() {
  await testDb.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

afterEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await client.end();
});
