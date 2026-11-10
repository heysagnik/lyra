import { Receiver } from "@upstash/qstash";
import { getEnv } from "@/lib/env";

export async function verifyWorkerRequest(
  request: Request,
  rawBody: string
): Promise<boolean> {
  const env = getEnv();

  // 1. Shared secret check (fast path)
  const workerSecret = request.headers.get("x-worker-secret");
  if (workerSecret && workerSecret === env.WORKER_SECRET) {
    return true;
  }

  // 2. QStash signature verification
  const signature = request.headers.get("upstash-signature");
  if (!signature) {
    return false;
  }

  try {
    const receiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });

    const isValid = await receiver.verify({
      signature,
      body: rawBody,
    });
    return isValid;
  } catch {
    return false;
  }
}
