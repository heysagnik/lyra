# Lyra

A lightweight, low-latency AI chat assistant featuring **live web search** and **persistent memory**, built as a single unified deployable on **Next.js 16** and **Neon Postgres** with zero external queue or cache dependencies.

---

## Highlights

- **Bounded Context ($O(1)$ Turn Cost):** The prompt context provided to the LLM stays fixed at **~2.6k tokens** regardless of conversation length through automatic 4-tier memory compaction (T0–T3).
- **Zero-Overhead Architecture:** No Redis, no QStash. Rate limiting is calculated natively in Postgres using indexed `usage_events` queries, and background tasks (memory distillation & summarization) execute non-blockingly via in-process microtasks.
- **Unified Multi-Model Registry:** High-throughput inference via **Groq LPU** supporting verified models (`qwen/qwen3.8-27b`, `openai/gpt-oss-20b`, `openai/gpt-oss-120b`).
- **Grounded Web Search:** Live search via TinyFish TinySearch with word-boundary snippet truncation and an in-memory LRU cache (500 items, 300s TTL) for ~2ms cached responses.
- **Native Next.js 16 Proxy:** Uses Next.js 16's native Proxy convention (`src/proxy.ts`) with Turbopack and React 19.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (`16.4.6`, App Router, Turbopack) + React 19 (`19.3.1`) |
| **Language** | TypeScript (Strict Mode) |
| **Database** | Neon Postgres via Drizzle ORM (`drizzle-kit`) |
| **Authentication**| Better Auth (Drizzle Postgres adapter) |
| **AI Runtime** | Vercel AI SDK (`ai` v5) + `@ai-sdk/groq` |
| **Search Engine**| TinyFish TinySearch REST API |
| **Styling** | Tailwind CSS v4 + shadcn/ui primitives |
| **Testing** | Vitest + React Testing Library |

---

## Getting Started

### 1. Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9

### 2. Installation

```bash
git clone https://github.com/your-org/lyra.git
cd lyra
pnpm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database (Neon Postgres)
DATABASE_URL="postgres://user:password@ep-xyz.neon.tech/neondb?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="your-32-char-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

# Optional: Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Groq LPU Inference
GROQ_API_KEY="gsk_..."
GROQ_MODEL_PRIMARY="qwen/qwen3.8-27b"

# TinyFish Search
TINYFISH_API_KEY="tf_..."

# Client URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Database Setup

```bash
# Generate and run database migrations
pnpm db:generate
pnpm db:migrate
```

### 5. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Scripts

```bash
# Run unit & integration tests (74 tests)
pnpm test

# Run TypeScript type check
pnpm typecheck

# Run ESLint check
pnpm exec eslint src

# Run production build with Turbopack
pnpm build

# Run live benchmark suite (TinySearch latency, Groq speed, token bounds)
pnpm benchmark
```

---

## Documentation

- **[DESIGN.md](./DESIGN.md):** Detailed system architecture, Mermaid diagrams, data flows, and memory engineering specs.
- **[AGENT.md](./AGENT.md):** Authoritative operational guidelines, stack constraints, and coding standards.
