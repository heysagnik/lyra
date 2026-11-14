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
  "nvidia-nim": {
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    endpoint: "https://integrate.api.nvidia.com/v1",
    description: "NVIDIA-hosted NIM microservice inference (OpenAI-compatible)",
    apiKeyEnv: "NVIDIA_API_KEY",
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

  {
    id: "nim-nemotron-bolt-e4b",
    modelId: "nvidia/nemotron-3.5-bolt-e4b",
    label: "Nemotron 3.5 Bolt E4B",
    providerId: "nvidia-nim",
    description: "Fastest verified NIM model (~270ms first token)",
    contextWindow: 131072,
    pricing: { inPer1M: 0.04, outPer1M: 0.04 },
    isDefaultPrimary: true,
  },
  {
    id: "nim-laguna-xs",
    modelId: "poolside/laguna-xs-2.1",
    label: "Laguna XS 2.1",
    providerId: "nvidia-nim",
    description: "Poolside code model, very low latency",
    contextWindow: 131072,
    pricing: { inPer1M: 0.05, outPer1M: 0.15 },
  },
  {
    id: "nim-minimax-m3.1-flash",
    modelId: "minimaxai/minimax-m3.1-flash",
    label: "MiniMax M3.1 Flash",
    providerId: "nvidia-nim",
    description: "Fast MoE flash model, reliable under load",
    contextWindow: 131072,
    pricing: { inPer1M: 0.30, outPer1M: 1.20 },
  },
  {
    id: "nim-mistral-large-4",
    modelId: "mistralai/mistral-large-4-1t-a52b",
    label: "Mistral Large 4",
    providerId: "nvidia-nim",
    description: "Large 1T MoE with reasoning, ~1.7s first token",
    contextWindow: 131072,
    pricing: { inPer1M: 2.00, outPer1M: 6.00 },
  },
  {
    id: "nim-nemotron-3-ultra",
    modelId: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "Nemotron 3 Ultra 550B",
    providerId: "nvidia-nim",
    description: "Largest verified reasoning model, ~2.1s first token",
    contextWindow: 131072,
    pricing: { inPer1M: 2.00, outPer1M: 6.00 },
  },
  {
    id: "nim-nemotron-lightning",
    modelId: "nvidia/nemotron-3.5-lightning-30b-a3b",
    label: "Nemotron 3.5 Lightning 30B",
    providerId: "nvidia-nim",
    description: "Mid-size reasoning MoE with fast decode",
    contextWindow: 131072,
    pricing: { inPer1M: 0.20, outPer1M: 0.60 },
  },
];

export function listAvailableProviders(): ProviderDefinition[] {
  return Object.values(PROVIDERS);
}

export function listAvailableModels(): ModelDefinition[] {
  return REGISTERED_MODELS;
}

export function resolveModelDefinition(modelIdOrAlias?: string): ModelDefinition {
  // Default primary is Nemotron 3.5 Bolt E4B (NVIDIA NIM).
  const primaryModelId = "nvidia/nemotron-3.5-bolt-e4b";

  if (!modelIdOrAlias || modelIdOrAlias === "primary" || modelIdOrAlias === "fallback") {
    const found = REGISTERED_MODELS.find(
      (m) => m.modelId === primaryModelId || m.id === "nim-nemotron-bolt-e4b"
    );
    return (
      found || {
        id: "primary",
        modelId: primaryModelId,
        label: "Primary Model",
        providerId: "nvidia-nim",
        description: "Default primary model",
        contextWindow: 131072,
        pricing: { inPer1M: 0.04, outPer1M: 0.04 },
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
