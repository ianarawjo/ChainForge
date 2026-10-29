import doc from "../knowledge/nodes/evaluator.md";
import { titleSetting } from "./common";
import { NodeKind } from "./types";

export const evaluatorKind: NodeKind = {
  type: "evaluator",
  name: "JavaScript Evaluator",
  doc,
  output: "scored_responses",
  accepts: ["responses"],
  handles: { output: "output", inputs: { responses: "responseBatch" } },
  unconnectedHint: "Connect a Prompt Node's responses to it.",

  settings: {
    title: titleSetting,
    code: {
      label: "Code",
      required: true,
      code: true,
      check: (value) => {
        if (typeof value !== "string") return "code should be JavaScript text.";
        if (!/function\s+evaluate\s*\(/.test(value))
          return "code should define function evaluate(response).";
        // Parsed, not run: building a Function from text runs none of it.
        try {
          // eslint-disable-next-line no-new-func, no-new
          new Function(value);
        } catch (err) {
          return `code isn't valid JavaScript: ${err instanceof Error ? err.message : String(err)}.`;
        }
        return undefined;
      },
    },
  },

  inputs: () => ["responses"],

  // The same node type holds Python code too, which ChainBuddy doesn't edit.
  supports: (data) => data.language === "javascript",

  read(data) {
    return { title: data.title ?? evaluatorKind.name, code: data.code ?? "" };
  },

  write(settings, base) {
    const out = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;
    if (typeof settings.code === "string") out.code = settings.code;
    out.language = "javascript";
    return out;
  },
};
