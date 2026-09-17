/*
 * @jest-environment jsdom
 */
// queryLLM interns the strings it returns; here, interned strings start with "#".
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {},
  StringLookup: {
    get: (x: unknown) =>
      typeof x === "string" && x.startsWith("#") ? x.substring(1) : x,
  },
  MediaLookup: {},
}));
jest.mock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => ({
  __esModule: true,
  default: { getState: () => ({ AvailableLLMs: [] }) },
}));
// AI features query models through queryLLM; stand in for it here.
jest.mock("../backend", () => ({ queryLLM: jest.fn() }));

// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  AI_PROVIDERS,
  AIProvider,
  aiModelSpec,
  aiSetupProblem,
  autoPickAIProvider,
  getAIProviders,
} from "../aiModels";
// eslint-disable-next-line import/first
import {
  autofill,
  autofillTable,
  generateAndReplaceTable,
  generateColumn,
  parseJSONReply,
  queryAI,
} from "../ai";
// eslint-disable-next-line import/first
import { queryLLM } from "../backend";
// eslint-disable-next-line import/first
import { Dict, LLMSpec } from "../typing";

const queryLLMMock = queryLLM as unknown as jest.Mock<any>;

const provider = (name: string) =>
  AI_PROVIDERS.find((p) => p.name === name) as AIProvider;

/** Makes queryLLM reply with the given text to every prompt it's sent. */
function replyWith(reply: (prompt: string, vars: Dict) => string) {
  queryLLMMock.mockImplementation(
    async (_id: any, _llms: any, _n: any, prompt: any, vars: any) => {
      const inputs: Dict[] = vars?.input ?? [{ text: "" }];
      return {
        responses: inputs.map((input) => ({
          responses: [reply(prompt, input)],
          metavars: Object.fromEntries(
            Object.entries(input.metavars ?? {}).map(([k, v]) => [k, `#${v}`]),
          ),
        })),
        errors: {},
      };
    },
  );
}

beforeEach(() => {
  queryLLMMock.mockReset();
});

describe("choosing a provider", () => {
  test("Ollama is only offered when running locally", () => {
    expect(getAIProviders(false).map((p) => p.name)).not.toContain("Ollama");
    expect(getAIProviders(true).map((p) => p.name)).toContain("Ollama");
  });

  test("picks the first provider with an API key", () => {
    expect(
      autoPickAIProvider({ Google: "k", OpenAI: "k" }, [], true).name,
    ).toBe("OpenAI");
    expect(autoPickAIProvider({}, ["llama3.2"], true).name).toBe("Ollama");
    expect(autoPickAIProvider({}, ["llama3.2"], false).name).toBe("OpenRouter");
    expect(autoPickAIProvider({}, [], true).name).toBe("OpenRouter");
  });

  test("says what's missing before a provider can be used", () => {
    expect(aiSetupProblem(provider("Anthropic"), {}, [])).toMatch(
      /Anthropic API key/,
    );
    expect(
      aiSetupProblem(provider("Anthropic"), { Anthropic: "k" }, []),
    ).toBeUndefined();
    expect(aiSetupProblem(provider("Ollama"), {}, [])).toMatch(/Ollama models/);
    expect(aiSetupProblem(provider("Ollama"), {}, ["qwen3"])).toBeUndefined();
  });
});

describe("model specs", () => {
  test("uses the recommended model, prefixed for OpenRouter", () => {
    const spec = aiModelSpec(provider("OpenRouter"), "fast", {}, {}, []);
    expect(spec.model).toBe("openrouter/google/gemini-3.1-flash-lite");
    expect(spec.base_model).toBe("openrouter");
    expect(spec.key).toBeDefined();
    expect(spec.settings).toMatchObject({ reasoning_effort: "low" });
    expect(spec.settings).not.toHaveProperty("model");
  });

  test("uses the model the user chose for a tier", () => {
    const overrides = { OpenAI: { smart: "gpt-5.5" } };
    expect(
      aiModelSpec(provider("OpenAI"), "smart", overrides, {}, []).model,
    ).toBe("gpt-5.5");
    expect(
      aiModelSpec(provider("OpenAI"), "fast", overrides, {}, []).model,
    ).toBe("gpt-5.4-nano");
  });

  test("Ollama uses the first model pulled, through the chat endpoint", () => {
    const spec = aiModelSpec(
      provider("Ollama"),
      "fast",
      {},
      { Ollama_BaseURL: "http://myserver:11434" },
      ["qwen3:8b", "llama3.2"],
    );
    expect(spec.model).toBe("ollama");
    expect(spec.settings).toMatchObject({
      ollamaModel: "qwen3:8b",
      ollama_url: "http://myserver:11434",
      model_type: "chat",
    });
  });
});

