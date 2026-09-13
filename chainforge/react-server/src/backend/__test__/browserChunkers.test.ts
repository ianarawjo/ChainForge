import { describe, expect, test } from "@jest/globals";
import {
  BROWSER_CHUNKERS,
  canChunkInBrowser,
  characterChunker,
  chunkInBrowser,
  markdownHeaderChunker,
  sentenceChunker,
  splitSentences,
} from "../browserChunkers";

// No mocks needed: browserChunkers imports only a type.

describe("markdownHeaderChunker", () => {
  // The reference implementation is chainforge/rag/chunkers.py: the backend
  // still serves /chunk for any other caller, while the frontend runs this
  // port so a flow chunks identically with or without a server. Cases are
  // shared with the Python suite via a fixture, so a divergence fails a build
  // instead of quietly changing how documents get split.
  const sharedCases: { input: string; expected: string[] }[] = (() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    const fixture = path.resolve(
      __dirname,
      "../../../../../tests/fixtures/markdown_header_cases.json",
    );
    return JSON.parse(fs.readFileSync(fixture, "utf8")).cases;
  })();

  test("the fixture was found and is non-empty", () => {
    expect(sharedCases.length).toBeGreaterThan(0);
  });

  test.each(sharedCases)(
    "matches the Python implementation for $input",
    ({ input, expected }) => {
      expect(markdownHeaderChunker(input, {})).toEqual(expected);
    },
  );

  test("null and undefined are tolerated", () => {
    // The Python side takes None here; JSON cannot express it, so it is
    // covered separately in both suites.
    expect(markdownHeaderChunker(null as any, {})).toEqual([""]);
    expect(markdownHeaderChunker(undefined as any, {})).toEqual([""]);
  });
});

describe("characterChunker", () => {
  const text = "abcdefghij".repeat(10); // 100 chars

  test("splits into fixed-size pieces", () => {
    const chunks = characterChunker(text, {
      chunk_size: 25,
      chunk_overlap: 0,
    });
    expect(chunks).toHaveLength(4);
    expect(chunks.every((c) => c.length === 25)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });

  test("overlap repeats the tail of the previous chunk", () => {
    const chunks = characterChunker("0123456789", {
      chunk_size: 5,
      chunk_overlap: 2,
    });
    expect(chunks[0]).toBe("01234");
    expect(chunks[1]).toBe("34567");
  });

  test("an overlap at or above the size cannot hang", () => {
    // step would be <= 0, so the overlap has to be clamped.
    const chunks = characterChunker(text, {
      chunk_size: 10,
      chunk_overlap: 10,
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(200);
  });

  test("settings arriving as strings are coerced", () => {
    const chunks = characterChunker(text, {
      chunk_size: "25",
      chunk_overlap: "0",
    });
    expect(chunks).toHaveLength(4);
  });

  test("nonsense settings fall back to defaults", () => {
    expect(characterChunker("short text", { chunk_size: "abc" })).toEqual([
      "short text",
    ]);
  });

  test("text shorter than the chunk size is a single chunk", () => {
    expect(characterChunker("tiny", { chunk_size: 500 })).toEqual(["tiny"]);
  });

  test("empty text yields no chunks", () => {
    expect(characterChunker("", { chunk_size: 10 })).toEqual([]);
  });

  test("chunks are trimmed and blank ones dropped", () => {
    const chunks = characterChunker("ab        cd", {
      chunk_size: 4,
      chunk_overlap: 0,
    });
    expect(chunks).not.toContain("");
    expect(chunks.every((c) => c === c.trim())).toBe(true);
  });
});

describe("splitSentences", () => {
  test("splits on terminal punctuation and keeps it", () => {
    expect(splitSentences("One. Two! Three?")).toEqual([
      "One.",
      "Two!",
      "Three?",
    ]);
  });

  test("does not split on a period without following whitespace", () => {
    expect(splitSentences("version 1.2.3 works")).toEqual([
      "version 1.2.3 works",
    ]);
  });

  test("handles newlines between sentences", () => {
    expect(splitSentences("One.\nTwo.")).toEqual(["One.", "Two."]);
  });

  test("text with no punctuation is one sentence", () => {
    expect(splitSentences("no punctuation here")).toEqual([
      "no punctuation here",
    ]);
  });

  test("empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("sentenceChunker", () => {
  const text = "One. Two. Three. Four. Five.";

  test("groups sentences up to the character budget", () => {
    const chunks = sentenceChunker(text, { chunk_size: 12 });
    expect(chunks.length).toBeGreaterThan(1);
    // Never splits inside a sentence.
    for (const chunk of chunks)
      for (const sentence of splitSentences(chunk))
        expect(text).toContain(sentence);
  });

  test("a generous budget yields one chunk holding every sentence", () => {
    expect(sentenceChunker(text, { chunk_size: 10000 })).toEqual([text]);
  });

  test("no sentence is lost", () => {
    const chunks = sentenceChunker(text, { chunk_size: 12 });
    for (const sentence of splitSentences(text))
      expect(chunks.some((c) => c.includes(sentence))).toBe(true);
  });

  test("a sentence longer than the budget becomes its own chunk", () => {
    const long = "x".repeat(200) + ".";
    const chunks = sentenceChunker(`Short. ${long} Also short.`, {
      chunk_size: 20,
    });
    expect(chunks.some((c) => c.includes(long))).toBe(true);
  });

  test("sentence_overlap repeats trailing sentences", () => {
    const chunks = sentenceChunker(text, {
      chunk_size: 12,
      sentence_overlap: 1,
    });
    expect(chunks.length).toBeGreaterThan(1);
    // Consecutive chunks share a sentence.
    const first = splitSentences(chunks[0]);
    expect(chunks[1]).toContain(first[first.length - 1]);
  });

  test("empty text yields no chunks", () => {
    expect(sentenceChunker("", { chunk_size: 10 })).toEqual([]);
  });
});

describe("registry", () => {
  test("reports which methods run in the browser", () => {
    expect(canChunkInBrowser("markdown_header")).toBe(true);
    expect(canChunkInBrowser("browser_character")).toBe(true);
    expect(canChunkInBrowser("browser_sentence")).toBe(true);
  });

  test("server-only methods are not claimed", () => {
    for (const m of [
      "chonkie_token",
      "chonkie_semantic",
      "chonkie_late",
      "overlapping_openai_tiktoken",
      "overlapping_huggingface_tokenizers",
      "syntax_nltk",
      "syntax_texttiling",
    ])
      expect(canChunkInBrowser(m)).toBe(false);
  });

  test("every registered chunker returns strings", () => {
    for (const [name, chunker] of Object.entries(BROWSER_CHUNKERS)) {
      const out = chunker("# H\nSome text. More text.", { chunk_size: 50 });
      expect(Array.isArray(out)).toBe(true);
      expect(out.every((c) => typeof c === "string")).toBe(true);
      expect(name).toBeTruthy();
    }
  });

  test("chunkInBrowser dispatches by baseMethod", () => {
    expect(chunkInBrowser("markdown_header", "# A\nx", {})).toEqual(["# A\nx"]);
  });

  test("chunkInBrowser rejects a server-only method by name", () => {
    expect(() => chunkInBrowser("chonkie_semantic", "text", {})).toThrow(
      /needs the local ChainForge server/,
    );
  });
});
