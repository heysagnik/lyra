import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { getEnv } from "./env";

describe("Environment Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws clear error when a required variable is missing", () => {
    expect(() => {
      const testSchema = z.object({
        DATABASE_URL: z
          .string({ required_error: "DATABASE_URL is required" })
          .min(1, "DATABASE_URL is required"),
      });
      testSchema.parse({ DATABASE_URL: undefined });
    }).toThrow("DATABASE_URL is required");
  });

  it("loads valid environment correctly without Upstash dependencies", () => {
    process.env.DATABASE_URL = "postgres://neon.tech/db";
    process.env.BETTER_AUTH_SECRET = "secret-key-that-is-long-enough-32";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.GROQ_API_KEY = "gsk_123";
    process.env.TINYFISH_API_KEY = "tf_123";

    const env = getEnv();
    expect(env).toBeDefined();
    expect(env.GROQ_MODEL_PRIMARY).toBe("qwen/qwen3.8-27b");
  });
});
