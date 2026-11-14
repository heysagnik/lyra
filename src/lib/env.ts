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
  NVIDIA_API_KEY: z.string().optional().default(""),
  TINYFISH_API_KEY: z
    .string({ required_error: "TINYFISH_API_KEY is required" })
    .min(1, "TINYFISH_API_KEY is required"),
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
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
    TINYFISH_API_KEY: process.env.TINYFISH_API_KEY,
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

export function validateEnvOrThrow(): void {
  getEnv();
}
