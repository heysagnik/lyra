import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel } from "ai";
import type { LanguageModel } from "ai";
import { getEnv } from "@/lib/env";
import {
  type ProviderDefinition,
  type ModelDefinition,
  PROVIDERS,
  resolveModelDefinition,
} from "./models";
import { channelReasoningMiddleware } from "./channels";

export * from "./models";

let inferkit: ReturnType<typeof createOpenAICompatible> | undefined;

export function getInferKitProvider() {
  inferkit ??= createOpenAICompatible({
    name: "inferkit",
    apiKey: getEnv().INFERKIT_API_KEY,
    baseURL: PROVIDERS.inferkit.endpoint,
  });
  return inferkit;
}

export function getLanguageModel(modelIdOrAlias?: string): {
  model: LanguageModel;
  modelName: string;
  definition: ModelDefinition;
  provider: ProviderDefinition;
} {
  const definition = resolveModelDefinition(modelIdOrAlias);

  // Some models emit inline reasoning-channel tokens (<|channel>thought … <channel|>)
  // as literal content; the middleware turns them into proper reasoning parts.
  const model = wrapLanguageModel({
    model: getInferKitProvider()(definition.modelId),
    middleware: channelReasoningMiddleware,
  });

  return {
    model,
    modelName: definition.modelId,
    definition,
    provider: PROVIDERS.inferkit,
  };
}