describe("reading JSON replies", () => {
  test("bare, fenced, wrapped in words, or after thinking", () => {
    expect(parseJSONReply('["a", "b"]')).toEqual(["a", "b"]);
    expect(parseJSONReply('```json\n["a"]\n```')).toEqual(["a"]);
    expect(parseJSONReply('Sure! Here you go:\n["a"]\nEnjoy.')).toEqual(["a"]);
    expect(
      parseJSONReply('<think>maybe ["x"]?</think>\n{"rows": [["1"]]}'),
    ).toEqual({ rows: [["1"]] });
  });

  test("throws on a reply with no JSON", () => {
    expect(() => parseJSONReply("I can't help with that.")).toThrow();
  });
});

describe("AI features", () => {
  const model: LLMSpec = aiModelSpec(provider("OpenAI"), "fast", {}, {}, []);

  test("queries go through queryLLM, with the system message on the model", async () => {
    replyWith(() => "hi");
    await queryAI(model, "Say {hi}", { system: "Be brief." });
    const [, llms, , prompt, , , , noCache] = queryLLMMock.mock.calls[0];
    expect((llms as LLMSpec[])[0].settings?.system_msg).toBe("Be brief.");
    expect((llms as LLMSpec[])[0].model).toBe("gpt-5.4-nano");
    // Braces in the prompt are literal text, not template variables
    expect(prompt).toBe("Say \\{hi\\}");
    expect(noCache).toBe(true);
  });

  test("errors from the provider reach the user", async () => {
    queryLLMMock.mockImplementation(async () => ({
      responses: [],
      errors: { key: ["Incorrect API key provided"] },
    }));
    await expect(queryAI(model, "hi")).rejects.toThrow(
      "Incorrect API key provided",
    );
  });

  test("extending a list keeps its template variables", async () => {
    replyWith(() => '["Tell me about {city}", "Plan a trip to {{city}}"]');
    expect(await autofill(["What to eat in {city}"], 2, model)).toEqual([
      "Tell me about {city}",
      "Plan a trip to {city}",
    ]);

    replyWith(() => '["Tell me about Paris"]');
    await expect(autofill(["What to eat in {city}"], 1, model)).rejects.toThrow(
      /template variables/,
    );
  });

  test("table cells may contain pipes", async () => {
    replyWith(() => '[["a | b", "c"], {"x": "d", "y": "e | f"}]');
    expect(
      await autofillTable({ cols: ["x", "y"], rows: [["1", "2"]] }, 2, model),
    ).toEqual([
      ["a | b", "c"],
      ["d", "e | f"],
    ]);
  });

  test("extending a table accepts rows wrapped in an object", async () => {
    replyWith(() => '{"rows": [["cow", "moo"], ["sheep", "baa"]]}');
    expect(
      await autofillTable(
        { cols: ["animal", "sound"], rows: [["dog", "woof"]] },
        2,
        model,
      ),
    ).toEqual([
      ["cow", "moo"],
      ["sheep", "baa"],
    ]);
  });

  test("generates a table with named columns", async () => {
    replyWith(
      () =>
        '```json\n{"columns": ["City", "Country"], "rows": [["Paris", "France"], ["Lima", "Peru"]]}\n```',
    );
    expect(await generateAndReplaceTable("cities", 2, model)).toEqual({
      cols: ["City", "Country"],
      rows: [
        ["Paris", "France"],
        ["Lima", "Peru"],
      ],
    });
  });

  test("a new column's values line up with the rows, from one batched query", async () => {
    replyWith((_prompt, input) =>
      String(input.text).includes("Paris") ? "France" : "Peru",
    );
    const result = await generateColumn(
      { cols: ["City"], rows: [["Paris"], ["Lima"]] },
      "Country",
      model,
    );
    expect(result).toEqual({ col: "Country", rows: ["France", "Peru"] });
    expect(queryLLMMock).toHaveBeenCalledTimes(1);
  });

  test("braces in table cells are data, not template variables", async () => {
    replyWith(() => "travel");
    await generateColumn(
      { cols: ["Prompt"], rows: [["Tell me about {city}"]] },
      "Topic",
      model,
    );
    const vars = queryLLMMock.mock.calls[0][4] as Dict;
    expect(vars.input[0].text).toBe("Prompt: Tell me about \\{city\\}");
  });
});
