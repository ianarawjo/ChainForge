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
  generatePromptVariants,
  generateRubric,
  generateTestQuestions,
  parseJSONReply,
  queryAI,
  TEST_QUESTION_COLUMNS,
} from "../ai";
// eslint-disable-next-line import/first
import { queryLLM } from "../backend";
// eslint-disable-next-line import/first
import CancelTracker from "../canceler";
// eslint-disable-next-line import/first
import { UserForcedPrematureExit } from "../errors";
// eslint-disable-next-line import/first
import { Dict, LLMSpec } from "../typing";

const queryLLMMock = queryLLM as unknown as jest.Mock<any>;

const provider = (name: string) =>
  AI_PROVIDERS.find((p) => p.name === name) as AIProvider;

/** Makes queryLLM reply with the given text to every prompt it's sent. */
function replyWith(reply: (prompt: string, vars: Dict) => string) {
  queryLLMMock.mockImplementation(
    async (_id: any, _llms: any, _n: any, prompt: any, vars: any) => {
      const inputs: Dict[] = Array.isArray(vars?.input)
        ? vars.input
        : [{ text: vars?.input ?? "" }];
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

  test("a new column's values line up with the rows, one query per row", async () => {
    replyWith((_prompt, input) =>
      String(input.text).includes("Paris") ? "France" : "Peru",
    );
    const result = await generateColumn(
      { cols: ["City"], rows: [["Paris"], ["Lima"]] },
      "Country",
      model,
    );
    expect(result).toMatchObject({
      col: "Country",
      rows: ["France", "Peru"],
      failed: 0,
      canceled: false,
    });
    expect(queryLLMMock).toHaveBeenCalledTimes(2);
  });

  // Replies to each row with its number, except rows that `fail` says fail;
  // `onCall` runs first on each call, e.g. to throw.
  const replyPerRow = (
    fail: (text: string) => boolean = () => false,
    onCall: (call: number) => void = () => undefined,
  ) => {
    let call = 0;
    queryLLMMock.mockImplementation(async (...args: any[]) => {
      onCall(++call);
      const text = String(args[4].input);
      return fail(text)
        ? { responses: [], errors: { key: ["Timed out"] } }
        : {
            responses: [{ responses: [text.replace(/\D/g, "")] }],
            errors: {},
          };
    });
  };
  const bigTable = {
    cols: ["n"],
    rows: Array.from({ length: 120 }, (_, i) => [`${i}`]),
  };

  test("a big column reports progress, and leaves failed rows blank", async () => {
    replyPerRow((text) => text === "n: 7");
    const progress: any[] = [];
    const result = await generateColumn(bigTable, "Same", model, undefined, {
      onProgress: (p) => progress.push(p),
    });
    expect(queryLLMMock).toHaveBeenCalledTimes(120);
    expect(result.rows[3]).toBe("3");
    expect(result.rows[119]).toBe("119");
    expect(result.rows[7]).toBe("");
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(["Timed out"]);
    expect(progress[progress.length - 1]).toEqual({
      done: 119,
      failed: 1,
      total: 120,
    });
  });

  test("stopping keeps the rows already filled", async () => {
    const cancelId = "stop-test";
    // Rows finish in order; the stop comes as row 61 is being queried
    replyPerRow(undefined, (call) => {
      if (call === 61) CancelTracker.add(cancelId);
      if (CancelTracker.has(cancelId)) throw new UserForcedPrematureExit();
    });
    const result = await generateColumn(bigTable, "Same", model, undefined, {
      cancelId,
    });
    expect(result.canceled).toBe(true);
    expect(result.rows.slice(0, 60).every((r) => r !== "")).toBe(true);
    expect(result.rows.slice(60).every((r) => r === "")).toBe(true);
  });

  test("a row that errors doesn't stop the others", async () => {
    replyPerRow(undefined, (call) => {
      if (call === 71) throw new Error("Rate limited");
    });
    const result = await generateColumn(bigTable, "Same", model);
    expect(result.rows[69]).toBe("69");
    expect(result.rows[70]).toBe("");
    expect(result.rows[71]).toBe("71");
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(["Rate limited"]);
  });

  test("examples to extend from fit the prompt, however long the cells", async () => {
    const long = "word ".repeat(1000);
    replyWith(() => '[["a"]]');
    await autofillTable(
      { cols: ["text"], rows: Array.from({ length: 200 }, () => [long]) },
      1,
      model,
    );
    const tablePrompt = String(queryLLMMock.mock.calls[0][3]);
    expect(tablePrompt.length).toBeLessThan(15000);
    expect(tablePrompt).toContain("…");

    replyWith(() => '["a"]');
    await autofill(
      Array.from({ length: 200 }, () => long),
      1,
      model,
    );
    expect(String(queryLLMMock.mock.calls[1][3]).length).toBeLessThan(15000);
  });

  test("braces in table cells are data, not template variables", async () => {
    replyWith(() => "travel");
    await generateColumn(
      { cols: ["Prompt"], rows: [["Tell me about {city}"]] },
      "Topic",
      model,
    );
    const vars = queryLLMMock.mock.calls[0][4] as Dict;
    expect(vars.input).toBe("Prompt: Tell me about \\{city\\}");
  });

  test("prompt variants keep the prompt's template variables", async () => {
    replyWith(() =>
      JSON.stringify([
        "Briefly, what's the capital of {country}?",
        "What is the capital of {country}?",
        "Name a city in France.",
        "Tell me the capital of {{country}}, in one word.",
      ]),
    );
    expect(
      await generatePromptVariants(
        "What is the capital of {country}?",
        3,
        "",
        model,
      ),
    ).toEqual([
      "Briefly, what's the capital of {country}?",
      "Tell me the capital of {country}, in one word.",
    ]);

    replyWith(() => '["Name a city in France."]');
    await expect(
      generatePromptVariants("What is the capital of {country}?", 1, "", model),
    ).rejects.toThrow(/template variables/);
  });

  test("rubrics fit the expected format, and come back as plain text", async () => {
    replyWith(() => '```\n"Score 1 to 5 for politeness."\n```');
    expect(await generateRubric("politeness", "num", model)).toBe(
      "Score 1 to 5 for politeness.",
    );
    const llm = (queryLLMMock.mock.calls[0][1] as LLMSpec[])[0];
    expect(llm.settings?.system_msg).toMatch(/a number/);

    replyWith(() => "Say true if the response is polite and brief.");
    await generateRubric("also brief", "bin", model, undefined, "Polite?");
    expect(queryLLMMock.mock.calls[1][3]).toMatch(/Polite\?[\s\S]*also brief/);
  });

  test("test questions spread over the documents, one query per document", async () => {
    // Each document is asked for its number of questions at once
    replyWith((_prompt, input) => {
      const text = String(input.text);
      const count = Number(/Questions to write: (\d+)/.exec(text)?.[1]);
      const topic = text.includes("cats") ? "cats" : "dogs";
      return JSON.stringify(
        Array.from({ length: count }, (_, i) => ({
          question: `About ${topic} ${i + 1}?`,
          answer: "Yes.",
        })),
      );
    });
    const rows = await generateTestQuestions(
      [
        { text: "All about cats.", source: "cats.pdf" },
        { text: "All about dogs {and braces}.", source: "dogs.pdf" },
        { text: "   ", source: "empty.pdf" },
      ],
      3,
      "",
      model,
    );
    expect(queryLLMMock).toHaveBeenCalledTimes(2);
    expect(TEST_QUESTION_COLUMNS).toEqual([
      "question",
      "reference",
      "answer_context",
      "source_doc",
    ]);
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row).toHaveLength(4);
      expect(row[0]).toMatch(row[3] === "cats.pdf" ? /cats/ : /dogs/);
      expect(row[2]).toMatch(/All about/);
    });
    // Both documents are asked, one of them for two different questions, and the empty one never
    const questions = rows.map((row) => row[0]);
    expect(new Set(questions).size).toBe(3);
    expect(new Set(rows.map((row) => row[3]))).toEqual(
      new Set(["cats.pdf", "dogs.pdf"]),
    );

    await expect(
      generateTestQuestions([{ text: "", source: "x" }], 1, "", model),
    ).rejects.toThrow(/no documents/);
  });
});
