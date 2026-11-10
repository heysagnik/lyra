import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z
    .string({ required_error: "BETTER_AUTH_SECRET is required" })
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z
    .string({ required_error: "BETTER_AUTH_URL is required" })
    .url("BETTER_AUTH_URL must be a valid URL"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GROQ_API_KEY: z
    .string({ required_error: "GROQ_API_KEY is required" })
    .min(1, "GROQ_API_KEY is required"),
  GROQ_MODEL_PRIMARY: z.string().default("qwen/qwen3.8-27b"),
  GROQ_MODEL_FALLBACK: z.string().default("openai/gpt-oss-20b"),
  TINYFISH_API_KEY: z
    .string({ required_error: "TINYFISH_API_KEY is required" })
    .min(1, "TINYFISH_API_KEY is required"),
  UPSTASH_REDIS_REST_URL: z
    .string({ required_error: "UPSTASH_REDIS_REST_URL is required" })
    .url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z
    .string({ required_error: "UPSTASH_REDIS_REST_TOKEN is required" })
    .min(1, "UPSTASH_REDIS_REST_TOKEN is required"),
  QSTASH_TOKEN: z
    .string({ required_error: "QSTASH_TOKEN is required" })
    .min(1, "QSTASH_TOKEN is required"),
  QSTASH_CURRENT_SIGNING_KEY: z
    .string({ required_error: "QSTASH_CURRENT_SIGNING_KEY is required" })
    .min(1, "QSTASH_CURRENT_SIGNING_KEY is required"),
  QSTASH_NEXT_SIGNING_KEY: z
    .string({ required_error: "QSTASH_NEXT_SIGNING_KEY is required" })
    .min(1, "QSTASH_NEXT_SIGNING_KEY is required"),
  WORKER_SECRET: z
    .string({ required_error: "WORKER_SECRET is required" })
    .min(16, "WORKER_SECRET must be at least 16 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env | undefined;

export function getEnv(): Env {
  if (parsedEnv) {
    return parsedEnv;
  }

  const result = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL_PRIMARY: process.env.GROQ_MODEL_PRIMARY,
    GROQ_MODEL_FALLBACK: process.env.GROQ_MODEL_FALLBACK,
    TINYFISH_API_KEY: process.env.TINYFISH_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    WORKER_SECRET: process.env.WORKER_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(
      `[Lyra Boot Error] Missing or invalid environment variables:\n${errorMessages}\nCheck your .env or .env.local file against .env.example.`
    );
  }

  parsedEnv = result.data;
  return parsedEnv;
}

/**
 * Validates environment variables or throws on boot.
 */
export function validateEnv(): Env {
  return getEnv();
}
