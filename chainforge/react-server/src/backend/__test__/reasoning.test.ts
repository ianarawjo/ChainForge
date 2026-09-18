/*
 * @jest-environment jsdom
 */

// Same module stubs as openrouter.test.ts.
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {
    static getInstance() {
      return new StorageCache();
    }

    static store() {
      // Evaluators cache their results; nothing to keep in these tests.
    }
  },
  StringLookup: {
    get: (x: unknown) => x,
    concretizeDict: (d: unknown) => d,
  },
  MediaLookup: { get: async () => undefined },
}));
jest.mock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
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
import {
  REASONING_METAVAR,
  anthropic_chat_history,
  anthropic_clean_sampling,
  anthropic_thinking_config,
  call_chatgpt,
  chat_history_with_reasoning,
  cleanMetavarsFilterFunc,
  extract_reasoning,
  extract_reasoning_state,
  extract_responses,
  gemini_history_parts,
  gemini_thinking_config,
  merge_response_objs,
  set_api_keys,
  strip_reasoning_state,
  toStandardResponseFormat,
  withReasoningMetavar,
  withoutResponseMetavars,
} from "../utils";
// eslint-disable-next-line import/first
import { executejs } from "../backend";
// eslint-disable-next-line import/first
import { LLMProvider } from "../models";
// eslint-disable-next-line import/first
import { Dict, LLMResponse, RawLLMResponseObject } from "../typing";

const chatReply = (message: Dict) => ({
  choices: [{ message: { role: "assistant", ...message } }],
});

const respObj = (
  responses: string[],
  reasoning?: (string | null)[],
): RawLLMResponseObject => ({
  uid: "uid",
  prompt: "Q",
  vars: {},
  metavars: { topic: "math" },
  llm: "Model",
  responses,
  ...(reasoning && { reasoning }),
});

