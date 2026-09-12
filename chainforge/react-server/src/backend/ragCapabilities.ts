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
 * Retrieval and reranking are server-side for now; when browser retrievers
 * land, they move here.
 */
export function ragNodeAvailable(nodeType: RagNodeType): boolean {
  if (ragBackendAvailable()) return true;

  switch (nodeType) {
    case "upload":
      // Uploading and reading text both work client-side (.txt / .md).
      return true;
    case "chunk":
      return anyBrowserChunker();
    case "retrieval":
    case "rerank":
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
    "Running without a local ChainForge server: only browser-based document " +
    "and chunking features are available. Run ChainForge locally for PDF/DOCX, " +
    "embeddings, vector stores and reranking."
  );
}

/** Re-exported so callers need only this module to reason about availability. */
export { canChunkInBrowser, canExtractTextInBrowser };
