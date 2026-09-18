// Checks the translation between node data and ChainBuddy's settings, using
// the example flows as real node data. If a node's data changes shape, these
// tests are meant to fail and point at adapters/nodeData.ts.

import { describe, expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import {
  dataWithSettings,
  inputsFor,
  modelIdOf,
  ModelResolver,
  settingsOf,
  supportOf,
} from "../adapters/nodeData";
import { LLMSpec } from "../../backend/typing";

const EXAMPLES = path.join(__dirname, "..", "..", "..", "..", "examples");

const resolver: ModelResolver = {
  idOf: modelIdOf,
  toSpec: (id, taken) => ({
    key: `new-${id}`,
    name: taken.includes(id) ? `${id} (2)` : id,
    emoji: "🤖",
    model: id,
    base_model: "openrouter",
    temp: 1,
  }),
};

// Every Prompt, TextFields and JavaScript Evaluator node in the examples.
const exampleNodes = fs
  .readdirSync(EXAMPLES)
  .filter((f) => f.endsWith(".cforge"))
  .flatMap((file) =>
    JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), "utf8"))
      .flow.nodes.filter((n: any) => supportOf(n.type, n.data) === "editable")
      .map((n: any) => [`${file}: ${n.id}`, n.type, n.data] as const),
  );

/** The parts of node data ChainBuddy reads and writes. */
const MANAGED: Record<string, string[]> = {
  prompt: ["prompt", "promptVariantLabel", "llms", "n", "title"],
  textfields: ["fields", "fields_visibility", "title"],
  evaluator: ["code", "language", "title"],
};

const pick = (data: any, keys: string[]) =>
  Object.fromEntries(
    keys.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]),
  );

test("the examples include every supported node type", () => {
  const types = new Set(exampleNodes.map(([, type]) => type));
  expect(Array.from(types).sort()).toEqual([
    "evaluator",
    "prompt",
    "textfields",
  ]);
});

describe.each(exampleNodes)("%s", (_, type, data) => {
  test("writing ChainBuddy's view back leaves the node as it was", () => {
    const settings = settingsOf(type, data, resolver);
    const editable = { ...settings };
    delete editable.disabled_values;
    const rebuilt = dataWithSettings(type, editable, data, resolver);

    expect(settingsOf(type, rebuilt, resolver)).toEqual(settings);
    // The node's own data is unchanged, apart from defaults filled in.
    const before = pick(data, MANAGED[type]);
    const after = pick(rebuilt, Object.keys(before));
    if (
      type === "prompt" &&
      Array.isArray(data.prompt) &&
      data.prompt.length === 1
    )
      after.prompt = [after.prompt]; // one variant is stored either way
    if (type === "prompt" && data.promptVariantLabel === undefined)
      delete after.promptVariantLabel;
    expect(after).toEqual(before);
  });
});

describe("dataWithSettings", () => {
  test("builds a new Prompt Node with variants and its inputs", () => {
    const data = dataWithSettings(
      "prompt",
      {
        title: "Summaries",
        prompts: [
          { label: "Plain", text: "Summarize: {text}" },
          { text: "For a child: {text} in {lang}" },
        ],
        models: [{ model: "a" }, { model: "a" }],
        responses_per_prompt: 3,
      },
      undefined,
      resolver,
    );
    expect(data).toMatchObject({
      title: "Summaries",
      prompt: ["Summarize: {text}", "For a child: {text} in {lang}"],
      promptVariantLabel: ["Plain", "Variant 2"],
      idxPromptVariantShown: 0,
      vars: ["text", "lang"],
      n: 3,
    });
    // The same model twice gets two distinct names, as the model menu does.
    expect(data.llms.map((l: LLMSpec) => l.name)).toEqual(["a", "a (2)"]);
  });

  test("keeps a Prompt Node's existing models, settings and all", () => {
    const existing: LLMSpec = {
      key: "k1",
      name: "Haiku",
      emoji: "📚",
      model: "openrouter/anthropic/claude-haiku-4.5",
      base_model: "openrouter",
      temp: 0.2,
      settings: { temperature: 0.2 },
    };
    const data = dataWithSettings(
      "prompt",
      { models: [{ model: "b" }, { model: existing.model }] },
      { prompt: "Hi", llms: [existing] },
      resolver,
    );
    expect(data.llms[1]).toBe(existing);
    expect(data.llms[0].model).toBe("b");
  });

  test("replaces TextFields values but keeps disabled ones", () => {
    const base = {
      fields: { f0: "old one", f1: "hidden {x}", f2: "old two" },
      fields_visibility: { f1: false },
    };
    const data = dataWithSettings(
      "textfields",
      { values: ["new one", "new two", "new three"] },
      base,
      resolver,
    );
    expect(data.fields).toEqual({
      f0: "new one",
      f1: "hidden {x}",
      f2: "new two",
      f3: "new three",
    });
    expect(data.fields_visibility).toEqual({ f1: false });
    expect(data.vars).toEqual(["x"]);
    expect(settingsOf("textfields", data, resolver)).toMatchObject({
      values: ["new one", "new two", "new three"],
      disabled_values: ["hidden {x}"],
    });
  });

  test("builds a JavaScript Evaluator", () => {
    expect(
      dataWithSettings(
        "evaluator",
        { code: "function evaluate(r) {}" },
        undefined,
        resolver,
      ),
    ).toEqual({ code: "function evaluate(r) {}", language: "javascript" });
  });
});

test("Python evaluators aren't supported", () => {
  expect(supportOf("evaluator", { language: "python" })).toBe("not-supported");
  expect(supportOf("evaluator", { language: "javascript" })).toBe("editable");
  expect(supportOf("vis", {})).toBe("not-supported");
});

test("inputs follow ChainForge's template rules", () => {
  expect(
    inputsFor("prompt", {
      prompts: [{ text: "{a} and \\{not} and {#ref} and {=system_msg}" }],
    }),
  ).toEqual(["a", "=system_msg"]);
  expect(inputsFor("evaluator", {})).toEqual(["responses"]);
});

test("model IDs match list_models", () => {
  expect(
    modelIdOf({
      name: "q",
      emoji: "🦙",
      model: "ollama",
      base_model: "ollama",
      temp: 1,
      settings: { ollamaModel: "qwen3.5:4b" },
    }),
  ).toBe("ollama/qwen3.5:4b");
});
