/**
 * Every setting a Retrieval node method offers must change what it retrieves.
 *
 * Several settings once sat in the form doing nothing. See settingsContract.ts:
 * this pins the node's settings to the shared fixture, then requires, for the
 * methods run in the browser, a test showing each setting changes the results.
 */

import { describe, expect, jest, test } from "@jest/globals";
import { Dict } from "../typing";
import {
  RetrievalMethodSchemas,
  retrievalMethodGroups,
} from "../../RetrievalMethodSchemas";
import {
  RetrieveResponseRow,
  retrieveRequestInBrowser,
} from "../browserRetrieve";
import {
  SETTINGS_FIXTURE,
  browserMethods,
  contractGaps,
  formDefaults,
  offeredSettings,
} from "./settingsContract";

// Each fake model notices a different word, so which model is chosen changes
// the ranking.
jest.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async (_task: string, model: string) => async (text: string) => {
    const word = model.includes("MiniLM") ? "mat" : "cat";
    return { data: [text.includes(word) ? 1 : 0, 0, 0.1], dims: [1, 3] };
  },
}));

const NODE = SETTINGS_FIXTURE.retrieval;

test("the Retrieval node's settings match tests/fixtures/rag_setting_keys.json", () => {
  expect(
    offeredSettings(retrievalMethodGroups, RetrievalMethodSchemas),
  ).toEqual(NODE);
});

// "cat" is in fewer than half the documents, so BM25 gives it a positive idf.
const KEYWORD_CHUNKS = [
  "cat cat cat",
  "cat sat quietly beside the old wooden garden fence today",
  "dog barks loudly",
  "bird sings",
  "fish swims",
  "the cat and the dog",
  "horse runs",
  "cow eats",
];
const SEMANTIC_CHUNKS = ["the cat sat", "a mat by the door"];

interface Effect {
  query: string;
  chunks: string[];
  /** Applied over the form's defaults. */
  base: Dict<unknown>;
  changed: Dict<unknown>;
}

const keywordTopK: Effect = {
  query: "cat",
  chunks: KEYWORD_CHUNKS,
  base: { top_k: 3 },
  changed: { top_k: 1 },
};

const EFFECTS: Dict<Dict<Effect>> = {
  bm25: {
    top_k: keywordTopK,
    bm25_k1: {
      ...keywordTopK,
      base: { top_k: 8 },
      changed: { top_k: 8, bm25_k1: 0.5 },
    },
    bm25_b: {
      ...keywordTopK,
      base: { top_k: 8 },
      changed: { top_k: 8, bm25_b: 0 },
    },
  },
  boolean: {
    top_k: keywordTopK,
    required_match_count: {
      query: "cat dog",
      chunks: KEYWORD_CHUNKS,
      base: { top_k: 8, required_match_count: 1 },
      changed: { top_k: 8, required_match_count: 2 },
    },
  },
  overlap: { top_k: keywordTopK },
  browser_embedding: {
    top_k: {
      query: "cat mat",
      chunks: SEMANTIC_CHUNKS,
      base: { top_k: 2 },
      changed: { top_k: 1 },
    },
    browserEmbeddingModel: {
      query: "cat mat",
      chunks: SEMANTIC_CHUNKS,
      base: { top_k: 1, browserEmbeddingModel: "Xenova/bge-small-en-v1.5" },
      changed: { top_k: 1, browserEmbeddingModel: "Xenova/all-MiniLM-L6-v2" },
    },
  },
};

describe("browser retrieval: every setting has a test showing it matters", () => {
  test.each(browserMethods(NODE))("%s", (method, spec) => {
    expect(contractGaps(spec, EFFECTS[method])).toEqual({
      untested: [],
      stale: [],
    });
  });
});

async function retrieve(
  method: string,
  effect: Effect,
  settings: Dict<unknown>,
): Promise<RetrieveResponseRow[]> {
  return retrieveRequestInBrowser({
    methods: [
      {
        id: "m1",
        baseMethod: method,
        methodName: "Method",
        settings: { ...formDefaults(NODE, method), ...settings },
      },
    ],
    chunks: effect.chunks.map((text, i) => ({
      text,
      fill_history: { chunkMethod: "cm" },
      metavars: { docTitle: "doc.md", chunkId: String(i) },
    })),
    queries: [{ text: effect.query }],
  });
}

const ranking = (rows: RetrieveResponseRow[]) =>
  rows.map((r) => [r.text, r.eval_res.items[0].similarity.toFixed(6)]);

const effectCases = Object.entries(EFFECTS).flatMap(([method, settings]) =>
  Object.entries(settings).map(([key, effect]) => ({ method, key, effect })),
);

describe("browser retrieval: changing a setting changes the results", () => {
  test.each(effectCases)("$method.$key", async ({ method, effect }) => {
    const base = ranking(await retrieve(method, effect, effect.base));
    const changed = ranking(await retrieve(method, effect, effect.changed));
    expect(base.length).toBeGreaterThan(0);
    expect(changed).not.toEqual(base);
  });
});
