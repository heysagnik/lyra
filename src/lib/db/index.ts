import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

let cachedDb: ReturnType<typeof createDbInstance> | undefined;

function createDbInstance() {
  const env = getEnv();
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!cachedDb) {
    cachedDb = createDbInstance();
  }
  return cachedDb;
}

export type DbClient = ReturnType<typeof getDb>;
