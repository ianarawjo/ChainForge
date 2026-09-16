import { beforeEach, describe, expect, test } from "@jest/globals";
import {
  AGGREGATE_LIMIT,
  describeOutput,
  EdgePreviewItem,
  summarizeScores,
} from "../../edgePreview";
import StorageCache, { StringLookup } from "../cache";
import { LLMResponse, TemplateVarInfo } from "../typing";

/** A response as prompt/evaluator nodes hand it downstream. */
function info(over: Partial<TemplateVarInfo> = {}): TemplateVarInfo {
  return { text: "hello", ...over };
}

/** A response as Multi-Eval hands it downstream. */
function llmResponse(over: Partial<LLMResponse> = {}): LLMResponse {
  return {
    uid: "u1",
    prompt: "p",
    vars: {},
    metavars: {},
    llm: "GPT-4o",
    responses: ["generated text"],
    ...over,
  } as LLMResponse;
}

describe("describeOutput", () => {
  test("treats nothing as an empty edge", () => {
    for (const empty of [null, undefined, []]) {
      const preview = describeOutput(empty);
      expect(preview.kind).toBe("empty");
      expect(preview.count).toBe(0);
      expect(preview.items).toHaveLength(0);
    }
  });

  test("wraps a lone non-array value", () => {
    const preview = describeOutput("just one");
    expect(preview.count).toBe(1);
    expect(preview.items[0].text).toBe("just one");
  });

  test("summarizes plain strings as text", () => {
    const preview = describeOutput(["alpha", "beta", "gamma", "delta"]);
    expect(preview.kind).toBe("text");
    expect(preview.count).toBe(4);
    expect(preview.items.map((i: EdgePreviewItem) => i.text)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  test("resolves interned string hashes", () => {
    const hash = StringLookup.intern("interned value");
    const preview = describeOutput([hash]);
    expect(preview.items[0].text).toBe("interned value");
  });

  test("collapses whitespace and truncates long text", () => {
    const preview = describeOutput([`a${" ".repeat(5)}b`, "x".repeat(400)]);
    expect(preview.items[0].text).toBe("a b");
    expect(preview.items[1].text?.endsWith("…")).toBe(true);
    expect(preview.items[1].text?.length).toBeLessThan(200);
  });

  test("reads an LLM off the response and tallies models by frequency", () => {
    const preview = describeOutput([
      info({ llm: "GPT-4o" }),
      info({ llm: "Claude" }),
      info({ llm: "GPT-4o" }),
    ]);
    expect(preview.kind).toBe("response");
    expect(preview.llms).toEqual([
      { name: "GPT-4o", count: 2 },
      { name: "Claude", count: 1 },
    ]);
  });

  test("accepts an LLM given as a spec object", () => {
    const preview = describeOutput([
      info({
        llm: { key: "k", name: "Llama 3", emoji: "", model: "m" } as any,
      }),
    ]);
    expect(preview.llms).toEqual([{ name: "Llama 3", count: 1 }]);
  });

  test("falls back to the LLM_<n> metavar when the llm spec is gone", () => {
    // A flow reloaded from a file keeps the metavar but loses `llm`.
    const preview = describeOutput([info({ metavars: { LLM_0: "GPT-4o" } })]);
    expect(preview.kind).toBe("response");
    expect(preview.llms).toEqual([{ name: "GPT-4o", count: 1 }]);
    expect(preview.items[0].llmName).toBe("GPT-4o");
  });

  test("prefers the innermost LLM_<n> when prompts are chained", () => {
    const preview = describeOutput([
      info({ metavars: { LLM_0: "upstream", LLM_1: "downstream" } }),
    ]);
    expect(preview.llms).toEqual([{ name: "downstream", count: 1 }]);
  });

  test("hides internal and LLM_<n> metavars but keeps real ones", () => {
    const preview = describeOutput([
      info({
        fill_history: { topic: "otters" },
        metavars: { source: "wiki", __pt: "template", LLM_0: "GPT-4o" },
      }),
    ]);
    expect(preview.varNames).toEqual(["topic"]);
    expect(preview.metavarNames).toEqual(["source"]);
  });

  test("classifies images, and a mix of images and text", () => {
    expect(
      describeOutput([info({ text: undefined, image: "uid-1" })]).kind,
    ).toBe("image");
    expect(
      describeOutput([info({ text: undefined, image: "uid-1" }), info()]).kind,
    ).toBe("mixed");
  });

  test("reads Multi-Eval's LLMResponse shape", () => {
    // Text lives in `responses`, variables in `vars` -- not `text`/`fill_history`.
    const preview = describeOutput([
      llmResponse({ vars: { topic: "otters" }, responses: ["first answer"] }),
    ]);
    expect(preview.kind).toBe("response");
    expect(preview.items[0].text).toBe("first answer");
    expect(preview.varNames).toEqual(["topic"]);
    expect(preview.llms).toEqual([{ name: "GPT-4o", count: 1 }]);
  });

  test("reads an image out of an LLMResponse", () => {
    const preview = describeOutput([
      llmResponse({ responses: [{ t: "img", d: "media-uid" }] }),
    ]);
    expect(preview.kind).toBe("image");
    expect(preview.items[0].imageUid).toBe("media-uid");
  });

  test("keeps at most three preview items but counts everything", () => {
    const preview = describeOutput(
      Array.from({ length: 50 }, (_, i) => `item ${i}`),
    );
    expect(preview.count).toBe(50);
    expect(preview.items).toHaveLength(3);
    expect(preview.sampled).toBe(false);
  });

  test("flags when the tallies stopped short of the whole payload", () => {
    const big = Array.from({ length: AGGREGATE_LIMIT + 1 }, () => "x");
    const preview = describeOutput(big);
    expect(preview.count).toBe(AGGREGATE_LIMIT + 1);
    expect(preview.sampled).toBe(true);
  });

  test("skips holes in the payload", () => {
    const preview = describeOutput(["a", null, undefined, "b"]);
    expect(preview.items.map((i: EdgePreviewItem) => i.text)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("summarizeScores", () => {
  const NODE = "evalNode1";

  /** Seeds the cache the way an evaluator's run does. */
  function seed(items: unknown[][]) {
    StorageCache.store(
      `${NODE}.json`,
      items.map((xs) =>
        llmResponse({ eval_res: { items: xs, dtype: "Unknown" } } as any),
      ),
    );
  }

  beforeEach(() => {
    StorageCache.clear(`${NODE}.json`);
  });

  test("returns nothing when the evaluator has never run", () => {
    expect(summarizeScores(NODE)).toBeNull();
  });

  test("returns nothing when cached responses carry no scores", () => {
    StorageCache.store(`${NODE}.json`, [llmResponse()]);
    expect(summarizeScores(NODE)).toBeNull();
  });

  test("returns nothing for a cache entry that is not a response list", () => {
    StorageCache.store(`${NODE}.json`, { not: "an array" });
    expect(summarizeScores(NODE)).toBeNull();
  });

  test("counts passes and failures for boolean scores", () => {
    seed([[true, false, true], [true]]);
    expect(summarizeScores(NODE)).toEqual({ n: 4, parts: ["✓ 3", "✗ 1"] });
  });

  test("reports min, median and max for numeric scores", () => {
    seed([[10, 30, 20]]);
    expect(summarizeScores(NODE)?.parts).toEqual([
      "min 10",
      "med 20",
      "max 30",
    ]);
  });

  test("averages the middle pair for an even number of scores", () => {
    seed([[10, 20, 30, 40]]);
    expect(summarizeScores(NODE)?.parts[1]).toBe("med 25");
  });

  test("rounds fractional scores rather than printing full precision", () => {
    seed([[0.123456, 0.987654]]);
    const parts = summarizeScores(NODE)?.parts ?? [];
    expect(parts[0]).toBe("min 0.12");
    expect(parts[2]).toBe("max 0.99");
  });

  test("tallies the top categories, most frequent first", () => {
    seed([["red", "blue", "red", "green", "red", "blue", "yellow"]]);
    expect(summarizeScores(NODE)?.parts).toEqual([
      "red 3",
      "blue 2",
      "green 1",
    ]);
  });

  test("names the criteria for multi-criteria results", () => {
    seed([[{ relevance: true, tone: false }], [{ relevance: true }]]);
    const scores = summarizeScores(NODE);
    expect(scores?.n).toBe(2);
    expect(scores?.criteria).toEqual(["relevance", "tone"]);
  });

  test("falls back to tallies when score types are mixed", () => {
    seed([[true, 3, "maybe"]]);
    expect(summarizeScores(NODE)?.n).toBe(3);
    expect(summarizeScores(NODE)?.parts.length).toBeGreaterThan(0);
  });
});
