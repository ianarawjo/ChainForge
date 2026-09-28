/**
 * Local model servers: finding the ones running on this machine and their
 * models, and listing them in the model menu. The finding happens on
 * ChainForge's own server (chainforge/local_models.py), so it needs ChainForge
 * running locally.
 */
import { OPENAI_COMPATIBLE_PREFIX } from "./models";
import { LLMGroup, LLMSpec } from "./typing";
import { APP_IS_RUNNING_LOCALLY, call_flask_backend } from "./utils";

export interface LocalServer {
  kind: "ollama" | "openai-compatible";
  /** What the server is, e.g. "LM Studio", as far as ChainForge can tell */
  name: string;
  base_url: string;
  models: string[];
}

/** The title of the model menu's group of local models. */
export const LOCAL_MODELS_GROUP = "Local models";

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

/**
 * The servers running on this machine, and their models. Empty when ChainForge
 * isn't running locally.
 *
 * The browser asks Ollama itself, as ChainForge always has (so an Ollama on the
 * browser's machine is found even when ChainForge runs in a container), and
 * ChainForge's server looks for OpenAI-compatible servers (see
 * chainforge/local_models.py).
 */
export async function discoverLocalModels(
  ollama_url?: string,
): Promise<LocalServer[]> {
  if (!APP_IS_RUNNING_LOCALLY()) return [];
  const [ollama, res] = await Promise.all([
    findOllama(ollama_url),
    call_flask_backend("discoverLocalModels", {}).catch(() => undefined),
  ]);
  const found = res?.servers;
  const others: LocalServer[] = Array.isArray(found) ? found : [];
  return ollama ? [ollama, ...others] : others;
}

/** Ollama and its models, if it's running. */
async function findOllama(
  ollama_url?: string,
): Promise<LocalServer | undefined> {
  const base = (ollama_url || DEFAULT_OLLAMA_URL)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  try {
    const resp = await fetch(`${base}/api/tags`);
    if (!resp.ok) return undefined;
    const data = await resp.json();
    if (!Array.isArray(data?.models)) return undefined;
    return {
      kind: "ollama",
      name: "Ollama",
      base_url: base,
      models: data.models
        .map((m: { name?: unknown }) => m?.name)
        .filter((name: unknown): name is string => typeof name === "string"),
    };
  } catch {
    return undefined; // not running
  }
}

/** "localhost:1234", from "http://localhost:1234/v1" */
export function serverAddress(base_url: string): string {
  try {
    return new URL(base_url).host;
  } catch {
    return base_url;
  }
}

const OLLAMA_ITEM: LLMSpec = {
  name: "Ollama",
  emoji: "🦙",
  model: "ollama",
  base_model: "ollama",
  temp: 1.0,
};

const OPENAI_COMPATIBLE_ITEM: LLMSpec = {
  name: "OpenAI-compatible server",
  emoji: "🔌",
  model: OPENAI_COMPATIBLE_PREFIX,
  base_model: "openai-compatible",
  temp: 1.0,
};

/**
 * The model menu's group of local models: Ollama and the OpenAI-compatible
 * servers found running, each with their models, and a generic entry for
 * each kind of server, for one that wasn't found.
 */
export function localModelsMenuGroup(servers: LocalServer[]): LLMGroup {
  const items: (LLMSpec | LLMGroup)[] = [];

  const ollama = servers.find((s) => s.kind === "ollama");
  if (ollama && ollama.models.length > 0)
    items.push({
      group: "Ollama",
      emoji: "🦙",
      items: ollama.models.map((model) => ({
        key: `ollama/${ollama.base_url}/${model}`,
        name: model,
        emoji: "🦙",
        model: "ollama",
        base_model: "ollama",
        temp: 1.0,
        settings: {
          ollamaModel: model,
          ollama_url: `${ollama.base_url.replace(/\/+$/, "")}/api`,
        },
      })),
    });
  else items.push(OLLAMA_ITEM);

  for (const server of servers) {
    if (server.kind !== "openai-compatible" || server.models.length === 0)
      continue;
    items.push({
      group: `${server.name} (${serverAddress(server.base_url)})`,
      emoji: "🔌",
      items: server.models.map((model) => ({
        key: `${server.base_url}/${model}`,
        // Hugging Face-style IDs are long; the part after the org reads better
        name: model.split("/").at(-1) ?? model,
        emoji: "🔌",
        model: OPENAI_COMPATIBLE_PREFIX + model,
        base_model: "openai-compatible",
        temp: 1.0,
        settings: { base_url: server.base_url },
      })),
    });
  }

  items.push(OPENAI_COMPATIBLE_ITEM);
  return { group: LOCAL_MODELS_GROUP, emoji: "🖥️", items };
}

/** Tells ChainForge's server whether offline mode is on, so it enforces it too. */
export async function syncOfflineModeToServer(on: boolean): Promise<void> {
  if (!APP_IS_RUNNING_LOCALLY()) return;
  try {
    await call_flask_backend("offlineMode", { on });
  } catch (err) {
    console.warn("Could not tell ChainForge's server about offline mode:", err);
  }
}
