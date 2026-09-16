/** React bindings for the edge previews; the logic lives in ./edgePreview. */

import { useEffect, useMemo, useState } from "react";
import useStore from "./store";
import { Dict } from "./backend/typing";
import {
  describeOutput,
  EdgePreview,
  EdgeScoreSummary,
  EMPTY_PREVIEW,
  OPAQUE_SOURCE_TYPES,
  SCORING_SOURCE_TYPES,
  summarizeScores,
} from "./edgePreview";

export type {
  EdgePayloadKind,
  EdgePreview,
  EdgePreviewItem,
  EdgeScoreSummary,
} from "./edgePreview";

// Descriptions are shared across every edge leaving the same handle of the
// same node, and thrown away when that node's data is replaced (which
// setDataPropsForNode does by deep-copying, so identity is a safe key).
const previewCache = new WeakMap<Dict, Map<string, EdgePreview>>();

/**
 * Summarizes what an edge is carrying, for the preview badge and hover card.
 *
 * Returns null while there is no source node to pull from. Rasterizing the
 * source's output can be costly (a table node maps over every row), so results
 * are memoized until the source node's data changes.
 */
export function useEdgePreview(
  sourceId: string,
  sourceHandle?: string | null,
): EdgePreview | null {
  const sourceData = useStore((state) => state.getNode(sourceId)?.data) as
    | Dict
    | undefined;
  const sourceType = useStore((state) => state.getNode(sourceId)?.type);
  const output = useStore((state) => state.output);

  return useMemo(() => {
    if (sourceData === undefined || !sourceHandle) return null;

    // Some nodes never hand anything to output(): their results go to the
    // response cache, and consumers read them by node id (grabResponses).
    // There is nothing here to preview, so leave those edges plain rather
    // than let the card claim they are empty.
    if (OPAQUE_SOURCE_TYPES.has(sourceType ?? "")) return null;

    // A prompt node's source handle is named "prompt", and the node also keeps
    // its own template text on `data.prompt` — so output()'s generic
    // `data[handle]` fallback hands back the template, which is node-internal
    // state rather than anything in flight. Its real output is `fields`,
    // written when it runs. Every other node either uses `fields`, is a table,
    // or (Multi-Eval, Retrieval) stores a genuine payload under the handle's
    // own name, so the fallback is right for them.
    const isUnrunPrompt =
      (sourceType === "prompt" || sourceType === "chat") &&
      !("fields" in sourceData);

    let byHandle = previewCache.get(sourceData);
    if (byHandle === undefined) {
      byHandle = new Map();
      previewCache.set(sourceData, byHandle);
    }
    const cached = byHandle.get(sourceHandle);
    if (cached !== undefined) return cached;

    let preview: EdgePreview;
    if (isUnrunPrompt) preview = EMPTY_PREVIEW;
    else
      try {
        // NOTE: We deliberately don't pass the target node/handle here: that
        // asks output() to delete the edge when the source is missing, which
        // is not something a preview should ever do.
        preview = describeOutput(output(sourceId, sourceHandle));
      } catch (err) {
        console.error("Could not preview edge data:", err);
        preview = EMPTY_PREVIEW;
      }
    preview = {
      ...preview,
      // An evaluator's own responses carry scores, even though `fields` drops
      // the eval_res on the way out; the card reads them back on hover.
      scored:
        preview.kind !== "empty" && SCORING_SOURCE_TYPES.has(sourceType ?? ""),
      sourceName:
        typeof sourceData.title === "string" && sourceData.title.length > 0
          ? sourceData.title
          : undefined,
    };

    byHandle.set(sourceHandle, preview);
    return preview;
  }, [sourceId, sourceHandle, sourceData, sourceType, output]);
}

export default useEdgePreview;

export function useEdgeScores(
  sourceId: string,
  enabled: boolean,
): EdgeScoreSummary | null {
  const [scores, setScores] = useState<EdgeScoreSummary | null>(null);

  useEffect(() => {
    if (!enabled) {
      setScores(null);
      return;
    }
    try {
      setScores(summarizeScores(sourceId));
    } catch (err) {
      console.error("Could not read edge scores:", err);
      setScores(null);
    }
  }, [sourceId, enabled]);

  return scores;
}
