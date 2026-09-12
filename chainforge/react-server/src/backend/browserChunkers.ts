/**
 * Chunking implementations that run in the browser, with no backend.
 *
 * These exist so the Chunk node works when ChainForge is served without a
 * local Flask server -- the workshop / "just let me try RAG" case. They are
 * intentionally a small set: anything needing a real tokenizer (tiktoken,
 * HuggingFace) or embeddings (semantic, late chunking) stays server-side.
 *
 * A method with an implementation here is run here *whether or not* a backend
 * is available, so that a flow produces the same chunks either way. That is
 * also why `markdown_header` is a deliberate, verified port of the Python
 * implementation in chainforge/rag/chunkers.py rather than an approximation:
 * the two must not disagree.
 */

import { Dict } from "./typing";

export type BrowserChunker = (text: string, settings: Dict<any>) => string[];

/** Reads a numeric setting that may arrive as a string from a form. */
function numSetting(
  settings: Dict<any>,
  key: string,
  fallback: number,
): number {
  const raw = settings?.[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Splits markdown at ATX headings (levels 1-6), keeping each heading with its
 * section.
 *
 * Port of `markdown_header` in chainforge/rag/chunkers.py. Verified to produce
 * identical output to the Python version, including for text before the first
 * heading, "#hashtag" (not a heading, since ATX requires whitespace), and CRLF
 * line endings.
 */
export const markdownHeaderChunker: BrowserChunker = (text) => {
  if (text === null || text === undefined) return [""];

  const normalized = text.replace(/\r\n/g, "\n");
  const sections = normalized
    .split(/(?=^#{1,6}\s+)/m)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  return sections.length > 0 ? sections : [text];
};

/**
 * Fixed-size chunks measured in characters, with optional overlap.
 *
 * Characters rather than tokens on purpose: a faithful token count needs a
 * tokenizer we don't ship to the browser, and silently approximating tokens
 * would misrepresent chunk sizes to someone trying to learn how chunking
 * works.
 */
export const characterChunker: BrowserChunker = (text, settings) => {
  if (!text) return [];

  const size = Math.max(
    1,
    Math.floor(numSetting(settings, "chunk_size", 1000)),
  );
  // Clamp the overlap below the size, or the window would never advance.
  const overlap = Math.min(
    Math.max(0, Math.floor(numSetting(settings, "chunk_overlap", 100))),
    size - 1,
  );
  const step = size - overlap;

  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += step) {
    const chunk = text.slice(start, start + size).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (start + size >= text.length) break;
  }
  return chunks.length > 0 ? chunks : [text.trim()].filter((c) => c.length > 0);
};

/** Splits text into sentences, keeping terminal punctuation attached. */
export function splitSentences(text: string): string[] {
  // Deliberately not a lookbehind (/(?<=[.!?])\s+/): Safari only supports
  // lookbehind from 16.4, and an unsupported group is a SyntaxError when the
  // regex literal is parsed -- i.e. at module load, taking the app down rather
  // than failing this one function. Mark the boundaries, then split on the
  // marker instead.
  const BOUNDARY = "\u0000";
  return text
    .split(BOUNDARY)
    .join(" ")
    .replace(/([.!?])\s+/g, `$1${BOUNDARY}`)
    .split(BOUNDARY)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Groups whole sentences into chunks up to a character budget.
 *
 * Sentence boundaries keep chunks readable, which matters when the point is to
 * show someone what got retrieved.
 */
export const sentenceChunker: BrowserChunker = (text, settings) => {
  if (!text) return [];

  const size = Math.max(
    1,
    Math.floor(numSetting(settings, "chunk_size", 1000)),
  );
  const sentenceOverlap = Math.max(
    0,
    Math.floor(numSetting(settings, "sentence_overlap", 0)),
  );

  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join(" "));
    // Carry the trailing sentences forward as context for the next chunk.
    const carried = sentenceOverlap > 0 ? current.slice(-sentenceOverlap) : [];
    current = [...carried];
    currentLen = current.reduce((n, s) => n + s.length + 1, 0);
  };

  for (const sentence of sentences) {
    // A single sentence longer than the budget becomes its own chunk rather
    // than being split mid-word.
    if (current.length > 0 && currentLen + sentence.length + 1 > size) flush();
    current.push(sentence);
    currentLen += sentence.length + 1;
  }
  // Final flush, without carrying overlap forward into nothing.
  if (current.length > 0) chunks.push(current.join(" "));

  return chunks;
};

/**
 * Chunking methods runnable in the browser, keyed by the same `baseMethod`
 * identifiers the backend uses.
 */
export const BROWSER_CHUNKERS: Dict<BrowserChunker> = {
  markdown_header: markdownHeaderChunker,
  browser_character: characterChunker,
  browser_sentence: sentenceChunker,
};

/** The browser implementation for a method, if there is one. */
export function browserChunkerFor(
  baseMethod: string,
): BrowserChunker | undefined {
  return BROWSER_CHUNKERS[baseMethod];
}

/** Whether this chunking method can run without a backend. */
export function canChunkInBrowser(baseMethod: string): boolean {
  return browserChunkerFor(baseMethod) !== undefined;
}

/**
 * Runs a chunking method in the browser.
 * @throws If the method has no browser implementation.
 */
export function chunkInBrowser(
  baseMethod: string,
  text: string,
  settings: Dict<any>,
): string[] {
  const chunker = browserChunkerFor(baseMethod);
  if (!chunker)
    throw new Error(
      `The "${baseMethod}" chunking method needs the local ChainForge server.`,
    );
  return chunker(text, settings ?? {});
}