describe("extracting reasoning", () => {
  test("OpenRouter reasoning per response, with null where there is none", () => {
    const responses = [
      chatReply({ content: "A", reasoning: "Thinking about A" }),
      chatReply({ content: "B", reasoning: null }),
    ];
    expect(
      extract_reasoning(
        responses,
        "openrouter/qwen/qwen3.8-max-0902",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["Thinking about A", null]);
  });

  test("falls back to readable reasoning details: text and summaries, not encrypted ones", () => {
    const responses = [
      chatReply({
        content: "A",
        reasoning_details: [
          { type: "reasoning.summary", summary: "A summary." },
          { type: "reasoning.text", text: "Some steps." },
          { type: "reasoning.encrypted", data: "opaque" },
        ],
      }),
    ];
    expect(
      extract_reasoning(
        responses,
        "openrouter/openai/gpt-5.5",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["A summary.\n\nSome steps."]);
  });

  test("undefined when nothing is readable, and for image models and other providers", () => {
    const encryptedOnly = [
      chatReply({
        content: "A",
        reasoning_details: [{ type: "reasoning.encrypted", data: "opaque" }],
      }),
    ];
    expect(
      extract_reasoning(
        encryptedOnly,
        "openrouter/openai/gpt-5.5",
        LLMProvider.OpenRouter,
      ),
    ).toBeUndefined();
    expect(
      extract_reasoning(
        [{ b64_json: "AAAA" }],
        "openrouter-image/black-forest-labs/flux.2-klein-4b",
        LLMProvider.OpenRouter,
      ),
    ).toBeUndefined();
    expect(
      extract_reasoning(
        chatReply({ content: "A", reasoning: "Thinking" }),
        "gpt-4o",
        LLMProvider.OpenAI,
      ),
    ).toBeUndefined();
  });
});

describe("merging cached responses keeps reasoning lined up", () => {
  test("a side without reasoning gets nulls", () => {
    const merged = merge_response_objs(
      respObj(["new"]),
      respObj(["old 1", "old 2"], ["thought 1", null]),
    );
    expect(merged?.responses).toEqual(["new", "old 1", "old 2"]);
    expect(merged?.reasoning).toEqual([null, "thought 1", null]);
  });

  test("no reasoning on either side adds none", () => {
    const merged = merge_response_objs(respObj(["a"]), respObj(["b"]));
    expect(merged).not.toHaveProperty("reasoning");
  });
});

describe("the reasoning metavar", () => {
  test("is added for the response at an index, and left out otherwise", () => {
    const obj = respObj(["a", "b"], ["thought a", null]);
    expect(withReasoningMetavar(obj.metavars, obj, 0)).toEqual({
      topic: "math",
      [REASONING_METAVAR]: "thought a",
    });
    // Without reasoning, the same metavars object comes back untouched.
    expect(withReasoningMetavar(obj.metavars, obj, 1)).toBe(obj.metavars);
    const noReasoning = respObj(["a"]);
    expect(withReasoningMetavar(noReasoning.metavars, noReasoning, 0)).toBe(
      noReasoning.metavars,
    );
    expect(obj.metavars).not.toHaveProperty(REASONING_METAVAR);
  });

  test("is hidden from group-by and plot menus", () => {
    expect(cleanMetavarsFilterFunc(REASONING_METAVAR)).toBe(false);
    expect(cleanMetavarsFilterFunc("topic")).toBe(true);
  });

  test("JavaScript evaluators see each response's own reasoning in r.meta", async () => {
    const obj = respObj(
      ["answer 1", "answer 2"],
      ["because 1", null],
    ) as LLMResponse;
    // Evaluator code runs in the Code Evaluator node's hidden iframe.
    const iframe = document.createElement("iframe");
    iframe.id = "reasoning-test-iframe";
    document.body.appendChild(iframe);

    const { responses, error } = await executejs(
      "reasoning-test",
      "function evaluate(r) { return r.meta.reasoning || 'none'; }",
      [obj],
      "response",
      "evaluator",
    );
    expect(error).toBeUndefined();
    expect(responses?.[0].eval_res?.items).toEqual(["because 1", "none"]);
  });

  test("reasoning carried from an earlier model is left out of a new response's metavars", () => {
    const carried = {
      topic: "math",
      [REASONING_METAVAR]: "An earlier model's thinking",
    };
    expect(withoutResponseMetavars(carried)).toEqual({ topic: "math" });
    expect(carried).toHaveProperty(REASONING_METAVAR); // not changed in place
  });

  test("evaluators see the reasoning of responses pulled from a Prompt Node's output", async () => {
    // One response from a Prompt Node's output, with its reasoning as a metavar
    const pulled = toStandardResponseFormat({
      text: "4",
      prompt: "What is 2 + 2?",
      fill_history: {},
      metavars: { [REASONING_METAVAR]: "2 + 2 = 4" },
      reasoning_state: {
        provider: LLMProvider.DeepSeek,
        reasoning_content: "2 + 2 = 4",
      },
      llm: "Model",
      uid: "pulled",
    });
    expect(pulled.reasoning).toEqual(["2 + 2 = 4"]);
    expect(pulled.reasoning_state).toHaveLength(1);

    const iframe = document.createElement("iframe");
    iframe.id = "reasoning-pulled-iframe";
    document.body.appendChild(iframe);
    const { responses, error } = await executejs(
      "reasoning-pulled",
      "function evaluate(r) { return r.meta.reasoning || 'none'; }",
      [pulled],
      "response",
      "evaluator",
    );
    expect(error).toBeUndefined();
    expect(responses?.[0].eval_res?.items).toEqual(["2 + 2 = 4"]);
  });
});

describe("reasoning from each provider", () => {
  test("DeepSeek: reasoning_content beside each choice's content", () => {
    const response = {
      choices: [
        { message: { content: "4", reasoning_content: "2 + 2 = 4" } },
        { message: { content: "4" } },
      ],
    };
    expect(
      extract_reasoning(response, "deepseek-reasoner", LLMProvider.DeepSeek),
    ).toEqual(["2 + 2 = 4", null]);
  });

  test("Claude: thinking blocks, which the answer text leaves out", () => {
    const messages = [
      {
        content: [
          { type: "thinking", thinking: "Let me add.", signature: "sig" },
          { type: "redacted_thinking", data: "opaque" },
          { type: "text", text: "4" },
        ],
      },
      {
        // Thinking whose text was omitted
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: "Four" },
        ],
      },
    ];
    expect(
      extract_reasoning(messages, "claude-sonnet-5", LLMProvider.Anthropic),
    ).toEqual(["Let me add.", null]);
    expect(
      extract_responses(messages, "claude-sonnet-5", LLMProvider.Anthropic),
    ).toEqual(["4", "Four"]);
  });

  test("Gemini: thought parts", () => {
    const responses = [
      {
        text: "4",
        candidates: [
          {
            content: {
              parts: [{ text: "Adding.", thought: true }, { text: "4" }],
            },
          },
        ],
      },
    ];
    expect(
      extract_reasoning(responses, "gemini-3.8-flash", LLMProvider.Google),
    ).toEqual(["Adding."]);
  });

  test("OpenAI: reasoning summaries in Responses API results, and none from Chat Completions", () => {
    const results = [
      {
        status: "completed",
        output: [
          {
            type: "reasoning",
            summary: [
              { type: "summary_text", text: "Adding." },
              { type: "summary_text", text: "Checked." },
            ],
          },
          { type: "message", content: [{ type: "output_text", text: "4" }] },
        ],
      },
    ];
    expect(extract_reasoning(results, "gpt-5", LLMProvider.OpenAI)).toEqual([
      "Adding.\n\nChecked.",
    ]);
    expect(extract_responses(results, "gpt-5", LLMProvider.OpenAI)).toEqual([
      "4",
    ]);
    expect(
      extract_reasoning(
        { choices: [{ message: { content: "4" } }] },
        "gpt-5",
        LLMProvider.OpenAI,
      ),
    ).toBeUndefined();
  });
});

