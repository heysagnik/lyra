import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["ai", "@ai-sdk/*"],
              message:
                "Importing AI SDK is restricted to src/lib/agent/, src/lib/llm/, and src/lib/api/use-agent-chat.ts",
            },
            {
              group: ["@upstash/qstash*"],
              message: "Importing QStash is restricted to src/lib/queue/",
            },
            {
              group: ["@upstash/redis*", "@upstash/ratelimit*"],
              message:
                "Importing Redis/Ratelimit is restricted to src/lib/ratelimit/ and src/lib/cache/",
            },
            {
              group: ["drizzle-orm*", "@neondatabase/serverless*"],
              message: "Importing Drizzle/Neon is restricted to src/lib/db/",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/lib/agent/**",
      "src/lib/llm/**",
      "src/lib/api/use-agent-chat.ts",
      "src/lib/tools/**",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "vitest.config.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: [
      "src/lib/queue/**",
      "src/lib/ratelimit/**",
      "src/lib/cache/**",
      "src/lib/db/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
