/**
 * Every setting a Rerank node method offers must change how it reranks.
 *
 * See settingsContract.ts: this pins the node's settings to the shared
 * fixture, then requires, for the reranker run in the browser, a test showing
 * each setting changes the ranking. tests/test_reranking_settings_matter.py
 * covers the server's rerankers.
 */

import { describe, expect, jest, test } from "@jest/globals";
import { Dict } from "../typing";
import {
  RerankMethodSchemas,
  rerankMethodGroups,
} from "../../RerankMethodSchemas";
import { rerankInBrowser } from "../browserRerankers";
import {
  SETTINGS_FIXTURE,
  browserMethods,
  contractGaps,
  formDefaults,
  offeredSettings,
} from "./settingsContract";

// The fake scores longer documents higher, or lower for the L-12 model, so
// which model is chosen changes the ranking.
jest.mock("@huggingface/transformers", () => ({
  env: {},
  AutoTokenizer: {
    from_pretrained: async () => (query: string[], opts: any) => ({
      query,
      pair: opts.text_pair,
    }),
  },
  AutoModelForSequenceClassification: {
    from_pretrained: async (model: string) => async (inputs: any) => ({
      logits: {
        tolist: () =>
          inputs.pair.map((doc: string) => [
            (model.includes("L-12") ? -1 : 1) * doc.length,
          ]),
      },
    }),
  },
}));

const NODE = SETTINGS_FIXTURE.reranking;

test("the Rerank node's settings match tests/fixtures/rag_setting_keys.json", () => {
  expect(offeredSettings(rerankMethodGroups, RerankMethodSchemas)).toEqual(
    NODE,
  );
});

const DOCUMENTS = ["a", "bb", "ccc", "dddd", "eeeee", "ffffff"];

interface Effect {
  /** Applied over the form's defaults. */
  base: Dict<unknown>;
  changed: Dict<unknown>;
}

const EFFECTS: Dict<Dict<Effect>> = {
  browser_cross_encoder: {
    top_k: { base: {}, changed: { top_k: 2 } },
    browserRerankModel: {
      base: {},
      changed: { browserRerankModel: "Xenova/ms-marco-MiniLM-L-12-v2" },
    },
  },
};

describe("browser reranking: every setting has a test showing it matters", () => {
  test.each(browserMethods(NODE))("%s", (method, spec) => {
    expect(contractGaps(spec, EFFECTS[method])).toEqual({
      untested: [],
      stale: [],
    });
  });
});

const effectCases = Object.entries(EFFECTS).flatMap(([method, settings]) =>
  Object.entries(settings).map(([key, effect]) => ({ method, key, effect })),
);

describe("browser reranking: changing a setting changes the ranking", () => {
  test.each(effectCases)("$method.$key", async ({ method, effect }) => {
    const rerank = async (settings: Dict<unknown>) =>
      (
        await rerankInBrowser(DOCUMENTS, "query", {
          ...formDefaults(NODE, method),
          ...settings,
        })
      ).map((doc) => doc.index);
    const base = await rerank(effect.base);
    expect(base.length).toBeGreaterThan(0);
    expect(await rerank(effect.changed)).not.toEqual(base);
  });
});