describe("Claude sampling settings", () => {
  const settings = { temperature: 0.5, top_k: -1, top_p: -1 };

  test("ChainForge's -1 (not set) never reaches the API", () => {
    expect(
      anthropic_clean_sampling({
        model: "claude-3-7-sonnet-latest",
        ...settings,
      }),
    ).toEqual({ model: "claude-3-7-sonnet-latest", temperature: 0.5 });
  });

  test("models after Opus 4.6 get no temperature, top_p or top_k", () => {
    for (const model of [
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-fable-5-1",
    ])
      expect(
        anthropic_clean_sampling({
          model,
          temperature: 1,
          top_k: 40,
          top_p: 0.9,
        }),
      ).toEqual({ model });
  });

  test("while thinking, only a temperature of 1 and a top_p of at least 0.95 are kept", () => {
    const thinking = { type: "enabled", budget_tokens: 2048 };
    expect(
      anthropic_clean_sampling({
        model: "claude-haiku-4-5",
        thinking,
        temperature: 0.5,
        top_k: 40,
        top_p: 0.9,
      }),
    ).toEqual({ model: "claude-haiku-4-5", thinking });
    expect(
      anthropic_clean_sampling({
        model: "claude-haiku-4-5",
        thinking,
        temperature: 1,
        top_p: 0.97,
      }),
    ).toEqual({
      model: "claude-haiku-4-5",
      thinking,
      temperature: 1,
      top_p: 0.97,
    });
    // Without thinking, sampling settings stay
    expect(
      anthropic_clean_sampling({
        model: "claude-haiku-4-5",
        temperature: 0.5,
        top_k: 40,
      }),
    ).toEqual({ model: "claude-haiku-4-5", temperature: 0.5, top_k: 40 });
  });
});

