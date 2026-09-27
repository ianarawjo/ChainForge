/**
 * Adding a model from the model menu to a node, shared by the Prompt Node's
 * menu (LLMListComponent) and anything else that adds models, such as
 * ChainBuddy, so a model added either way is set up the same.
 */

import { v4 as uuid } from "uuid";
import { getDefaultModelSettings } from "./ModelSettingSchemas";
import {
  BEDROCK_PREFIX,
  NativeLLM,
  HUGGINGFACE_PREFIX,
  OPENROUTER_IMAGE_PREFIX,
  OPENROUTER_PREFIX,
  TOGETHER_PREFIX,
} from "./backend/models";
import { LLMSpec } from "./backend/typing";
import { ensureUniqueName } from "./backend/utils";

/** Prefixes on some providers' model names, which the settings form leaves off. */
export const MODEL_NAME_PREFIXES: Record<string, string> = {
  together: TOGETHER_PREFIX,
  openrouter: OPENROUTER_PREFIX,
  "openrouter-image": OPENROUTER_IMAGE_PREFIX,
  hf: HUGGINGFACE_PREFIX,
  bedrock: BEDROCK_PREFIX,
};

/**
 * A model from the menu, ready to add to a node: a unique key, a name no
 * other model in the node has, and the default settings for its model.
 * @param menuItem The model as the menu lists it.
 * @param takenNames Names of the models already in the node.
 * @param ollamaBaseURL A custom Ollama server URL, if the user has set one.
 */
export function newModelSpec(
  menuItem: LLMSpec,
  takenNames: string[],
  ollamaBaseURL?: string,
): LLMSpec {
  const item: LLMSpec = { ...menuItem, key: uuid() };
  item.name = ensureUniqueName(item.name, takenNames);
  item.formData = { shortname: item.name };

  // Strip any provider prefix (e.g. "together/") from the model name the form shows:
  const prefix = MODEL_NAME_PREFIXES[item.base_model];
  if (prefix && item.model.startsWith(prefix))
    item.formData.model = item.model.substring(prefix.length);
  else item.formData.model = item.model;

  // Generate the default settings for this model
  item.settings = getDefaultModelSettings(
    item.base_model,
    item.formData.model as string,
  );

  // Ollama models use a different format for the model name, that we need to carry over:
  if (
    item.base_model === "ollama" ||
    item.base_model === NativeLLM.Ollama_Decision
  ) {
    if (menuItem.settings?.ollamaModel) {
      item.formData.ollamaModel = menuItem.settings.ollamaModel;
      item.settings.ollamaModel = menuItem.settings.ollamaModel;
    }
    // If the user has entered a custom base url, pass it over
    if (ollamaBaseURL) {
      item.formData.ollama_url = ollamaBaseURL;
      item.settings.ollama_url = ollamaBaseURL;
    }
  }
  return item;
}
