import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

function initAuth() {
  const env = getEnv();
  const db = getDb();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        plan: {
          type: "string",
          input: false, // never settable from client requests
          defaultValue: "free",
        },
      },
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,
  });
}

export type AuthInstance = ReturnType<typeof initAuth>;

let authInstance: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!authInstance) {
    authInstance = initAuth();
  }
  return authInstance;
}