describe("asking providers for reasoning", () => {
  test("Claude: 'auto' asks for summarized thinking only from models that think by default", () => {
    expect(anthropic_thinking_config("claude-sonnet-5", {})).toEqual({
      thinking: { type: "adaptive", display: "summarized" },
    });
    expect(anthropic_thinking_config("claude-haiku-4-5", {})).toEqual({});
    expect(
      anthropic_thinking_config("claude-haiku-4-5", {
        thinking: "enabled",
        thinking_budget_tokens: 4000,
      }),
    ).toEqual({ thinking: { type: "enabled", budget_tokens: 4000 } });
    expect(
      anthropic_thinking_config("claude-opus-4-8", {
        thinking: "adaptive",
        effort: "low",
      }),
    ).toEqual({
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "low" },
    });
  });

  test("Gemini: thought summaries from thinking models, unless turned off", () => {
    expect(gemini_thinking_config("gemini-3.8-flash", {})).toEqual({
      includeThoughts: true,
    });
    expect(
      gemini_thinking_config("gemini-2.5-flash", { thinking_budget: 512 }),
    ).toEqual({ includeThoughts: true, thinkingBudget: 512 });
    expect(
      gemini_thinking_config("gemini-2.5-pro", { include_thoughts: false }),
    ).toBeUndefined();
    expect(gemini_thinking_config("gemini-2.0-flash", {})).toBeUndefined();
  });

  test("OpenAI: a reasoning summary sends reasoning models through the Responses API", async () => {
    set_api_keys({ OpenAI: "sk-test" });
    const calls: { url: string; init: RequestInit }[] = [];
    (globalThis as any).fetch = jest.fn(
      async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "4" }],
              },
            ],
          }),
        };
      },
    );

    const [, responses] = await call_chatgpt("What is 2 + 2?", "gpt-5", 2, 1, {
      reasoning_summary: "auto",
      reasoning_effort: "high",
      system_msg: "Be brief.",
      stop: [],
      seed: "",
      response_format: { type: "text" },
      max_completion_tokens: 2000,
    });

    expect(calls).toHaveLength(2); // one request per response
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toMatchObject({
      model: "gpt-5",
      instructions: "Be brief.",
      reasoning: { summary: "auto", effort: "high" },
      store: false,
      max_output_tokens: 2000,
    });
    expect(body.input).toHaveLength(1);
    expect(JSON.stringify(body.input[0])).toContain("What is 2 + 2?");
    for (const key of ["temperature", "stop", "seed", "n", "text"])
      expect(body).not.toHaveProperty(key);
    expect(extract_responses(responses, "gpt-5", LLMProvider.OpenAI)).toEqual([
      "4",
      "4",
    ]);
  });

  test("Gemini: a thinking level, for Gemini 3, instead of a budget", () => {
    expect(
      gemini_thinking_config("gemini-3.8-flash", {
        thinking_level: "low",
        thinking_budget: 512,
      }),
    ).toEqual({ includeThoughts: true, thinkingLevel: "LOW" });
  });
});

