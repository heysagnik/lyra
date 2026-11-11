import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { getEnv } from "@/lib/env";
import { RATE_PER_MIN, RATE_PER_DAY, MAX_INFLIGHT } from "@/lib/agent/budget";

export interface RateLimitDecision {
  ok: boolean;
  retryAfter?: number;
  release?: () => Promise<void>;
}

let redisInstance: Redis | null = null;
let minLimiter: Ratelimit | null = null;
let dayLimiter: Ratelimit | null = null;

let testLimitersOverride: {
  minLimiter: { limit: (id: string) => Promise<{ success: boolean; reset: number }> };
  dayLimiter: { limit: (id: string) => Promise<{ success: boolean; reset: number }> };
} | null = null;

export function setLimitersForTesting(override: typeof testLimitersOverride) {
  testLimitersOverride = override;
}

function getRedis(): Redis | null {
  try {
    const env = getEnv();
    if (
      !env.UPSTASH_REDIS_REST_URL ||
      env.UPSTASH_REDIS_REST_URL.includes("sample-redis") ||
      !env.UPSTASH_REDIS_REST_TOKEN ||
      env.UPSTASH_REDIS_REST_TOKEN.startsWith("sample_")
    ) {
      return null;
    }
    if (!redisInstance) {
      redisInstance = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
    }
    return redisInstance;
  } catch {
    return null;
  }
}

function getLimiters() {
  if (testLimitersOverride) {
    return testLimitersOverride;
  }
  const redis = getRedis();
  if (!redis) return null;

  if (!minLimiter) {
    minLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_PER_MIN, "60 s"),
      prefix: "ratelimit:min",
    });
  }
  if (!dayLimiter) {
    dayLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_PER_DAY, "86400 s"),
      prefix: "ratelimit:day",
    });
  }
  return { redis, minLimiter, dayLimiter };
}

// In-memory tracking for in-flight requests or fallback
const inFlightCount = new Map<string, number>();

export async function checkRateLimits(userId: string): Promise<RateLimitDecision> {
  const limiters = getLimiters();
  const redis = limiters && "redis" in limiters ? limiters.redis : null;

  // Check in-flight first (distributed via Redis when available, in-memory fallback)
  if (redis) {
    const key = `inflight:${userId}`;
    const inflight = await redis.incr(key);
    if (inflight === 1) {
      await redis.expire(key, 60);
    }
    if (inflight > MAX_INFLIGHT) {
      await redis.decr(key);
      return {
        ok: false,
        retryAfter: 2,
      };
    }
  } else {
    const currentInFlight = inFlightCount.get(userId) || 0;
    if (currentInFlight >= MAX_INFLIGHT) {
      return {
        ok: false,
        retryAfter: 2,
      };
    }
    inFlightCount.set(userId, currentInFlight + 1);
  }

  // If Redis configured, check Upstash sliding windows
  if (limiters) {
    const [minRes, dayRes] = await Promise.all([
      limiters.minLimiter.limit(userId),
      limiters.dayLimiter.limit(userId),
    ]);

    if (!minRes.success) {
      if (redis) {
        await redis.decr(`inflight:${userId}`);
      } else {
        const count = inFlightCount.get(userId) || 1;
        if (count <= 1) inFlightCount.delete(userId);
        else inFlightCount.set(userId, count - 1);
      }
      const retryAfter = Math.ceil((minRes.reset - Date.now()) / 1000);
      return { ok: false, retryAfter: Math.max(1, retryAfter) };
    }

    if (!dayRes.success) {
      if (redis) {
        await redis.decr(`inflight:${userId}`);
      } else {
        const count = inFlightCount.get(userId) || 1;
        if (count <= 1) inFlightCount.delete(userId);
        else inFlightCount.set(userId, count - 1);
      }
      const retryAfter = Math.ceil((dayRes.reset - Date.now()) / 1000);
      return { ok: false, retryAfter: Math.max(1, retryAfter) };
    }
  }

  const release = async () => {
    if (redis) {
      try {
        const remaining = await redis.decr(`inflight:${userId}`);
        if (remaining <= 0) {
          await redis.del(`inflight:${userId}`);
        }
      } catch {
        // ignore
      }
    } else {
      const count = inFlightCount.get(userId) || 1;
      if (count <= 1) {
        inFlightCount.delete(userId);
      } else {
        inFlightCount.set(userId, count - 1);
      }
    }
  };

  return { ok: true, release };
}
