import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://wheretf:wheretf@localhost:5432/wheretf";

const client = postgres(connectionString);
export const db: PostgresJsDatabase = drizzle(client);
