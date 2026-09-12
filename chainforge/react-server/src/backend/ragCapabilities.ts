/**
 * What RAG features are usable right now.
 *
 * ChainForge's RAG features were originally all-or-nothing: the Flask backend
 * reported whether the optional `chainforge[rag]` extra was installed, and the
 * whole node group was hidden if not. That means someone running ChainForge
 * from the browser -- no Python, no Docker -- sees no RAG features at all,
 * which is a lot of setup to ask of a workshop attendee who just wants to see
 * how retrieval works.
 *
 * Some of it, though, does not need a server: reading a .txt file, splitting it
 * on markdown headings, chunking it by size. So rather than one boolean, each
 * capability declares where it can run, and the UI offers whatever is possible.
 *
 * Keeping this in one module means "what works without a backend" has a single
 * answer, instead of being re-derived at each call site.
 */

import { RAG_AVAILABLE } from "./utils";
import { canChunkInBrowser } from "./browserChunkers";
import { canRetrieveInBrowser } from "./browserRetrievers";
import { canExtractTextInBrowser } from "./extractText";

/** Where a capability can execute. */
export type RunsIn =
  /** Pure client-side; works with or without a server. */
  | "browser"
  /** Needs the Flask backend with the `rag` extra installed. */
  | "backend"
  /** Has both implementations; prefer the browser to avoid a round trip. */
  | "both";

/** The RAG node types that can be added to a flow. */
export type RagNodeType = "upload" | "chunk" | "retrieval" | "rerank";

/**
 * Whether the Flask backend is present *and* has the RAG extra installed.
 *
 * When served by Flask this is injected synchronously into the page, so it is
 * already settled by first render. In a plain browser it stays false.
 */
export function ragBackendAvailable(): boolean {
  return RAG_AVAILABLE === true;
}

/** Whether something declaring `runsIn` can execute right now. */
export function canRunNow(runsIn: RunsIn): boolean {
  if (runsIn === "browser" || runsIn === "both") return true;
  return ragBackendAvailable();
}

/** Whether a capability will run client-side, given what's available. */
export function willRunInBrowser(runsIn: RunsIn): boolean {
  if (runsIn === "browser") return true;
  // "both" runs client-side even when a backend exists, so that a flow
  // produces identical results in either mode.
  if (runsIn === "both") return true;
  return false;
}

/**
 * Which RAG nodes are usable.
 *
 * Without a backend only the nodes with client-side implementations are
 * offered, rather than showing every node and failing once someone runs it.
 * Reranking is the one still missing.
 */
export function ragNodeAvailable(nodeType: RagNodeType): boolean {
  if (ragBackendAvailable()) return true;

  switch (nodeType) {
    case "upload":
      // Uploading works client-side, as does reading .txt/.md/.pdf/.docx.
      return true;
    case "chunk":
      return anyBrowserChunker();
    case "retrieval":
      return anyBrowserRetriever();
    case "rerank":
      // Reranking needs a cross-encoder model or the Cohere API; nothing to
      // run client-side yet.
      return false;
    default:
      return false;
  }
}

/** Whether at least one chunking method can run client-side. */
function anyBrowserChunker(): boolean {
  return (
    canChunkInBrowser("markdown_header") ||
    canChunkInBrowser("browser_character") ||
    canChunkInBrowser("browser_sentence")
  );
}

/**
 * Whether at least one retrieval method can run client-side.
 *
 * Only the lexical retrievers are consulted. The semantic one is registered in
 * browserRetrieve.ts rather than in BROWSER_RETRIEVERS -- importing it here
 * would close a cycle -- but it is always available, so this staying true is
 * what matters.
 */
function anyBrowserRetriever(): boolean {
  return (
    canRetrieveInBrowser("bm25") ||
    canRetrieveInBrowser("boolean") ||
    canRetrieveInBrowser("overlap")
  );
}

/** Whether any RAG feature at all is usable, for showing the node group. */
export function anyRagFeatureAvailable(): boolean {
  return (["upload", "chunk", "retrieval", "rerank"] as RagNodeType[]).some(
    ragNodeAvailable,
  );
}

/**
 * A short explanation of why RAG is limited, or undefined when it isn't.
 * Shown in the UI so the limitation is visible rather than puzzling.
 */
export function ragLimitationNotice(): string | undefined {
  if (ragBackendAvailable()) return undefined;
  return (
    "Running without a local ChainForge server: documents, chunking, keyword " +
    "retrieval and in-browser semantic search all run client-side. Run " +
    "ChainForge locally for hosted embedding providers, persistent vector " +
    "stores, TF-IDF and reranking."
  );
}

/** Re-exported so callers need only this module to reason about availability. */
export { canChunkInBrowser, canRetrieveInBrowser, canExtractTextInBrowser };
