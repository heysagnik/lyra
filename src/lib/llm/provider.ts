import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { getEnv } from "@/lib/env";
import {
  type ProviderDefinition,
  type ModelDefinition,
  PROVIDERS,
  resolveModelDefinition,
} from "./models";

export * from "./models";

const providerInstanceCache = new Map<string, unknown>();

function getGroqInstance() {
  if (!providerInstanceCache.has("groq")) {
    const env = getEnv();
    const groq = createGroq({
      apiKey: env.GROQ_API_KEY,
      baseURL: PROVIDERS.groq.endpoint,
    });
    providerInstanceCache.set("groq", groq);
  }
  return providerInstanceCache.get("groq") as ReturnType<typeof createGroq>;
}

export function getGroqProvider() {
  return getGroqInstance();
}

export function getLanguageModel(modelIdOrAlias?: string): {
  model: LanguageModel;
  modelName: string;
  definition: ModelDefinition;
  provider: ProviderDefinition;
} {
  const env = getEnv();
  const definition = resolveModelDefinition(modelIdOrAlias, env.GROQ_MODEL_PRIMARY);
  const provider = PROVIDERS[definition.providerId] || PROVIDERS.groq;

  // Currently Groq is the active provider
  const groq = getGroqInstance();
  return {
    model: groq(definition.modelId),
    modelName: definition.modelId,
    definition,
    provider,
  };
}
