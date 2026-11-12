import { executeDistillTask, executeSummarizeTask } from "./tasks";

export interface QueueTaskRunner {
  distill: typeof executeDistillTask;
  summarize: typeof executeSummarizeTask;
}

let testTaskRunnerOverride: Partial<QueueTaskRunner> | null = null;

export function setTaskRunnerForTesting(override: Partial<QueueTaskRunner> | null) {
  testTaskRunnerOverride = override;
}

/**
 * Enqueue side-effect jobs for a conversation (fire-and-forget).
 * Executes asynchronously in the background with zero external queue overhead.
 */
export async function enqueueSideEffects(
  conversationId: string,
  userId: string,
  msgCount = 0,
  summarizedCount = 0
): Promise<void> {
  const distillFn = testTaskRunnerOverride?.distill || executeDistillTask;
  const summarizeFn = testTaskRunnerOverride?.summarize || executeSummarizeTask;

  queueMicrotask(() => {
    void distillFn(conversationId, userId);
    if (msgCount - summarizedCount >= 10) {
      void summarizeFn(conversationId, userId);
    }
  });
}
