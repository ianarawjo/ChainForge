// Keeps the knowledge files (for people and the model) and the code that
// enforces them in agreement. See "Keeping this folder accurate" in
// knowledge/README.md.

import { expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
// A dependency of ESLint and Jest; only tests use it.
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from "js-yaml";
import { NODE_SPECS } from "../flowApi/nodeSpecs";

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
  expect(files).toEqual(Object.keys(NODE_SPECS).sort());
});

test.each(Object.keys(NODE_SPECS))(
  "%s: the knowledge file's settings match what the code allows",
  (type) => {
    const { header, settings } = nodeFile(type);
    expect(header.type).toBe(type);
    expect(header.support).toBe("editable");
    const readOnly = Object.keys(settings).filter((k) => settings[k].read_only);
    const editable = Object.keys(settings).filter(
      (k) => !settings[k].read_only,
    );
    expect(editable.sort()).toEqual([...NODE_SPECS[type].editable].sort());
    expect(readOnly.sort()).toEqual([...NODE_SPECS[type].readOnly].sort());
  },
);

test("each node file's Outputs section names the output the code uses", () => {
  for (const [type, spec] of Object.entries(NODE_SPECS)) {
    const text = fs.readFileSync(path.join(DIR, "nodes", `${type}.md`), "utf8");
    const outputs = text.split("## Outputs")[1].split("\n## ")[0];
    expect(outputs).toContain(`\`${spec.output}\``);
  }
});
