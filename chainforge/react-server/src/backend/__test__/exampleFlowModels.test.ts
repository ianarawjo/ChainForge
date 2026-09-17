/*
 * @jest-environment jsdom
 */
// The store and ModelSettingSchemas import each other (see backend.test.ts).
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: jest.fn() }),
  },
}));

// eslint-disable-next-line import/first
import { describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import fs from "fs";
// eslint-disable-next-line import/first
import path from "path";
// eslint-disable-next-line import/first
import JSZip from "jszip";
// eslint-disable-next-line import/first
import { ModelSettings } from "../../ModelSettingSchemas";

/**
 * Example flows went stale once already: they kept models that providers had
 * retired, and nothing noticed. So every model an example flow uses must be in
 * its provider's model menu, which is kept current.
 */
const EXAMPLES_DIR = path.resolve(__dirname, "../../../../examples");

/**
 * Flows kept on retired models on purpose, until they're redone (see TODO.md).
 * A flow leaves this list once its models are current. (Other flows awaiting a
 * redo, like python-coding-eval, use models OpenAI still serves; they'll fail
 * here once those models leave the menu.)
 */
const KEPT_ON_RETIRED_MODELS = new Set([
  "basic-function-calls.cforge",
  "mosquito-knowledge.cforge",
]);

/**
 * OpenRouter models that aren't in its menu, typed in on purpose. OpenRouter
 * accepts any model ID, so an example can use one, but it has to be listed here.
 */
const OFF_MENU_OPENROUTER_MODELS = new Set([
  // book-beginnings compares small open models, from 1B to 31B parameters.
  "google/gemma-4-31b-it",
  "meta-llama/llama-3.2-1b-instruct",
  "mistralai/ministral-8b-2512",
  "qwen/qwen3-8b",
]);

/** Each (base_model, model) pair in a flow, e.g. in Prompt Nodes and LLM Scorers. */
function modelsIn(value: unknown, found: [string, string][] = []) {
  if (Array.isArray(value)) value.forEach((v) => modelsIn(v, found));
  else if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.base_model === "string" && typeof obj.model === "string")
      found.push([obj.base_model, obj.model]);
    Object.values(obj).forEach((v) => modelsIn(v, found));
  }
  return found;
}

async function readFlow(filename: string): Promise<unknown> {
  const bytes = fs.readFileSync(path.join(EXAMPLES_DIR, filename));
  if (filename.endsWith(".cforge")) return JSON.parse(bytes.toString("utf8"));
  const zip = await JSZip.loadAsync(bytes);
  const flow = zip.file("flow.json");
  if (!flow) throw new Error(`${filename} has no flow.json`);
  return JSON.parse(await flow.async("string"));
}

/** Why a model isn't allowed, or undefined if it is. */
function problemWith(baseModel: string, model: string): string | undefined {
  const menu = ModelSettings[baseModel]?.schema?.properties?.model?.enum as
    | string[]
    | undefined;
  if (!menu) return `${model}: no model menu for provider "${baseModel}"`;
  // OpenRouter model IDs are saved with their provider prefix.
  const id = model.startsWith(`${baseModel}/`)
    ? model.slice(baseModel.length + 1)
    : model;
  if (menu.includes(id)) return undefined;
  if (baseModel === "openrouter" && OFF_MENU_OPENROUTER_MODELS.has(id))
    return undefined;
  return `${model} (${baseModel}) isn't in the model menu`;
}

const flowFiles = fs
  .readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith(".cforge") || f.endsWith(".cfzip"))
  .sort();

describe("example flows use current models", () => {
  test("there are example flows to check", () => {
    expect(flowFiles.length).toBeGreaterThan(10);
  });

  test.each(flowFiles)("%s", async (filename) => {
    const problems = Array.from(
      new Set(
        modelsIn(await readFlow(filename))
          .map(([baseModel, model]) => problemWith(baseModel, model))
          .filter((p): p is string => p !== undefined),
      ),
    );
    if (KEPT_ON_RETIRED_MODELS.has(filename))
      // Once its models are current, take it off the list so it stays current.
      expect(problems).not.toEqual([]);
    else expect(problems).toEqual([]);
  });

  test("the list of flows kept on retired models names real files", () => {
    KEPT_ON_RETIRED_MODELS.forEach((f) => expect(flowFiles).toContain(f));
  });
});
