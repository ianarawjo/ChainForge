/*
 * @jest-environment jsdom
 */
// Flask has no string table, so executepy must send it text (#371).

// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));

// Stub the store, as backend.test.ts does.
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));

// eslint-disable-next-line import/first
import { afterEach, beforeEach, expect, test } from "@jest/globals";
import { executepy } from "../backend";
import { StringLookup } from "../cache";
import { Dict, LLMResponse, LLMSpec } from "../typing";

let sent: Dict[];
const realFetch = global.fetch;

beforeEach(() => {
  sent = [];
  global.fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string);
    sent.push(body);
    return {
      json: async () => ({
        responses: body.responses.map((r: Dict) => ({
          ...r,
          eval_res: { items: r.responses.map(() => 1), dtype: "Numeric" },
        })),
        logs: [],
      }),
    };
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = realFetch;
});

const llm_spec = { name: "GPT-4o", model: "gpt-4o", emoji: "x" } as LLMSpec;

function makeResponse(llm: LLMResponse["llm"]): LLMResponse {
  return {
    uid: "u1",
    prompt: StringLookup.intern("What is the capital of France?"),
    vars: { country: StringLookup.intern("France") },
    metavars: { topic: StringLookup.intern("geography"), score: 7.5 },
    llm,
    responses: [
      StringLookup.intern("Paris"),
      "Lyon",
      StringLookup.intern("a \\{brace\\}"),
    ],
  };
}

test.each([
  ["a nickname in the string table", () => StringLookup.intern("my model")],
  ["an LLM spec", () => llm_spec],
])(
  "Flask is sent text for every field the evaluator reads, llm as %s",
  async (_name, getLlm) => {
    const llm = getLlm();
    const nickname = typeof llm === "object" ? llm.name : "my model";
    await executepy(
      "eval-id",
      "def evaluate(response): return 1",
      [makeResponse(llm)],
      "response",
      "evaluator",
      undefined,
      "flask",
    );

    expect(sent).toHaveLength(1);
    const r = sent[0].responses[0];
    expect(r.responses).toEqual(["Paris", "Lyon", "a {brace}"]);
    expect(r.prompt).toBe("What is the capital of France?");
    expect(r.vars).toEqual({ country: "France" });
    expect(r.metavars).toEqual({ topic: "geography", score: 7.5 });
    expect(r.llm).toBe(nickname);
  },
);

test("the responses handed back keep their string-table form, with Flask's scores", async () => {
  const input = makeResponse(llm_spec);
  const out = await executepy(
    "eval-id",
    "def evaluate(response): return 1",
    [input],
    "response",
    "evaluator",
    undefined,
    "flask",
  );

  const r = out.responses?.[0] as LLMResponse;
  expect(r.eval_res).toEqual({ items: [1, 1, 1], dtype: "Numeric" });
  expect(r.prompt).toBe(input.prompt);
  expect(r.vars).toEqual(input.vars);
  expect(r.metavars).toEqual(input.metavars);
  expect(r.llm).toEqual(llm_spec);
  expect(r.responses).toEqual(input.responses);
});

test("a processor's new texts come back in place of the responses", async () => {
  global.fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string);
    return {
      json: async () => ({
        responses: body.responses.map((r: Dict) => ({
          ...r,
          responses: r.responses.map((t: string) => t.toUpperCase()),
        })),
        logs: [],
      }),
    };
  }) as unknown as typeof fetch;

  const input = makeResponse(llm_spec);
  const out = await executepy(
    "eval-id",
    "def process(response): return response.text.upper()",
    [input],
    "response",
    "processor",
    undefined,
    "flask",
  );

  const r = out.responses?.[0] as LLMResponse;
  expect(r.responses).toEqual(["PARIS", "LYON", "A {BRACE}"]);
  expect(r.prompt).toBe(input.prompt);
  expect(r.llm).toEqual(llm_spec);
});

test("reasoning is still sent as text", async () => {
  const input = {
    ...makeResponse(llm_spec),
    reasoning: [StringLookup.intern("thought"), null, null],
  };
  await executepy(
    "eval-id",
    "def evaluate(response): return 1",
    [input],
    "response",
    "evaluator",
    undefined,
    "flask",
  );
  expect(sent[0].responses[0].reasoning).toEqual(["thought", null, null]);
});
