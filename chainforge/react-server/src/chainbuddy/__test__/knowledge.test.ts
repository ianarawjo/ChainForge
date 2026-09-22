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
    expect(header.type).toBe(type);
    expect(header.name).toBe(kind.name);
    expect(header.support).toBe("editable");
    const readOnly = (s: Record<string, any>, ro: (v: any) => boolean) =>
      Object.keys(s)
        .filter((k) => ro(s[k]))
        .sort();
    expect(Object.keys(settings).sort()).toEqual(
      Object.keys(kind.settings).sort(),
    );
    expect(readOnly(settings, (v) => v.read_only)).toEqual(
      readOnly(kind.settings, (v) => v.readOnly),
    );
  },
);

test.each(kinds)(
  "%s: the guide's Outputs section names the kind's output",
  (type, kind) => {
    const text = fs.readFileSync(path.join(DIR, "nodes", `${type}.md`), "utf8");
    const outputs = text.split("## Outputs")[1].split("\n## ")[0];
    expect(outputs).toContain(`\`${kind.output}\``);
  },
);
