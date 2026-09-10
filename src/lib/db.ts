import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { ensureDatabase } from "@/lib/db-setup";

// Single global PostgreSQL pool + Drizzle instance.
// Wrapped in a helper so the schema/demo data is bootstrapped lazily on first use.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export const db = drizzle(pool);

let ensured = false;

/** Idempotently guarantee schema + demo data exist before running queries. */
export async function ensureDb(): Promise<void> {
  if (ensured) return;
  await ensureDatabase(pool);
  ensured = true;
}

export type Row = Record<string, unknown>;

export { eq, and, or, ilike, desc, asc, sql, count, gte, lte, isNull, inArray } from "drizzle-orm";