describe("sending reasoning back in later chat turns", () => {
  test("each provider's reasoning state is kept, tagged with its provider", () => {
    const claude = [
      {
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "redacted_thinking", data: "opaque" },
          { type: "text", text: "4" },
        ],
      },
    ];
    expect(
      extract_reasoning_state(claude, "claude-opus-5", LLMProvider.Anthropic),
    ).toEqual([
      {
        provider: LLMProvider.Anthropic,
        blocks: claude[0].content.slice(0, 2),
      },
    ]);

    const openai = [
      {
        output: [
          {
            type: "reasoning",
            id: "rs_1",
            summary: [],
            encrypted_content: "e",
          },
          { type: "message", content: [{ type: "output_text", text: "4" }] },
        ],
      },
    ];
    expect(
      extract_reasoning_state(openai, "gpt-5", LLMProvider.OpenAI),
    ).toEqual([{ provider: LLMProvider.OpenAI, items: [openai[0].output[0]] }]);

    const gemini = [
      {
        candidates: [
          { content: { parts: [{ text: "4", thoughtSignature: "sig" }] } },
        ],
      },
    ];
    expect(
      extract_reasoning_state(gemini, "gemini-3.8-flash", LLMProvider.Google),
    ).toEqual([
      {
        provider: LLMProvider.Google,
        parts: gemini[0].candidates[0].content.parts,
      },
    ]);

    const openrouter = [
      chatReply({
        content: "4",
        reasoning: "Adding.",
        reasoning_details: [{ type: "reasoning.text", text: "Adding." }],
      }),
      chatReply({ content: "4" }),
    ];
    expect(
      extract_reasoning_state(
        openrouter,
        "openrouter/anthropic/claude-sonnet-5",
        LLMProvider.OpenRouter,
      ),
    ).toEqual([
      {
        provider: LLMProvider.OpenRouter,
        reasoning_details: [{ type: "reasoning.text", text: "Adding." }],
      },
      null,
    ]);

    expect(
      extract_reasoning_state(
        { choices: [{ message: { content: "4", reasoning_content: "2+2" } }] },
        "deepseek-reasoner",
        LLMProvider.DeepSeek,
      ),
    ).toEqual([{ provider: LLMProvider.DeepSeek, reasoning_content: "2+2" }]);
  });

  const history = (provider: LLMProvider, state: Dict) => [
    { role: "user", content: "What is 2 + 2?" },
    {
      role: "assistant",
      content: "4",
      reasoning_state: { provider, ...state },
    },
  ];

  test("OpenAI-format providers get their own state back as message fields, and nobody else's", () => {
    const openrouter = history(LLMProvider.OpenRouter, {
      reasoning_details: [{ type: "reasoning.text", text: "Adding." }],
    });
    expect(
      chat_history_with_reasoning(openrouter, LLMProvider.OpenRouter)[1],
    ).toEqual({
      role: "assistant",
      content: "4",
      reasoning_details: [{ type: "reasoning.text", text: "Adding." }],
    });
    expect(
      chat_history_with_reasoning(openrouter, LLMProvider.DeepSeek)[1],
    ).toEqual({ role: "assistant", content: "4" });
    expect(strip_reasoning_state(openrouter)[1]).toEqual({
      role: "assistant",
      content: "4",
    });
  });

  test("Claude gets its thinking blocks back before its answer", () => {
    const blocks = [{ type: "thinking", thinking: "", signature: "sig" }];
    const turns = anthropic_chat_history(
      history(LLMProvider.Anthropic, { blocks }),
    );
    expect(turns[1]).toEqual({
      role: "assistant",
      content: [...blocks, { type: "text", text: "4" }],
    });
    // Another provider's turn goes back as plain text
    expect(
      anthropic_chat_history(history(LLMProvider.Google, { parts: [] }))[1],
    ).toEqual({ role: "assistant", content: "4" });
  });

  test("Gemini gets its own parts back, with their thought signatures", () => {
    const parts = [{ text: "4", thoughtSignature: "sig" }];
    expect(
      gemini_history_parts(history(LLMProvider.Google, { parts })[1] as any),
    ).toEqual(parts);
    expect(gemini_history_parts({ role: "assistant", content: "4" })).toEqual([
      { text: "4" },
    ]);
  });

  test("OpenAI gets its reasoning items back just before its answer, through the Responses API", async () => {
    set_api_keys({ OpenAI: "sk-test" });
    const calls: { init: RequestInit }[] = [];
    (globalThis as any).fetch = jest.fn(
      async (_url: string, init: RequestInit) => {
        calls.push({ init });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "8" }],
              },
            ],
          }),
        };
      },
    );
    const item = {
      type: "reasoning",
      id: "rs_1",
      summary: [],
      encrypted_content: "e",
    };
    await call_chatgpt("And times 2?", "gpt-5", 1, 1, {
      reasoning_summary: "auto",
      chat_history: history(LLMProvider.OpenAI, { items: [item] }),
    });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.include).toEqual(["reasoning.encrypted_content"]);
    expect(body.input.map((i: Dict) => i.type ?? i.role)).toEqual([
      "user",
      "reasoning",
      "assistant",
      "user",
    ]);
    expect(body.input[1]).toEqual(item);
    expect(body.input[2]).not.toHaveProperty("reasoning_state");
  });
});
