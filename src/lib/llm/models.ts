export interface ProviderDefinition {
  id: string;
  name: string;
  endpoint: string;
  description: string;
  apiKeyEnv: string;
}

export interface ModelDefinition {
  id: string;
  modelId: string;
  label: string;
  providerId: string;
  description: string;
  contextWindow: number;
  pricing: {
    inPer1M: number;
    outPer1M: number;
  };
  isDefaultPrimary?: boolean;
}

export const PROVIDERS: Record<string, ProviderDefinition> = {
  groq: {
    id: "groq",
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1",
    description: "Ultra-fast LPU inference engine",
    apiKeyEnv: "GROQ_API_KEY",
  },
};

/**
 * Valid active models fetched directly from Groq's /models endpoint.
 */
export const REGISTERED_MODELS: ModelDefinition[] = [
  {
    id: "qwen-3.8-27b",
    modelId: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B",
    providerId: "groq",
    description: "Fast model with tool-use capabilities",
    contextWindow: 131072,
    pricing: { inPer1M: 0.05, outPer1M: 0.20 },
    isDefaultPrimary: true,
  },
  {
    id: "gpt-oss-20b",
    modelId: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    providerId: "groq",
    description: "High-throughput 20B open model",
    contextWindow: 131072,
    pricing: { inPer1M: 0.10, outPer1M: 0.30 },
  },
  {
    id: "gpt-oss-120b",
    modelId: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    providerId: "groq",
    description: "Large 120B open reasoning model",
    contextWindow: 131072,
    pricing: { inPer1M: 0.50, outPer1M: 0.80 },
  },
];

export function listAvailableProviders(): ProviderDefinition[] {
  return Object.values(PROVIDERS);
}

export function listAvailableModels(): ModelDefinition[] {
  return REGISTERED_MODELS;
}

export function resolveModelDefinition(
  modelIdOrAlias?: string,
  envPrimary?: string
): ModelDefinition {
  const primaryModelId = envPrimary || "qwen/qwen3.8-27b";

  if (!modelIdOrAlias || modelIdOrAlias === "primary" || modelIdOrAlias === "fallback") {
    const found = REGISTERED_MODELS.find(
      (m) => m.modelId === primaryModelId || m.id === "qwen-3.8-27b"
    );
    return (
      found || {
        id: "primary",
        modelId: primaryModelId,
        label: "Primary Model",
        providerId: "groq",
        description: "Default primary model",
        contextWindow: 131072,
        pricing: { inPer1M: 0.05, outPer1M: 0.20 },
      }
    );
  }

  const directMatch = REGISTERED_MODELS.find(
    (m) => m.id === modelIdOrAlias || m.modelId === modelIdOrAlias
  );
  if (directMatch) {
    return directMatch;
  }

  return {
    id: modelIdOrAlias,
    modelId: modelIdOrAlias,
    label: modelIdOrAlias,
    providerId: "groq",
    description: "Configured model",
    contextWindow: 131072,
    pricing: { inPer1M: 0.05, outPer1M: 0.20 },
  };
}
