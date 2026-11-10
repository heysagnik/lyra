import { createGroq } from "@ai-sdk/groq";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { getEnv } from "@/lib/env";

let cachedGroq: ReturnType<typeof createGroq> | undefined;

export function getGroqProvider() {
  if (!cachedGroq) {
    const env = getEnv();
    cachedGroq = createGroq({
      apiKey: env.GROQ_API_KEY,
    });
  }
  return cachedGroq;
}

export function getGroqModel(isFallback = false) {
  const env = getEnv();
  const provider = getGroqProvider();
  const modelName = isFallback
    ? env.GROQ_MODEL_FALLBACK
    : env.GROQ_MODEL_PRIMARY;
  return {
    model: provider(modelName),
    modelName,
  };
}

export async function generateSummaryWithLlm(
  prompt: string,
  maxTokens: number
): Promise<string> {
  const fallback = getGroqModel(true);
  const { text } = await generateText({
    model: fallback.model,
    prompt,
    maxOutputTokens: maxTokens,
  });
  return text.trim();
}

export async function extractMemoriesWithLlm<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T
): Promise<z.infer<T>> {
  const fallback = getGroqModel(true);
  const res = await generateObject({
    model: fallback.model,
    schema,
    prompt,
  });
  return res.object;
}
