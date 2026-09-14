/**
 * Every setting a Chunk node method offers must change how it chunks.
 *
 * See settingsContract.ts: this pins the node's settings to the shared
 * fixture, then requires, for the chunkers run in the browser, a test showing
 * each setting changes the chunks. tests/test_chunking_settings_matter.py
 * covers the server's chunkers.
 */

import { describe, expect, test } from "@jest/globals";
import { Dict } from "../typing";
import {
  ChunkMethodGroups,
  ChunkMethodSchemas,
} from "../../ChunkMethodSchemas";
import { chunkInBrowser } from "../browserChunkers";
import {
  SETTINGS_FIXTURE,
  browserMethods,
  contractGaps,
  formDefaults,
  offeredSettings,
} from "./settingsContract";

const NODE = SETTINGS_FIXTURE.chunking;

test("the Chunk node's settings match tests/fixtures/rag_setting_keys.json", () => {
  expect(offeredSettings(ChunkMethodGroups, ChunkMethodSchemas)).toEqual(NODE);
});

const TEXT =
  "The cat sat on the mat. The dog chased the cat around the yard. " +
  "A bird sang in the old oak tree. The fish swam slowly in the pond. " +
  "Rain fell softly on the roof all night.";

interface Effect {
  /** Applied over the form's defaults. */
  base: Dict<unknown>;
  changed: Dict<unknown>;
}

const EFFECTS: Dict<Dict<Effect>> = {
  browser_character: {
    chunk_size: { base: {}, changed: { chunk_size: 30 } },
    chunk_overlap: {
      base: { chunk_size: 30, chunk_overlap: 0 },
      changed: { chunk_size: 30, chunk_overlap: 10 },
    },
  },
  browser_sentence: {
    chunk_size: { base: {}, changed: { chunk_size: 40 } },
    sentence_overlap: {
      base: { chunk_size: 40, sentence_overlap: 0 },
      changed: { chunk_size: 40, sentence_overlap: 1 },
    },
  },
};

describe("browser chunking: every setting has a test showing it matters", () => {
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

describe("browser chunking: changing a setting changes the chunks", () => {
  test.each(effectCases)("$method.$key", ({ method, effect }) => {
    const chunk = (settings: Dict<unknown>) =>
      chunkInBrowser(method, TEXT, {
        ...formDefaults(NODE, method),
        ...settings,
      });
    const base = chunk(effect.base);
    expect(base.length).toBeGreaterThan(0);
    expect(chunk(effect.changed)).not.toEqual(base);
  });
});
