import doc from "../knowledge/nodes/textfields.md";
import { Dict } from "../../backend/typing";
import { doubleBraces, hasText, listOf, titleSetting } from "./common";
import { NodeKind } from "./types";

const valueItems = { key: String, label: (v: unknown) => `"${v}"` };

export const textfieldsKind: NodeKind = {
  type: "textfields",
  name: "TextFields Node",
  doc,
  output: "values",
  connectsTo: ["prompt", "textfields"],
  handles: { output: "output" },

  settings: {
    title: titleSetting,
    values: {
      label: "Values",
      required: true,
      items: valueItems,
      check: (value) => {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          !value.every((v) => typeof v === "string")
        )
          return "values should be a list of at least one piece of text.";
        if (value.some((v) => v.trim() === ""))
          return "values shouldn't include empty text; empty values are still sent downstream.";
        return doubleBraces("values", value);
      },
    },
    disabled_values: {
      label: "Disabled values",
      readOnly: true,
      items: valueItems,
    },
  },

  inputs: (settings, varsOf) =>
    varsOf(
      [...listOf(settings.values), ...listOf(settings.disabled_values)].map(
        String,
      ),
    ),

  missing: (settings) =>
    hasText(settings.values, (v) => v) ? undefined : "has no values yet",

  read(data) {
    const fields: Dict<string> = data.fields ?? {};
    const visibility: Dict<boolean> = data.fields_visibility ?? {};
    const ids = Object.keys(fields);
    return {
      title: data.title ?? textfieldsKind.name,
      values: ids
        .filter((id) => visibility[id] !== false)
        .map((id) => fields[id]),
      disabled_values: ids
        .filter((id) => visibility[id] === false)
        .map((id) => fields[id]),
    };
  },

  write(settings, base, { varsOf }) {
    const out: Dict = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;
    if (Array.isArray(settings.values)) {
      const fields: Dict<string> = base?.fields ?? {};
      const visibility: Dict<boolean> = base?.fields_visibility ?? {};
      const values = [...(settings.values as string[])];
      const next: Dict<string> = {};
      // Disabled values stay where they are; enabled ones are replaced in order.
      for (const [id, text] of Object.entries(fields)) {
        if (visibility[id] === false) next[id] = text;
        else if (values.length > 0) next[id] = values.shift() as string;
      }
      // New ids continue past the highest, as the node itself numbers them.
      let n =
        1 +
        Math.max(
          0,
          ...Object.keys(fields).map((id) => parseInt(id.slice(1)) || 0),
        );
      for (const text of values) next[`f${n++}`] = text;
      out.fields = next;
      out.fields_visibility = Object.fromEntries(
        Object.entries(visibility).filter(
          ([id, v]) => v === false && id in next,
        ),
      );
      out.vars = varsOf(Object.values(next));
    }
    return out;
  },
};
