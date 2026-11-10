import type { Memory } from "@/types";

export const SYSTEM_PROMPT_T0 = `You are Aria, a helpful, direct assistant with access to live web search.

Rules:
- When search results are provided, cite them inline as [1], [2] matching the numbered sources.
- If search is enabled but results are insufficient to answer, say so explicitly.
- If search is disabled, answer from your own knowledge and note when freshness matters.
- Be concise. Use markdown. Put code in fenced blocks with a language tag.
- Facts about the user provided in USER MEMORY are reliable; use them without asking again.`;

export function assembleSystemPrompt(
  memories: Memory[] = [],
  summary: string | null = null
): string {
  const parts: string[] = [SYSTEM_PROMPT_T0];

  // T1: User Memory
  if (memories.length > 0) {
    const memoryLines = memories
      .map((m) => `- [${m.kind}] ${m.content}`)
      .join("\n");
    parts.push(`USER MEMORY:\n${memoryLines}`);
  }

  // T2: Rolling Summary
  if (summary && summary.trim().length > 0) {
    parts.push(`CONVERSATION SUMMARY:\n${summary.trim()}`);
  }

  return parts.join("\n\n");
}
