import { Client } from "@upstash/qstash";
import { getEnv } from "@/lib/env";
import { logStructuredError } from "@/lib/errors";

let qstashClient: Client | undefined;
let testClientOverride: Client | null = null;

export function setQStashClientForTesting(client: Client | null) {
  testClientOverride = client;
}

function getQStashClient(): Client | null {
  if (testClientOverride) {
    return testClientOverride;
  }
  try {
    const env = getEnv();
    if (!env.QSTASH_TOKEN || env.QSTASH_TOKEN.startsWith("sample_")) {
      return null;
    }
    if (!qstashClient) {
      qstashClient = new Client({ token: env.QSTASH_TOKEN });
    }
    return qstashClient;
  } catch {
    return null;
  }
}

/**
 * Enqueue side-effect jobs for a conversation (fire-and-forget).
 */
export async function enqueueSideEffects(
  conversationId: string,
  userId: string,
  msgCount = 0,
  summarizedCount = 0
): Promise<void> {
  const client = getQStashClient();
  const env = getEnv();

  // If QStash client is not configured (e.g. dev/test mode without credentials), log and return
  if (!client) {
    return;
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 1. Enqueue distill job after assistant turn
  try {
    await client.publishJSON({
      url: `${baseUrl}/api/workers/distill`,
      body: { conversationId, userId },
      headers: {
        "x-worker-secret": env.WORKER_SECRET,
      },
      retries: 5,
    });
  } catch (err) {
    logStructuredError({
      userId,
      conversationId,
      code: "INTERNAL",
      msg: "Failed to publish chat.distill to QStash",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Enqueue summarize job if lag >= 10
  if (msgCount - summarizedCount >= 10) {
    try {
      await client.publishJSON({
        url: `${baseUrl}/api/workers/summarize`,
        body: { conversationId, userId },
        headers: {
          "x-worker-secret": env.WORKER_SECRET,
        },
        retries: 5,
      });
    } catch (err) {
      logStructuredError({
        userId,
        conversationId,
        code: "INTERNAL",
        msg: "Failed to publish chat.summarize to QStash",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
