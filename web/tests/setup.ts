import { sql } from "drizzle-orm";
import { db } from "@/db/connection";

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
