import { useMemo } from "react";
import useStore from "./store";
import {
  AIModelOverrides,
  aiModelSpec,
  aiSetupProblem,
  autoPickAIProvider,
  getAIProvider,
} from "./backend/aiModels";
import { APP_IS_RUNNING_LOCALLY } from "./backend/utils";

const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

/**
 * The provider and models AI support features use, from the user's settings:
 * the provider they picked (or one picked from their API keys), and its
 * "fast" and "smart" models as LLMSpecs to query.
 */
export default function useAIFeatures() {
  const apiKeys = useStore((state) => state.apiKeys);
  const ollamaModels = useStore((state) => state.ollamaModels);
  const globalSettings = useStore((state) => state.globalSettings);

  return useMemo(() => {
    const chosenProvider = getAIProvider(
      globalSettings.aiProvider as string | undefined,
      IS_RUNNING_LOCALLY,
    );
    const provider =
      chosenProvider ??
      autoPickAIProvider(apiKeys, ollamaModels, IS_RUNNING_LOCALLY);
    const overrides = globalSettings.aiModels as AIModelOverrides | undefined;
    return {
      enabled: globalSettings.aiSupport !== false,
      provider,
      isAutoPicked: chosenProvider === undefined,
      /** What's missing before AI features can run, if anything, to show users. */
      setupProblem: aiSetupProblem(provider, apiKeys, ollamaModels, overrides),
      /** For generating data. */
      fastModel: aiModelSpec(
        provider,
        "fast",
        overrides,
        apiKeys,
        ollamaModels,
      ),
      /** For writing code, and EvalGen. */
      smartModel: aiModelSpec(
        provider,
        "smart",
        overrides,
        apiKeys,
        ollamaModels,
      ),
      apiKeys,
      ollamaModels,
      overrides,
    };
  }, [apiKeys, ollamaModels, globalSettings]);
}
