import { generateText, generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/llm/provider";

export { getGroqProvider, getLanguageModel } from "@/lib/llm/provider";

export async function generateSummaryWithLlm(
  prompt: string,
  maxTokens: number
): Promise<string> {
  const { model } = getLanguageModel();
  const { text } = await generateText({
    model,
    prompt,
    maxOutputTokens: maxTokens,
  });
  return text.trim();
}

export async function extractMemoriesWithLlm<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T
): Promise<z.infer<T>> {
  const { model } = getLanguageModel();
  const res = await generateObject({
    model,
    schema,
    prompt,
  });
  return res.object;
}
