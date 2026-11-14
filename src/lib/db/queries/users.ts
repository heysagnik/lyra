import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";

/**
 * Resolve a user's plan tier from the user table. Defaults to "free" for
 * unknown users or unexpected values — never blocks a turn on a lookup miss.
 */
export async function getUserPlan(userId: string): Promise<"free" | "pro"> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ plan: user.plan })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.plan === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}
