import { executeDistillTask, executeSummarizeTask } from "./tasks";

export async function enqueueSideEffects(
  conversationId: string,
  userId: string,
  msgCount = 0,
  summarizedCount = 0
): Promise<void> {
  queueMicrotask(() => {
    void executeDistillTask(conversationId, userId);
    if (msgCount - summarizedCount >= 10) {
      void executeSummarizeTask(conversationId, userId);
    }
  });
}
