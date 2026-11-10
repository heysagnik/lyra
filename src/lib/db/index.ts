import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

let cachedDb: ReturnType<typeof createDbInstance> | undefined;

function createDbInstance() {
  const env = getEnv();
  const sqlClient = neon(env.DATABASE_URL);
  return drizzle(sqlClient, { schema });
}

export function getDb() {
  if (!cachedDb) {
    cachedDb = createDbInstance();
  }
  return cachedDb;
}

export async function pingDb(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export type DbClient = ReturnType<typeof getDb>;
