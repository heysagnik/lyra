import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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

function getNvidiaNimInstance() {
  if (!providerInstanceCache.has("nvidia-nim")) {
    const env = getEnv();
    if (!env.NVIDIA_API_KEY) {
      throw new Error(
        "[Lyra] NVIDIA_API_KEY is not set — required for NVIDIA NIM models."
      );
    }
    const nim = createOpenAICompatible({
      name: "nvidia-nim",
      apiKey: env.NVIDIA_API_KEY,
      baseURL: PROVIDERS["nvidia-nim"].endpoint,
    });
    providerInstanceCache.set("nvidia-nim", nim);
  }
  return providerInstanceCache.get("nvidia-nim") as ReturnType<
    typeof createOpenAICompatible
  >;
}

export function getNvidiaNimProvider() {
  return getNvidiaNimInstance();
}

export function getLanguageModel(modelIdOrAlias?: string): {
  model: LanguageModel;
  modelName: string;
  definition: ModelDefinition;
  provider: ProviderDefinition;
} {
  const definition = resolveModelDefinition(modelIdOrAlias);
  const provider = PROVIDERS[definition.providerId] || PROVIDERS.groq;

  let model: LanguageModel;
  if (definition.providerId === "nvidia-nim") {
    model = getNvidiaNimInstance()(definition.modelId);
  } else {
    // Groq is the default provider
    model = getGroqInstance()(definition.modelId);
  }

  return {
    model,
    modelName: definition.modelId,
    definition,
    provider,
  };
}
