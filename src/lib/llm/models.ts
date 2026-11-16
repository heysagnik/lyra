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
  /** Spends output tokens on hidden reasoning before the answer, so it needs a larger token budget. */
  reasoning?: boolean;
}

export const PROVIDERS: Record<string, ProviderDefinition> = {
  inferkit: {
    id: "inferkit",
    name: "InferKit",
    endpoint: "https://inferkit.sagnik.workers.dev/v1",
    description: "OpenAI-compatible inference gateway",
    apiKeyEnv: "INFERKIT_API_KEY",
  },
};

export const REGISTERED_MODELS: ModelDefinition[] = [
  {
    id: "nemotron-3-5-bolt-e4b",
    modelId: "nemotron-3-5-bolt-e4b",
    label: "Nemotron 3.5 Bolt E4B",
    providerId: "inferkit",
    description: "Fastest model, low first-token latency",
    contextWindow: 131072,
    pricing: { inPer1M: 0.04, outPer1M: 0.04 },
  },
  {
    id: "laguna-xs-2-1",
    modelId: "laguna-xs-2-1",
    label: "Laguna XS 2.1",
    providerId: "inferkit",
    description: "Fast, well-written answers; the default",
    contextWindow: 131072,
    pricing: { inPer1M: 0.05, outPer1M: 0.15 },
    isDefaultPrimary: true,
  },
  {
    id: "minimax-m3-1-flash",
    modelId: "minimax-m3-1-flash",
    label: "MiniMax M3.1 Flash",
    providerId: "inferkit",
    description: "Fast MoE flash model, reliable under load",
    contextWindow: 131072,
    pricing: { inPer1M: 0.3, outPer1M: 1.2 },
    reasoning: true,
  },
  {
    id: "mistral-large-4",
    modelId: "mistral-large-4",
    label: "Mistral Large 4",
    providerId: "inferkit",
    description: "Large MoE model with reasoning",
    contextWindow: 131072,
    pricing: { inPer1M: 2.0, outPer1M: 6.0 },
    reasoning: true,
  },
  {
    id: "nemotron-3-ultra-550b",
    modelId: "nemotron-3-ultra-550b",
    label: "Nemotron 3 Ultra 550B",
    providerId: "inferkit",
    description: "Largest reasoning model",
    contextWindow: 131072,
    pricing: { inPer1M: 2.0, outPer1M: 6.0 },
    reasoning: true,
  },
  {
    id: "nemotron-3-5-lightning-30b",
    modelId: "nemotron-3-5-lightning-30b",
    label: "Nemotron 3.5 Lightning 30B (experimental)",
    providerId: "inferkit",
    description: "Experimental: reasoning can exhaust the token budget",
    contextWindow: 131072,
    pricing: { inPer1M: 0.2, outPer1M: 0.6 },
    reasoning: true,
  },
];

const DEFAULT_MODEL =
  REGISTERED_MODELS.find((m) => m.isDefaultPrimary) ?? REGISTERED_MODELS[0];

/**
 * Small, fast, non-reasoning model for the harness's own helper calls (query
 * planning, grounding check), whatever model the user picked for the answer.
 */
export const HELPER_MODEL_ID = "nemotron-3-5-bolt-e4b";

/** Reliable non-reasoning model used to retry when the selected model returns no answer. */
export const FALLBACK_MODEL_ID = DEFAULT_MODEL.modelId;

/** Unknown or legacy ids (e.g. a saved Groq/NIM choice) resolve to the default model. */
export function resolveModelDefinition(modelIdOrAlias?: string): ModelDefinition {
  if (!modelIdOrAlias) return DEFAULT_MODEL;
  return (
    REGISTERED_MODELS.find((m) => m.id === modelIdOrAlias || m.modelId === modelIdOrAlias) ??
    DEFAULT_MODEL
  );
}
