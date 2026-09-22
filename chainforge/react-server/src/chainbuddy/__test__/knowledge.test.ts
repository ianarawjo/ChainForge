// Keeps the knowledge files (for people and the model) and the code that
// enforces them in agreement. See "Keeping this folder accurate" in
// knowledge/README.md.

import { expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
// A dependency of ESLint and Jest; only tests use it.
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from "js-yaml";
import { NODE_KINDS } from "../nodes";
import { SettingSpec } from "../nodes/types";

const DIR = path.join(__dirname, "..", "knowledge");

function nodeFile(type: string) {
  const text = fs.readFileSync(path.join(DIR, "nodes", `${type}.md`), "utf8");
  const header = yaml.load(text.split("---")[1]) as Record<string, any>;
  const settingsBlock = text
    .split("## Settings")[1]
    .match(/```yaml\n([\s\S]*?)```/);
  const settings = yaml.load(settingsBlock?.[1] ?? "") as Record<string, any>;
  return { header, settings };
}

test("every editable node type has a knowledge file, and every file a node type", () => {
  const files = fs
    .readdirSync(path.join(DIR, "nodes"))
    .map((f) => path.basename(f, ".md"))
    .sort();
  expect(files).toEqual(NODE_KINDS.map((k) => k.type).sort());
});

const kinds = NODE_KINDS.map((k) => [k.type, k] as const);

test.each(kinds)(
  "%s: the guide's header and settings match its NodeKind",
  (type, kind) => {
    const { header, settings } = nodeFile(type);
    expect(header).toEqual({ type, name: kind.name });
    // Which settings have a property, in the guide and in the kind.
    const which = (s: Record<string, any>, has: (v: any) => boolean) =>
      Object.keys(s)
        .filter((k) => has(s[k]))
        .sort();
    const both = (
      inGuide: (v: any) => boolean,
      inKind: (v: SettingSpec) => boolean,
    ) => expect(which(settings, inGuide)).toEqual(which(kind.settings, inKind));
    both(
      () => true,
      () => true,
    );
    both(
      (v) => v.read_only,
      (v) => !!v.readOnly,
    );
    both(
      (v) => v.required,
      (v) => !!v.required,
    );
    both(
      (v) => v.type === "list",
      (v) => !!v.items,
    );
    both(
      (v) => v.type === "code",
      (v) => !!v.code,
    );
  },
);

/** A section of a guide, up to the next heading of the same level. */
function section(type: string, heading: string) {
  const text = fs.readFileSync(path.join(DIR, "nodes", `${type}.md`), "utf8");
  return text.split(`## ${heading}`)[1].split("\n## ")[0];
}

test.each(kinds)(
  "%s: the guide's Inputs and Outputs say what the kind accepts and gives",
  (type, kind) => {
    expect(section(type, "Outputs")).toContain(`\`${kind.output}\``);
    for (const accepted of kind.accepts)
      expect(section(type, "Inputs")).toContain(`\`${accepted}\``);
  },
);
