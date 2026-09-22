// Adding a node type should take only a NodeKind listed in NODE_KINDS. This
// registers one for ChainForge's Items Node and checks every part of
// ChainBuddy picks it up.

import { afterAll, beforeAll, expect, test } from "@jest/globals";
import { describeChanges } from "../flowApi/describe";
import {
  editableTypes,
  kindOf,
  NODE_KINDS,
  supportOf,
  systemPrompt,
} from "../nodes";
import { listOf, titleSetting } from "../nodes/common";
import { NodeKind } from "../nodes/types";
import { createStubTools } from "../prototype/stubTools";

const itemsKind: NodeKind = {
  type: "csv",
  name: "Items Node",
  doc: "# Items Node\n\nA comma-separated list of values.",
  output: "values",
  accepts: [],
  handles: { output: "output" },
  settings: {
    title: titleSetting,
    values: {
      label: "Values",
      required: true,
      items: { key: String, label: String },
    },
  },
  inputs: () => [],
  missing: (s) => (listOf(s.values).length ? undefined : "has no values yet"),
  read: (data) => ({
    title: data.title ?? "Items Node",
    values: data.fields ?? [],
  }),
  write: (settings, base) => ({
    ...(base ?? {}),
    ...(Array.isArray(settings.values)
      ? { text: settings.values.join(", "), fields: settings.values }
      : {}),
  }),
};

beforeAll(() => {
  NODE_KINDS.push(itemsKind);
});
afterAll(() => {
  NODE_KINDS.splice(NODE_KINDS.indexOf(itemsKind), 1);
});

const models = [
  {
    id: "openrouter/anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "OpenRouter",
    ready: true,
  },
];

test("a new kind can be proposed, checked, and connected to existing kinds", () => {
  const { tools, proposals } = createStubTools({ models });
  const run = (name: string, args: object) =>
    tools
      .find((t) => t.name === name)
      ?.run(args as Record<string, unknown>, {}) as any;

  run("get_flow", {});
  expect(run("describe_node", { type: "csv" })).toMatch(/^# Items Node/);
  const out = run("propose_changes", {
    summary: "Ask about some fruits",
    changes: [
      {
        op: "add_node",
        ref: "fruits",
        type: "csv",
        settings: { title: "Fruits", values: ["apple", "pear"] },
      },
      {
        op: "add_node",
        ref: "ask",
        type: "prompt",
        settings: {
          prompts: [{ label: "A", text: "Describe {fruit}" }],
          models: [{ model: models[0].id }],
        },
      },
      {
        op: "connect",
        from: { node: "fruits", output: "values" },
        to: { node: "ask", input: "fruit" },
      },
    ],
  });
  expect(out.status).toBe("awaiting_approval");

  const lines = describeChanges({ nodes: [], connections: [] }, proposals[0]);
  expect(lines[0]).toEqual({
    kind: "add",
    text: 'Add Items Node "Fruits"',
    details: [{ setting: "Values", value: "apple, pear", code: undefined }],
  });
});

test("a new kind's settings are checked like any other", () => {
  const { tools } = createStubTools({ models });
  const run = (name: string, args: object) =>
    tools
      .find((t) => t.name === name)
      ?.run(args as Record<string, unknown>, {}) as any;
  run("get_flow", {});
  const out = run("propose_changes", {
    summary: "x",
    changes: [
      { op: "add_node", ref: "f", type: "csv", settings: { colour: "red" } },
    ],
  });
  expect(out.problems).toEqual([
    'changes[0] (add_node): a csv node has no setting "colour". Its settings are: title, values.',
    "changes[0] (add_node): a new csv node needs values.",
  ]);
});

test("a new kind is found by its type, and the model is told about it", () => {
  expect(editableTypes()).toContain("csv");
  expect(supportOf("csv", {})).toBe("editable");
  const resolver = { idOf: () => "", toSpec: () => undefined };
  const kind = kindOf("csv") as NodeKind;
  const data = kind.write({ values: ["apple", "pear"] }, undefined, resolver);
  expect(data).toEqual({ text: "apple, pear", fields: ["apple", "pear"] });
  expect(kind.read(data, resolver)).toEqual({
    title: "Items Node",
    values: ["apple", "pear"],
  });
  expect(systemPrompt("Be helpful.")).toMatch(
    /- Items Node \(`csv`\): gives values; no inputs\./,
  );
});
