# Lyra

An AI chat agent with persistent memory across sessions and live web search, engineered with strict prompt budget bounds, defensive vendor isolation, and robust background workers.

---

## 🌟 Key Features

- **Strict Prompt Window & Token Bounds**: Deterministic 5-tier context assembly (T0 system prompt, T1 long-term memories, T2 conversation summary, T3 recent turns, T4 current turn) bounded at ~2.6k input tokens to guarantee zero context creep or latency degradation.
- **Persistent Long-Term Memory**: Automatically extracts facts, preferences, and instructions asynchronously via Upstash QStash without blocking user responses, deduplicating by SHA-256 hash.
- **Live Grounded Web Search**: Real-time web search powered by TinyFish TinySearch with word-boundary snippet truncation, SHA-256 result caching, 1-retry fallback, and strict SSRF prevention.
- **Dual-Model Resilience**: Primary inference on Groq's high-throughput `qwen/qwen3.8-27b` with automatic failover to `openai/gpt-oss-20b` on errors or rate limits.
- **Multi-Tier Rate Limiting**: Concurrent in-flight limit (max 2 active turns per user) alongside Upstash Redis sliding windows (20 requests/minute, 300 requests/day) returning `Retry-After` headers.
- **Robust Background Processing**: Idempotent QStash workers for background memory distillation (`chat.distill`), rolling conversation summarization (`chat.summarize` with optimistic CAS concurrency), and nightly usage rollups with automatic 90-day event retention pruning.
- **Secure by Default**: Session authentication with Better Auth, server-side route guards, authenticated worker signatures/secrets, and strict XSS sanitization via `rehype-sanitize`.
- **Zero-Vendor-Leak UI**: React 19 / Next.js 15 chat interface styled with Tailwind CSS, supporting auto-resizing composer, live search toggle, streaming tool invocation badges, collapsible source citations, and code snippet copying.

---

## 🏗️ Architecture & Prompt Budget

The system prompt context is strictly bounded across 5 tiers:

| Tier | Component | Budget / Tokens | Update Cadence |
|---|---|---|---|
| **T0** | System Prompt & Personas | ~400 tokens | Static, defined in `src/lib/agent/prompt.ts` |
| **T1** | Long-Term User Memories | ~300 tokens (max 10) | Loaded from DB, updated asynchronously by worker |
| **T2** | Conversation Summary | ~400 tokens | CAS-versioned rolling summary of older turns |
| **T3** | Recent Turns Window | ~1,000 tokens (last 10 msgs) | Sliding window of chronological turn history |
| **T4** | Current User Turn | ~500 tokens | Sanitized user prompt + optional search results |

---

## 📋 Environment Variables

Copy `.env.example` to `.env` or `.env.local` and provide your API keys:

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | Neon Serverless PostgreSQL connection string | `postgres://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth session signing | 32+ character random string |
| `BETTER_AUTH_URL` | Canonical app URL for Better Auth | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth Client ID | `""` |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth Client Secret | `""` |
| `GROQ_API_KEY` | Groq API Key | `gsk_...` |
| `GROQ_MODEL_PRIMARY` | Primary language model | `qwen/qwen3.8-27b` |
| `GROQ_MODEL_FALLBACK` | Fallback language model | `openai/gpt-oss-20b` |
| `TINYFISH_API_KEY` | TinyFish TinySearch API Key | `tf_...` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | `https://xyz.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | `...` |
| `QSTASH_TOKEN` | Upstash QStash Bearer Token | `...` |
| `QSTASH_CURRENT_SIGNING_KEY`| QStash verification current key | `...` |
| `QSTASH_NEXT_SIGNING_KEY` | QStash verification next key | `...` |
| `WORKER_SECRET` | Shared secret for worker endpoints | 16+ character random string |
| `NEXT_PUBLIC_APP_URL` | Public frontend URL | `http://localhost:3000` |

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9 (or pnpm 12)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/lyra.git
cd lyra

# Install dependencies
pnpm install
```

### Database Setup

```bash
# Generate database schema migrations
pnpm db:generate

# Push migrations to Neon database
pnpm db:push

# Optional: Seed initial test user and conversation
pnpm db:seed
```

### Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

The project includes unit tests, integration tests, and security tests enforced with a strict verification pipeline.

```bash
# Run full verification (linter + typechecker + test suite)
pnpm verify

# Run linter
pnpm lint

# Run TypeScript type check
pnpm typecheck

# Run Vitest test suite
pnpm test

# Run test suite with coverage report (src/lib/ >= 80% lines)
pnpm test:coverage
```

---

## 🔒 Security & Defensive Guarantees

1. **Vendor Isolation**: Route handlers and UI components are decoupled from direct SDK dependencies. AI SDK usage is isolated within `src/lib/agent/` and `src/lib/api/use-agent-chat.ts`. Drizzle ORM queries are isolated within `src/lib/db/queries/`.
2. **SSRF Prevention**: All web search queries are strictly dispatched to the fixed host `https://api.tinyfish.io/v1/search` with typed Zod payload validation.
3. **XSS Protection**: Markdown responses from the assistant are sanitized using `rehype-sanitize` to strip unsafe HTML and script tags.
4. **Worker Verification**: Background worker endpoints at `/api/workers/*` verify either the internal `x-worker-secret` or the cryptographic `upstash-signature` using `@upstash/qstash` receiver keys.
