/**
 * Shared by the *Settings.test.ts files.
 *
 * Each RAG node's settings form offers settings that must each change what
 * its method does. tests/fixtures/rag_setting_keys.json lists them with the
 * defaults the forms fill in; the tests pin that list to the schemas, then
 * require an effect test for every setting of a method run in the browser.
 * tests/test_*_settings_matter.py does the same on the server.
 */

import { Dict, ModelSettingsDict } from "../typing";

export interface MethodSettings {
  runsIn: string;
  /** Each setting's form default, or null when the form has none. */
  settings: Dict<unknown>;
}

export type NodeSettings = Dict<MethodSettings>;

export const SETTINGS_FIXTURE: {
  retrieval: NodeSettings;
  chunking: NodeSettings;
  reranking: NodeSettings;
} = (() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../../tests/fixtures/rag_setting_keys.json",
      ),
      "utf8",
    ),
  );
})();

/** Settings that aren't meant to change what a method does, and why. */
export const NO_EFFECT_EXPECTED: Dict<string> = {
  shortName:
    "The method's display name. It labels results rather than changing them.",
};

/** A schema's settings and their defaults, including conditional ones. */
function settingDefaults(schema: ModelSettingsDict): Dict<unknown> {
  const defaults: Dict<unknown> = {};
  const add = (properties: Dict<any>) => {
    for (const [key, property] of Object.entries(properties))
      if (!(key in defaults))
        defaults[key] = "default" in property ? property.default : null;
  };
  add(schema.schema.properties);
  for (const dependency of Object.values(schema.schema.dependencies ?? {}))
    for (const branch of dependency.oneOf ?? []) add(branch.properties ?? {});
  return defaults;
}

/** What a node's method menu offers: each method's settings and where it runs. */
export function offeredSettings(
  groups: { items: { baseMethod: string; runsIn?: string }[] }[],
  schemas: Dict<ModelSettingsDict>,
): NodeSettings {
  const offered: NodeSettings = {};
  for (const group of groups)
    for (const item of group.items)
      offered[item.baseMethod] = {
        runsIn: item.runsIn ?? "backend",
        settings: settingDefaults(schemas[item.baseMethod]),
      };
  return offered;
}

/** The methods of a node that run in the browser. */
export function browserMethods(node: NodeSettings): [string, MethodSettings][] {
  return Object.entries(node).filter(
    ([, spec]) => spec.runsIn === "browser" || spec.runsIn === "both",
  );
}

/** The settings a form sends for a method left at its defaults. */
export function formDefaults(
  node: NodeSettings,
  method: string,
): Dict<unknown> {
  return Object.fromEntries(
    Object.entries(node[method].settings).filter(([, v]) => v !== null),
  );
}

/** A method's settings with no effect test, and effect tests with no setting. */
export function contractGaps(
  spec: MethodSettings,
  effects: Dict<unknown> | undefined,
): { untested: string[]; stale: string[] } {
  const keys = Object.keys(spec.settings);
  return {
    untested: keys.filter(
      (key) => !(key in (effects ?? {})) && !(key in NO_EFFECT_EXPECTED),
    ),
    stale: Object.keys(effects ?? {}).filter((key) => !keys.includes(key)),
  };
}
