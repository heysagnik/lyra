import { executeDistillTask, executeSummarizeTask } from "./tasks";

/**
 * Build the post-turn background job (memory extraction, rolling summary).
 * The caller hands it to Next's `after()`, so the platform keeps the function
 * alive until it finishes instead of freezing it when the response ends.
 */
export function buildSideEffects(
  conversationId: string,
  userId: string,
  msgCount = 0,
  summarizedCount = 0
): () => Promise<void> {
  return async () => {
    await executeDistillTask(conversationId, userId);
    if (msgCount - summarizedCount >= 10) {
      await executeSummarizeTask(conversationId, userId);
    }
  };
}
