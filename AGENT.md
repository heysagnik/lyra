# AGENT.md — Point of Truth

> **Status: AUTHORITATIVE.** This document is the single source of truth for the Chat Agent project.
> Any agent (human or AI) writing code for this repo MUST read this document fully before writing code.
> Where memory, intuition, or habit conflicts with this document, **this document wins**.
> If this document is wrong or outdated, fix it in a PR *first*, then write the code.

---

## Table of Contents

1. [Mission](#1-mission)
2. [Locked Stack](#2-locked-stack)
3. [System Architecture](#3-system-architecture)
4. [Agent Loop Specification](#4-agent-loop-specification)
5. [Memory System](#5-memory-system)
6. [Web Search Tool](#6-web-search-tool)
7. [Database Schema](#7-database-schema)
8. [API Contracts](#8-api-contracts)
9. [Frontend Specification](#9-frontend-specification)
10. [Code Standards — The Law](#10-code-standards--the-law)
11. [Testing Policy](#11-testing-policy)
12. [Security Rules](#12-security-rules)
13. [Environment Variables](#13-environment-variables)
14. [Project Phases & Deliverables](#14-project-phases--deliverables)
15. [Definition of Done](#15-definition-of-done)
16. [Known Risks & Mitigations](#16-known-risks--mitigations)
17. [Decision Log (ADRs)](#17-decision-log-adrs)

---

## 1. Mission

A chat agent users can talk to, with **one tool (live web search)** and **persistent memory**, optimized for **cost and latency**. Two hard design properties:

1. **Bounded context:** the prompt sent to the LLM stays ~2.6k tokens *no matter how long the conversation or how many messages exist*. Cost per turn is O(1), not O(history).
2. **One deployable, cheap by default:** Next.js serves UI + API + agent runtime. Every managed service must have a free tier that comfortably covers the MVP stage.

Non-goals for v1: multi-tool agents, file uploads, voice, team features, self-hosted models.

---

## 2. Locked Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), TypeScript **strict** | One deployable: UI + Route Handlers |
| Package manager | **pnpm** | |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | SQL-first, first-class Neon support |
| Auth | **Better Auth** (Drizzle adapter) | Library, not a service. Email+password + OAuth (Google) |
| LLM | **Groq** — primary `qwen/qwen3.8-27b`, fallback `openai/gpt-oss-20b` | Accessed via **Vercel AI SDK** `@ai-sdk/groq`; function calling. Primary is *Preview* status — fallback is mandatory, not optional |
| Agent runtime | **Vercel AI SDK** (`ai` v5+: `streamText`, `stopWhen`, `createUIMessageStream`) | Multi-step tool loop, streaming wire protocol, `maxRetries`; model fallback stays ours (§4) |
| Web search | **TinyFish TinySearch** (REST) | Structured JSON results; free plan |
| Database | **Neon** Postgres (serverless HTTP driver) | pgvector enabled, unused in v1 |
| Rate limit + cache | **Upstash Redis** (`@upstash/redis` + `@upstash/ratelimit`) | Sliding windows; 5-min search cache |
| Queue / scheduling | **Upstash QStash** | At-least-once delivery, retries, DLQ, cron schedules |
| UI runtime | React 19, **AI SDK `useChat`** (via `lib/api/use-agent-chat.ts` wrapper), TanStack Query, `react-markdown` + `remark-gfm` + `rehype-highlight` + `rehype-sanitize` | v5 transport-based `useChat`; components never import the SDK directly |
| Styling | Tailwind CSS v4 + shadcn/ui primitives | Clean minimal light theme |
| Tests | **Vitest** (+ React Testing Library for logic-heavy components) | |
| Hosting | Vercel (Node runtime for API routes) | `maxDuration = 60` on `/api/chat` |

**Never introduce a dependency** without a one-paragraph justification in the PR description.

---

## 3. System Architecture

Two planes. The user-facing stream never goes through a queue; queues are only for side effects the user does not wait for.

```
                         ┌─────────────────────────── Next.js (one deployable) ───────────────────────────┐
                         │                                                                                │
  Browser ──cookie────►  │  middleware: Better Auth session guard on /api/* (except health, auth)          │
                         │                                                                                │
  Browser ──POST SSE──►  │  /api/chat  (Node runtime, maxDuration 60)                                      │
                         │    ① requireUser()            ⑥ streamText step 2 (final answer)                │
                         │    ② 3 rate limiters (Redis)  ⑦ persist messages inline (event log)             │
                         │    ③ assemble T0–T3 memory    ⑧ enqueue side effects (QStash, fire-and-forget)  │
                         │    ④ streamText step 1        ⑨ finish part {usage, model, latencyMs}           │
                         │      (maxRetries + fallback)                                                    │
                         │    ⑤ tool execute → TinyFish (Redis-cached)                                     │
                         │                                                                                │
                         │  /api/conversations[/id]    CRUD: list, get, rename, delete (cascade)           │
                         │  /api/workers/*             QStash targets: summarize / distill / usage-rollup   │
                         │                             (signature-verified, SKIP-safe, idempotent)          │
                         └──────┬──────────────────────────────┬─────────────────────────────┬─────────────┘
                                │                              │                             │
                     read/write │                     enqueue   │                    cache    │
                                ▼                              ▼                             ▼
                     ┌─────────────────┐        ┌──────────────────────┐      ┌──────────────────┐
                     │ Neon Postgres   │        │ Upstash QStash       │      │ Upstash Redis    │
                     │ conversations   │        │  retries + backoff   │      │  rate windows    │
                     │ messages (log)  │        │  DLQ → job_failures  │      │  in-flight caps  │
                     │ memories        │        │  schedules: sweeper, │      │  search cache    │
                     │ usage_events    │        │   nightly rollup     │      │  (TTL 300s)      │
                     │ job_failures    │        └──────────┬───────────┘      └──────────────────┘
                     └─────────────────┘                   │ workers call back into /api/workers/*
                                                           │
                     ┌─────────────────┐        ┌──────────▼───────────┐
                     │ Groq            │        │ TinyFish TinySearch  │
                     │ qwen3.8-27b     │        │ (fixed host, REST)   │
                     │ fallback:       │        └──────────────────────┘
                     │ gpt-oss-20b     │
                     └─────────────────┘
```

### Turn lifecycle (numbered, with latency budget)

| # | Step | Budget | Fail behavior |
|---|---|---|---|
| ① | Session check (Better Auth) | ~5 ms | 401 |
| ② | Rate limiters: per-min, per-day, in-flight (Redis) | ~15 ms | 429 + `Retry-After` |
| ③ | Assemble prompt T0–T3 (1 summary read + 10-row index scan) | ~10–30 ms | 500 |
| ④ | `streamText` step 1 (decision) | TTFT <100 ms typical | SDK `maxRetries` → model fallback → `error` part |
| ⑤ | Tool `execute` → TinySearch (8 s timeout, 1 retry, 5-min cache) | ~500 ms | degrade: answer without search |
| ⑥ | `streamText` step 2 (final answer, `maxOutputTokens` 1024) | ~0.7 s for 300 tok | SDK `maxRetries` → `error` part |
| ⑦ | Persist user/assistant/tool message rows inline (`onFinish` / `onAbort`) | ~20 ms | 500 (nothing user-visible lost: stream already delivered) |
| ⑧ | Enqueue `summarize` / `distill` / `usage` jobs (fire-and-forget) | ~30 ms | sweeper reconciles later; never blocks stream |
| ⑨ | `finish` part with `{ messageId, usage: { tokensIn, tokensOut, cachedIn }, model, latencyMs }` | — | guaranteed terminal part (or `error` part) |

**Invariants:** spend order is auth → limiters → tokens (never spend before limiting). The stream always terminates with a `finish` or `error` part. Persistence happens before enqueue (jobs never reference un-persisted rows).

---

## 4. Agent Loop Specification

The loop lives in `src/lib/agent/loop.ts`, built on **AI SDK `streamText`**. The SDK provides the multi-step tool loop, the streaming wire protocol, and retry (`maxRetries`); we provide memory assembly, the tool executor, persistence, and model fallback. Tool iterations are capped by `stopWhen: stepCountIs(TOOL_MAX_ITERATIONS)` (= 2), and the last step is prepared without tools so the model must answer in text.

```ts
// Pseudocode — the real implementation MUST preserve this shape and ordering.
async function runTurn(input: TurnInput): Response {
  const user = await requireUser(request);                      // ①
  const gate = await limiters.check(user.id);                   // ②
  if (!gate.ok) return json(429, { retryAfter: gate.retryAfter });

  const ctx = await memory.assemble(conversationId);            // ③ T0–T3
  const messages = [...ctx.window, userMessage(input.text)];    //    T3 + new input

  const result = streamText({                                   // ④ one call, multi-step
    model: groqModel(),                                         //    primary, or fallback (contract below)
    system: ctx.systemPrompt,                                   //    T0+T1+T2 — stable prefix
    messages,
    tools: input.search ? { web_search: webSearchTool } : {},
    prepareStep: ({ stepCount }) =>
      stepCount >= TOOL_MAX_ITERATIONS - 1 ? { tools: {} } : undefined, // force text on last step
    stopWhen: stepCountIs(TOOL_MAX_ITERATIONS),                 //    = 2
    maxOutputTokens: MAX_TOKENS_OUT,                            //    = 1024
    maxRetries: 2,                                              //    SDK: 429/5xx backoff
    onStepFinish: (s) => turnEvents.push(fromStep(s)),          //    capture tool steps
    onFinish: async (r) => {                                    //    ⑦⑧ after completion
      await persist.turn(conversationId, input, turnEvents, r);
      void queue.enqueueSideEffects(conversationId);            //    fire-and-forget, never awaited
    },
    onAbort: async () => { await persist.partialTurn(...); },   //    client disconnect: persist partial
  });

  // ⑤ webSearchTool.execute IS the §6 executor — the SDK runs it inside the loop and
  //    feeds the compacted result back as the next step's input (T4 ≤ 700 tok).

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "data-meta", data: { conversationId, title } });
      writer.merge(result.toUIMessageStream());                 //    ⑨ finish part carries usage
    },
    onError: (err) => appError(err).message,                    //    guaranteed error part
  });
  return stream.toResponse();                                   //    SSE-framed UI message stream
}
```

### LLM adapter contract (`src/lib/agent/llm.ts`)

- Thin wrapper over AI SDK `streamText` + `@ai-sdk/groq`. Model ids come from env (`GROQ_MODEL_PRIMARY` / `GROQ_MODEL_FALLBACK`); swapping providers later means changing the provider package, not the loop.
- **Retry:** SDK `maxRetries: 2` handles 429/5xx with backoff automatically.
- **Model fallback (ours, not the SDK's):** if the primary model fails before any text part reached the client, re-issue the call once with the fallback model and tag the turn `model = "openai/gpt-oss-20b"` for telemetry. If the failure happens after text started streaming, emit the `error` part (client shows retry) — never silently restart a half-delivered answer.
- Usage accounting from `onFinish` (`usage` = prompt/completion/cached-input tokens) → `usage_events`.
- Never throw across the route boundary; map errors to error parts / `Result` with `PROVIDER`.

### System prompt (T0) — exact text

```
You are Aria, a helpful, direct assistant with access to live web search.

Rules:
- When search results are provided, cite them inline as [1], [2] matching the numbered sources.
- If search is enabled but results are insufficient to answer, say so explicitly.
- If search is disabled, answer from your own knowledge and note when freshness matters.
- Be concise. Use markdown. Put code in fenced blocks with a language tag.
- Facts about the user provided in USER MEMORY are reliable; use them without asking again.
```

---

## 5. Memory System

### Prompt assembly (order is deliberate — stable prefix is prompt-cache friendly; cached tokens don't count against Groq rate limits)

| Tier | Content | Budget | Refresh |
|---|---|---|---|
| T0 | System prompt (exact text above) | ~250 tok | static |
| T1 | User memory — top-5 facts by `last_used_at × confidence` | ≤150 tok | slow (distill worker) |
| T2 | Conversation rolling summary | ≤300 tok | summarize worker, per 10 msgs |
| T3 | Verbatim window — last 10 messages | ~1.2k tok | per turn |
| T4 | Tool results — top 5, snippet ≤300 chars + URL + date | ≤700 tok | per search |

**Total prompt ≈ 2.6k tokens, constant, for any conversation age.** Assembled as AI SDK `ModelMessage[]`: one system message (T0+T1+T2 — the stable, cache-friendly prefix) followed by the T3 window; T4 enters as the tool-result message the SDK appends during the loop.

### Workers (QStash handlers, all idempotent)

| Job | Trigger | Logic | Idempotency |
|---|---|---|---|
| `chat.summarize` | enqueued when `msg_count - summarized_count ≥ 10` | `prev_summary + delta messages since summary_upto` → new ≤300-token summary, on the **fallback model** (cheap) | compare-and-set on `summary_version`; re-delivery is a no-op |
| `chat.distill` | enqueued after every assistant turn | extract durable user facts/preferences/corrections (structured output), dedupe by similarity, upsert `memories` | content hash; re-run merges instead of duplicating |
| `usage.rollup` | QStash schedule, nightly | aggregate `usage_events` → `usage_daily`, prune events >90 days | date-scoped upsert |
| `sweeper` | QStash schedule, every 5 min | re-enqueue missed summarize jobs (conversations where lag ≥ 10); reconcile stuck in-flight | natural via CAS |

**Failure policy for all workers:** QStash retries 5× with backoff → dead-letter → row in `job_failures` → visible in `/api/health` payload. Memory failures **degrade, never break**: next turn simply uses the previous summary version.

### v1.1 upgrade path (do NOT build in v1)

`memories.embedding vector(768)` column exists but stays NULL. Upgrade = populate embeddings + switch T1 retrieval to pgvector cosine top-3. No migration required — this is why the column exists.

---

## 6. Web Search Tool

### Tool definition (`src/lib/tools/web-search.ts`)

```ts
export const webSearchTool = tool({
  description:
    "Search the live web for current information. Use for anything time-sensitive, factual, or outside your training data.",
  parameters: z.object({
    query: z.string().min(1).max(400).describe("Search query, keywords not sentences"),
    recency_days: z.number().int().positive().optional()
      .describe("Optional: prefer results newer than N days"),
  }),
  execute: executeWebSearch,   // the executor contract below — runs INSIDE the streamText loop
});
```

The SDK derives the JSON schema sent to Groq from the zod object, routes the model's call into `execute`, and feeds the returned value back as the next step's input — no hand-rolled tool-call parsing anywhere.

### Executor contract (`src/lib/tools/web-search.ts`)

1. **Validate args with zod** — model output is untrusted input (bad JSON, wrong types, oversized query → reject with a tool error message back to the model, not an exception).
2. **Cache:** Redis key `search:v1:{sha256(query + recency)}`, TTL 300 s. Hit → skip API call.
3. **Call TinyFish TinySearch** (fixed hostname only — see SSRF rule) with 8 s timeout; on failure retry once.
4. **Compact:** top 5 results; snippet truncated to 300 chars at word boundary; keep `{title, url, snippet, date}`; drop everything else. This is what enters T4 as the tool result *and* what the executor writes to the stream as the `data-sources` part for the UI.
5. **Degrade, don't fail:** both attempts fail → return a tool message "search unavailable" and let the model answer without search; the UI shows a subtle notice. Never fail the turn because search failed.
6. **Fixed host:** the executor may only call the TinyFish API domain. It must never fetch a URL the model provides.

---

## 7. Database Schema

`src/lib/db/schema.ts` (Drizzle). Better Auth's CLI generates and owns `user`, `session`, `account`, `verification` — **never hand-edit those**. pgvector extension is enabled; no vector columns are populated in v1.

```sql
create table conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references "user"(id) on delete cascade,
  title            text not null default 'New chat',
  summary          text,
  summary_version  int  not null default 0,   -- CAS token for summarize worker
  summary_upto     uuid,                      -- last message id covered by summary
  summarized_count int  not null default 0,
  msg_count        int  not null default 0,
  search_default   boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on conversations (user_id, updated_at desc);

create table messages (                    -- append-only event log. NEVER update or delete rows.
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','tool')),
  content         text not null default '',
  tool_calls      jsonb,                   -- model's invocation (query etc.)
  sources         jsonb,                   -- [{title,url,snippet,date}] → UI citation chips
  model           text,
  tokens_in       int,
  tokens_out      int,
  latency_ms      int,
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at desc);

create table memories (                    -- T1 durable user memory (survives conversation delete)
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references "user"(id) on delete cascade,
  kind                text not null check (kind in ('fact','preference','correction')),
  content             text not null,
  confidence          real not null default 0.8,
  source_conversation uuid references conversations(id) on delete set null,
  content_hash        text not null,       -- dedupe key for distill worker
  embedding           vector(768),         -- NULL in v1 (reserved for v1.1)
  last_used_at        timestamptz,
  created_at          timestamptz not null default now()
);
create unique index on memories (user_id, content_hash);
create index on memories (user_id, last_used_at desc);

create table usage_events (                -- written inline per turn; rolled up nightly
  id           bigserial primary key,
  user_id      uuid not null,
  conversation_id uuid,
  model        text,
  tokens_in    int, tokens_out int,
  cached_in    int,
  cost_usd     numeric(10,6),
  created_at   timestamptz not null default now()
);

create table usage_daily (                 -- rollup target (nightly job)
  day        date not null,
  user_id    uuid not null,
  turns      int not null default 0,
  tokens_in  int not null default 0,
  tokens_out int not null default 0,
  cost_usd   numeric(10,4) not null default 0,
  primary key (day, user_id)
);

create table job_failures (                -- dead-letter audit, surfaced in /api/health
  id          bigserial primary key,
  kind        text not null,
  payload     jsonb not null,
  error       text,
  attempts    int,
  created_at  timestamptz not null default now()
);
```

### Storage rules (non-negotiable)

- **`messages` is an append-only event log.** The UI and the agent are both *projections* of it. Never store the projection as the primary record, never append JSON blobs into a single cell (write amplification + row-lock contention + full-doc parse on every read).
- Cross-conversation state (T1) lives in `memories`, keyed by `user_id`, so deleting a chat never deletes the agent's knowledge of the user.
- Migrations only via `drizzle-kit generate` + apply; never edit an applied migration.

---

## 8. API Contracts

All routes: JSON in/out except `/api/chat` (UI message stream out). All require a session (401 otherwise) except `/api/health` and Better Auth's own routes. Validate every request body with zod.

| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Agent turn. Body: `{ conversationId?: string, message: string, search?: boolean }` → AI SDK UI message stream (SSE-framed) |
| `/api/conversations` | GET | List user's conversations (cursor pagination on `updated_at`) |
| `/api/conversations/:id` | GET / PATCH / DELETE | History (paginated) / rename + `search_default` / delete (cascade) |
| `/api/workers/summarize` | POST | QStash target (signature-verified) |
| `/api/workers/distill` | POST | QStash target (signature-verified) |
| `/api/workers/usage-rollup` | POST | QStash target (signature-verified) |
| `/api/health` | GET | DB ping, queue lag, `job_failures` count in last 24 h |

### Wire protocol (`/api/chat`) — AI SDK UI message stream + custom data parts

The response is the AI SDK's UI message stream (SSE-framed, `useChat`-compatible), produced by `createUIMessageStream` in the route. Do NOT hand-roll events — the SDK emits the standard parts; we add two custom ones:

| Part | Origin | Payload | When |
|---|---|---|---|
| `data-meta` | route (writer, first) | `{ conversationId, title }` | immediately (creates conversation if missing; title = first user message, 48 chars) |
| `text-delta` | SDK | text chunks | streamed answer tokens |
| tool parts (`tool-input-available` → `tool-output-available`) | SDK | web_search invocation + result | model calls the tool → UI "Searching…" badge |
| `data-sources` | tool executor (via stream writer) | `{ items: [{ title, url, snippet, date }] }` | after tool execution → UI sources row |
| `finish` | SDK (`onFinish` metadata) | `{ messageId, usage: { tokensIn, tokensOut, cachedIn }, model, latencyMs }` | terminal — always sent on success |
| `error` | SDK (`onError`) | `{ message, code, recoverable }` | terminal — always sent on failure |

Client note: `useChat` + `DefaultChatTransport({ api: "/api/chat", body: { conversationId, search } })` consumes this natively — zero hand-rolled parsing. On connection loss mid-stream, the client re-fetches the conversation — the partial assistant message was persisted server-side (`onAbort`), so recovery is a read, not a replay.

---

## 9. Frontend Specification

### Design system — "Clean Minimal Light"

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#FFFFFF` | page background |
| `--bg-subtle` | `#F9FAFB` | user bubble, hover states |
| `--border` | `#E5E7EB` | all 1px borders, dividers |
| `--text` | `#111827` | primary text |
| `--text-muted` | `#6B7280` | secondary text, timestamps |
| `--accent` | `#2563EB` | ONLY: active conversation marker, send button, links, focus rings, toggle-on |
| Radius | `8px` (messages `12px`) | |
| Font | Inter (system fallback), `tabular-nums` for any numbers | |
| Shadows | none, or `0 1px 2px rgba(0,0,0,0.05)` on popover only | |
| Spacing | 4px grid | |

No gradients, no glassmorphism, no dark mode in v1. Density: message list max-width `48rem` centered.

### Layout

```
┌─ Sidebar 280px ──┬─ Main column ────────────────────────────────────┐
│ [+ New chat]     │  Header: conversation title · model/search state  │
│ (sticky)         │ ─────────────────────────────────────────────    │
│ • Trip to Japan  │   user bubble (bg-subtle, right)                 │
│ • Groq pricing ◄ │   assistant: plain text on white, markdown,      │
│   hover →        │     code blocks + copy button, [1] citations     │
│   rename/delete  │   [🌐 Searching: "groq pricing"] tool badge      │
│                  │   Sources row: favicon chips → links             │
│                  │ ─────────────────────────────────────────────    │
│                  │  Composer: textarea autosize · 🌐 toggle · send   │
└──────────────────┴──────────────────────────────────────────────────┘
```

### Components (`src/components/chat/`)

| Component | Responsibilities |
|---|---|
| `Sidebar` | New chat button; conversation list (TanStack Query); collapse on mobile |
| `ConversationItem` | Title, relative time; hover actions: inline rename, delete with confirm |
| `MessageList` | Windowed render (render last ~200, older on scroll-up fetch); auto-scroll **pauses** when user scrolls up; "jump to latest" pill |
| `MessageBubble` | Role styling; user = subtle bg right; assistant = markdown on white |
| `Markdown` | `react-markdown` + `remark-gfm` + `rehype-highlight` + **`rehype-sanitize`** (model output is untrusted); code blocks get header + copy button |
| `ToolBadge` | "Searching the web: {query}" with spinner → checkmark |
| `SourcesRow` | Numbered favicon chips matching [n] citations; external links |
| `Composer` | Autosize textarea; Enter=send, Shift+Enter=newline; search toggle pill synced to conversation `search_default`; disabled while streaming (with stop button); 429 countdown state |
| `EmptyState` | Greeting + 4 suggested prompts (one is "search something current") |
| `Toast` | Error surface with retry action |

### Client state rules

- Conversation list/server state: TanStack Query only. Chat/streaming state: AI SDK `useChat` wrapped by `lib/api/use-agent-chat.ts` (transport wiring, typed parts, stop/status) — components never import `ai` directly (vendor isolation, §10.4).
- v5 `useChat` does not own input state: the `Composer` owns the textarea and calls the wrapper's `sendMessage`; rendering maps `message.parts` (text → `Markdown`, tool parts → `ToolBadge`, `data-sources` → `SourcesRow`).
- Optimistic user message; assistant placeholder replaced by streamed parts.
- Every fetch goes through `lib/api/client.ts` — components never call `fetch` directly.

---

## 10. Code Standards — The Law

These are enforced by review, lint, and CI. An agent that violates them has produced a defective deliverable.

**Type safety**
1. `strict: true`. **No `any`** — use `unknown` + narrowing or generics.
2. **Zod at every boundary:** HTTP request bodies, environment (once, at boot), tool arguments (model output), QStash worker payloads, external API responses.
3. Domain types live in `src/types/` and are shared across layers; adapters map vendor shapes → domain types at their edge.

**Architecture**
4. **Vendor isolation (ESLint `no-restricted-imports` enforced):** `ai` + `@ai-sdk/*` only in `src/lib/agent/`, `src/lib/llm/`, and the `lib/api/use-agent-chat.ts` wrapper (never in components); `@upstash/qstash` only in `src/lib/queue/`; `@upstash/redis`/`ratelimit` only in `src/lib/ratelimit/` + `src/lib/cache/`; `drizzle`/Neon driver only in `src/lib/db/`; TinyFish fetch only in `src/lib/tools/`. Business logic depends on interfaces, never vendor SDKs.
5. Functions ≤ 50 lines and one level of abstraction; `loop.ts` orchestrates, helpers implement.
6. Named exports only. Default exports ONLY where Next.js requires (pages, layouts).
7. No barrel `index.ts` re-exports.

**Errors & async**
8. `Result<T, AppError>` for fallible cross-module operations; throw only for programming errors. `AppError` codes: `AUTH | RATE_LIMITED | PROVIDER | TOOL | DB | VALIDATION | INTERNAL`.
9. Never swallow an error silently. Every catch logs structured JSON with `{ userId, conversationId, messageId, code, msg }`.
10. No floating promises — `await`, or explicit `void fireAndForget(fn)` wrapper with internal error logging.

**Hygiene**
11. No magic numbers — budgets and limits live in `src/lib/agent/budget.ts` as named, commented constants (`WINDOW_MESSAGES = 10`, `SUMMARY_MAX_TOKENS = 300`, `SNIPPET_MAX_CHARS = 300`, `TOOL_MAX_ITERATIONS = 2`, `MAX_TOKENS_OUT = 1024`, `SEARCH_CACHE_TTL_S = 300`, `SEARCH_TIMEOUT_MS = 8000`, `RATE_PER_MIN = 20`, `RATE_PER_DAY = 300`, `MAX_INFLIGHT = 2`).
12. Comments explain **why**, not what. No commented-out code — delete it.
13. Files: kebab-case. Types/components: PascalCase. Functions/vars: camelCase. Env constants: SCREAMING_SNAKE.
14. SQL only through Drizzle query APIs; zero string interpolation in SQL.
15. Secrets only via `src/lib/env.ts` (zod-validated, fails fast at boot). Nothing secret in client components; `NEXT_PUBLIC_` is an allowlist of at most `NEXT_PUBLIC_APP_URL`.
16. Git: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`); one branch per phase task; `pnpm verify` green is the merge gate.
17. Don't leave `TODO`/`FIXME` in merged code — file an issue instead.

---

## 11. Testing Policy

| Level | What | Rule |
|---|---|---|
| Unit | `budget.ts` math, prompt assembly order, snippet truncation (word boundary), backoff calculation, compaction delta selection, limiter decision logic (mocked Redis) | Every pure function in `lib/agent`, `lib/tools`, `lib/memory` has tests |
| Contract | LLM adapter against AI SDK `MockLanguageModel` test doubles (happy path, 429-then-success, fallback switch); TinyFish adapter against fixture JSON incl. oversized snippets | Adapters are the seams — test them hard |
| Integration | `/api/chat` route with mocked model + tools: assert UI message stream part order `data-meta → (text-delta | tool parts → data-sources → text-delta)* → finish`; assert persistence completed before `finish` is delivered | Golden-file test for part order |
| Component | `Composer` state machine (send/stop/429-countdown), `Markdown` XSS attempt rendering | Logic only; no visual snapshots |

Coverage gate: **≥80% lines in `src/lib/`**. `pnpm verify` = lint + typecheck + test; it must pass before every merge, no exceptions.

---

## 12. Security Rules

1. All LLM, tool, DB, and Redis calls are server-side. The browser never sees provider keys or raw provider APIs.
2. **Model output is untrusted input:** zod-validate tool args; sanitize all rendered markdown (`rehype-sanitize`) — a hostile model output must not execute script.
3. **SSRF:** the search executor calls a fixed TinyFish hostname only. It must never fetch URLs supplied by the model or user.
4. Rate limit **before** spending tokens (order: auth → limiters → LLM).
5. QStash worker routes verify QStash request signatures (SDK verify middleware) — they are privileged internal endpoints.
6. Every list/read query filters by `session.user.id`. (Optional hardening once stable: Neon RLS with `current_setting('app.user_id')`.)
7. Log IDs, not contents: no message bodies or memory contents in logs.
8. Standard security headers (CSP, frame-deny, etc.) via `next.config` headers.

---

## 13. Environment Variables

Validated once at boot by `src/lib/env.ts` (zod). Missing var = startup failure with a clear message.

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Neon pooled connection string (serverless driver) |
| `BETTER_AUTH_SECRET` | server | Auth signing |
| `BETTER_AUTH_URL` | server | Auth base URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | server | OAuth (optional in dev) |
| `GROQ_API_KEY` | server | Groq |
| `GROQ_MODEL_PRIMARY` | server | default `qwen/qwen3.8-27b` |
| `GROQ_MODEL_FALLBACK` | server | default `openai/gpt-oss-20b` |
| `TINYFISH_API_KEY` | server | TinySearch |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | server | Redis (limits + cache) |
| `QSTASH_TOKEN` | server | Publishing |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | server | Worker signature verification |
| `WORKER_SECRET` | server | Extra shared-secret on worker routes |
| `NEXT_PUBLIC_APP_URL` | client | Canonical URL |

`.env.example` ships with every key and a comment; keep it in sync — it is documentation.

---

## 14. Project Phases & Deliverables

Six phases, ~5 dev-days total. Each phase ends merge-ready with its acceptance criteria demonstrably passing. **Do not start a phase before the previous one is merged.**

### Phase 0 — Foundation (0.5 d)

**Goal:** runnable skeleton with all gates in place.
**Deliverables:** pnpm + Next.js + TS strict scaffold; ESLint (incl. `no-restricted-imports` vendor rules) + Prettier; `src/lib/env.ts` + `.env.example`; Drizzle + drizzle-kit wired to Neon; `pnpm verify` script (lint + typecheck + test); Vitest scaffold; README stub.
**Acceptance:** `pnpm dev` boots; `pnpm verify` green; app fails fast with a clear message when a var is missing; empty `health` route returns `{ ok: true }`.

### Phase 1 — Auth (1 d)

**Goal:** real users, protected API.
**Deliverables:** Better Auth + Drizzle adapter (CLI-generated tables); sign-in/sign-up pages (minimal, styled later); `middleware.ts` guarding `/api/*`; `requireUser()` helper; Google OAuth (optional, flag-gated).
**Acceptance:** sign-up → in → out round-trips; unauthenticated `POST /api/chat` → 401; session cookie is httpOnly; protected route test passes.

### Phase 2 — Data Layer (0.5 d)

**Goal:** the full schema, typed queries, nothing else depends on half-built SQL.
**Deliverables:** `schema.ts` with all 6 tables + indexes; migration applied; `lib/db/queries/` modules (conversations, messages, memories, usage) returning domain types; seed script for dev.
**Acceptance:** migration runs clean on a fresh Neon branch; every query used by later phases exists and is typed; no raw SQL strings anywhere.

### Phase 3 — Agent Core (1 d)

**Goal:** the brain — streaming turns with tool + fallback, no rate limits/queues yet.
**Deliverables:** `agent/llm.ts` (`streamText` + `@ai-sdk/groq`, `maxRetries`, model-fallback wrapper, usage from `onFinish`); `tools/web-search.ts` (AI SDK `tool()` with zod params, timeout, 1 retry, compaction — Redis cache optional here); `agent/prompt.ts` + `memory.ts` (T0–T3 assembly with budget.ts constants); `agent/loop.ts`; `api/chat/route.ts` via `createUIMessageStream` with `data-meta`/`data-sources` parts and a guaranteed terminal part; inline persistence (`onFinish` + `onAbort`).
**Acceptance:** `curl -N` shows part order `data-meta → text/tool parts → finish`; a "search this" question emits tool parts → `data-sources` → cited answer; forced 429 (mock model) triggers fallback and the turn is tagged with the fallback model; no-search turn completes <1 s typical; every turn leaves user/assistant/tool rows + usage in DB.

### Phase 4 — Limits & Workers (1 d)

**Goal:** fairness, durability, and the memory machinery.
**Deliverables:** `ratelimit/limiters.ts` (per-min 20, per-day 300, in-flight 2; 429 + `Retry-After`); `queue/client.ts` (QStash publish, fire-and-forget); workers `summarize` (CAS on `summary_version`), `distill` (content-hash dedupe), `usage-rollup` (nightly schedule); sweeper schedule (5 min); signature verification on `/api/workers/*`; `job_failures` + health surfacing.
**Acceptance:** 21st message in a minute → 429 with countdown; after 10+ messages, summary appears and next turn's prompt contains it (verify via logged token counts — total stays ≤ ~2.6k); re-delivered summarize job is a no-op (version unchanged); a job forced to fail 5× lands in `job_failures` and health shows it.

### Phase 5 — Interface (1 d)

**Goal:** the whole designed UX.
**Deliverables:** all Section 9 components; design tokens; TanStack Query conversation list; `lib/api/use-agent-chat.ts` (`useChat` + `DefaultChatTransport`, typed parts, stop, recovery); markdown + code copy + citations; search toggle; rename/delete; empty state; toasts + 429 countdown; mobile collapse.
**Acceptance:** manual e2e: new chat → ask search question → see badge → sources chips → cited answer → rename → delete; refresh mid-stream recovers the partial message from DB; composer disables during stream and shows stop; no console errors; lighthouse a11y ≥ 95 on chat page.

### Phase 6 — Hardening & Deploy (0.5 d)

**Goal:** production-verifiable.
**Deliverables:** tests to coverage gate (Section 11); security headers; `maxDuration`, log noise audit; Vercel project with all envs; QStash schedules registered; smoke checklist in README; deployed URL.
**Acceptance:** `pnpm verify` green with ≥80% `lib/` coverage; deployed URL passes the Phase 5 e2e against real Groq/TinyFish/Neon; `/api/health` reports all-green; zero `TODO`/`FIXME` in the tree.

**Explicitly out of scope for v1** (do not build, do not half-build): pgvector T1 retrieval, RLS, team features, file uploads, streaming tool arguments, dark mode, i18n.

---

## 15. Definition of Done

A phase is done when ALL of these hold:

- [ ] Acceptance criteria for the phase demonstrably pass (command or URL evidence)
- [ ] `pnpm verify` green; `src/lib/` coverage ≥ 80%
- [ ] No new `any`, no vendor import outside its adapter folder, no magic numbers
- [ ] Every stream terminates with a `finish` or `error` part; every fallible module returns `Result`
- [ ] Failure paths tested: provider 429/5xx → fallback; search failure → degradation; worker failure → DLQ
- [ ] `.env.example`, README, and this file updated if anything changed
- [ ] Merged via conventional-commit PR; no `TODO` left in the tree

---

## 16. Known Risks & Mitigations

| Risk | Likelihood | Mitigation (already in design) |
|---|---|---|
| `qwen3.8-27b` is a Preview model — changed/degraded | Medium | Fallback model mandatory since Phase 3; single env var to re-point primary |
| Groq free-tier RPD (~1k/day org-wide) | Certain at growth | Retry layer absorbs bursts; usage telemetry per user makes the ceiling visible; paid tier is the switch, no code change |
| TinyFish free-tier limits / downtime | Medium | 5-min cache, 1 retry, graceful degradation to no-search answers |
| QStash at-least-once duplicates | Certain | All workers idempotent (CAS, hashes, date-scoped upserts) — by design, not by hope |
| Neon cold start (~0.5 s) after suspend | Certain | Hidden behind first page load; health route warms on demand |
| Vercel function duration limits | Low | `maxDuration=60`, Node runtime, stream flushed continuously; no turn needs >60 s at our budgets |
| Prompt injection via web content | Medium | Snippets are data-in-tool-message; system prompt instructs citing not obeying; sanitize rendered markdown |

---

## 17. Decision Log (ADRs)

| # | Decision | Rationale |
|---|---|---|
| D1 | `messages` as one-row-per-message event log; NOT a JSON array appended in a thread cell | Append = whole-doc rewrite (write amplification), row-lock contention, full parse per read; JSONB still used per-message for `tool_calls`/`sources` |
| D2 | Window + rolling summary memory; full vector RAG deferred to v1.1 | O(1) prompt cost at any history length; zero embedding spend; `vector(768)` column reserved so upgrade needs no migration |
| D3 | Upstash Redis + QStash retained (evaluated Postgres-native alternative) | Managed DX, free tiers cover MVP; jobs are stale-tolerant so at-least-once is safe; revisit only past ~2–3k turns/day |
| D4 | Groq primary + fallback | LPU TTFT <100 ms and ~450 tok/s; Preview status of primary makes fallback structural |
| D5 | Better Auth | Library not service: zero per-seat cost, Drizzle adapter, owns its tables |
| D6 | Drizzle ORM | SQL-first, typed, first-class Neon serverless driver support |
| D7 | AI SDK UI message stream (SSE-framed) over WebSocket | Serverless-native, POST-friendly, one-directional; consumed natively by `useChat` — zero hand-rolled protocol |
| D8 | One Next.js deployable | Minimum infra, minimum cost, aligned with the mission |
| D9 | Adopt Vercel AI SDK (`ai` + `@ai-sdk/groq`) for the agent loop and UI streaming | Replaces the hand-rolled SSE protocol, client parser/state machine, and tool-loop mechanics with a maintained, Groq-documented SDK; rate limiting, memory assembly, tool executor, persistence, model fallback, and workers remain ours |

---

*End of AGENT.md. If you are an agent about to write code: re-read Section 10 and Section 14 for your phase, then check `pnpm verify` is green before you begin.*
