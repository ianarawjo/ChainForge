/** Pieces several node kinds share. */

import { extractTemplateVars } from "../../backend/template";
import { isPlainObject } from "../runtime/tools";
import { SettingSpec } from "./types";

export const titleSetting: SettingSpec = {
  label: "Title",
  check: (value) =>
    typeof value === "string" ? undefined : "title should be text.",
};

/**
 * Models used to other template languages write {{name}}. ChainForge reads
 * that as a variable named "{name", and sends a stray brace to the model.
 */
export function doubleBraces(setting: string, texts: string[]) {
  return texts.some((text) => /\{\{|\}\}/.test(text))
    ? `${setting} use {{...}}. ChainForge variables use single braces, like {country}; write \\{ and \\} for literal braces.`
    : undefined;
}

/** Whether any item in a list has text that isn't blank. */
export function hasText(list: unknown, text: (item: unknown) => unknown) {
  return (
    Array.isArray(list) &&
    list.some((item) => String(text(item) ?? "").trim() !== "")
  );
}

/** A list setting's items, or an empty list. */
export function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A field of an item that may not be an object. */
export function field(item: unknown, key: string): unknown {
  return isPlainObject(item) ? item[key] : undefined;
}

/**
 * The {variables} in some texts, as ChainForge's nodes find them: not
 * \\{escaped\\} braces, and not {#name} references to earlier values.
 */
export function templateVars(texts: string[]): string[] {
  const vars = new Set<string>();
  for (const text of texts)
    for (const v of extractTemplateVars(text)) if (v[0] !== "#") vars.add(v);
  return Array.from(vars);
}
