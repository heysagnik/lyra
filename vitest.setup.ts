// Vitest test setup file
process.env.DATABASE_URL =
  "postgres://neondb_owner:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require";
process.env.BETTER_AUTH_SECRET =
  "development-secret-must-be-at-least-32-chars-long";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.GROQ_API_KEY = "gsk_sample_groq_api_key_test_value";
process.env.GROQ_MODEL_PRIMARY = "qwen/qwen3.8-27b";
process.env.TINYFISH_API_KEY = "tf_sample_tinyfish_key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
