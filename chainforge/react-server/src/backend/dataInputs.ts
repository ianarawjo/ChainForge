/**
 * Values from data nodes (Tabular Data, Text Fields, Items, Media) as
 * responses an evaluator can score, so data can connect straight to an LLM
 * Scorer without a Prompt Node in between. Each value is a response: a table
 * row's cell in the connected column, a text field, an item, or an image.
 * A table row's other columns become its variables, e.g. a ground-truth label
 * to compare judges to.
 */
import { cleanEscapedBraces } from "./template";
import { Dict, LLMResponse, LLMResponseData } from "./typing";

/** Node types whose outputs are values, rather than responses cached by a run. */
export const DATA_INPUT_NODE_TYPES = new Set([
  "table",
  "textfields",
  "csv",
  "media",
]);

/**
 * One value from a data node, as the store's `output` gives it: a plain string
 * (Text Fields, Items), or an object with text or an image, and for tables the
 * row's other columns (metavars) and id (associate_id).
 */
export type DataInputValue =
  | string
  | {
      text?: string;
      image?: string;
      metavars?: Dict<unknown>;
      fill_history?: Dict<unknown>;
      associate_id?: string;
    };

/**
 * Where a scorer keeps the responses it made from a data node's output, in the
 * storage cache. Scoped to the scorer, so two scorers reading the same data
 * don't overwrite each other's.
 */
export function dataInputCacheId(
  scorerId: string,
  sourceId: string,
  handle: string,
): string {
  return `${scorerId}__input__${sourceId}__${handle}`;
}

/** The prefix of a scorer's data-input cache ids (see dataInputCacheId). */
export const dataInputCachePrefix = (scorerId: string) =>
  `${scorerId}__input__`;

const asVars = (d?: Dict<unknown>): Dict<string> =>
  Object.fromEntries(
    Object.entries(d ?? {})
      .filter(([k]) => !k.startsWith("__"))
      .map(([k, v]) => [k, String(v)]),
  );

/**
 * A data node's values as responses. Text is unescaped (data nodes escape the
 * braces in text they pass on, for prompt templates); images become image
 * responses. Each keeps a stable id (a table row's id, else its position), so
 * its scores stay with it across runs. Empty values are skipped.
 *
 * @param label Shown where the Inspector names a response's model, e.g. the table column.
 */
export function dataValuesToResponses(
  sourceId: string,
  label: string,
  values: DataInputValue[],
): LLMResponse[] {
  return values.flatMap((v, i) => {
    const obj = typeof v === "string" ? { text: v } : v ?? {};
    let data: LLMResponseData;
    if (obj.image) data = { t: "img", d: obj.image };
    else {
      const text = cleanEscapedBraces(obj.text ?? "");
      if (text.trim().length === 0) return [];
      data = text;
    }
    return [
      {
        uid: `${sourceId}:${obj.associate_id ?? i}`,
        prompt: "",
        vars: { ...asVars(obj.fill_history), ...asVars(obj.metavars) },
        metavars: {},
        llm: label,
        responses: [data],
      },
    ];
  });
}
