/**
 * The node types ChainBuddy supports. To add one: write its guide in
 * knowledge/nodes/, write its NodeKind next to these, and list it here.
 */

import type { Support } from "../flowApi/types";
import { Dict } from "../../backend/typing";
import { evaluatorKind } from "./evaluator";
import { promptKind } from "./prompt";
import { textfieldsKind } from "./textfields";
import { NodeKind } from "./types";

export const NODE_KINDS: NodeKind[] = [
  promptKind,
  textfieldsKind,
  evaluatorKind,
];

// Read when used, not captured at load, so a kind added to NODE_KINDS (as the
// tests do) reaches everything.

/** The kind for a node type, if ChainBuddy supports it. */
export function kindOf(type: string | undefined): NodeKind | undefined {
  return NODE_KINDS.find((k) => k.type === type);
}

/** Whether ChainBuddy can edit this node: it has a kind that supports its data. */
export function supportOf(type: string | undefined, data: Dict): Support {
  const kind = kindOf(type);
  return kind && (!kind.supports || kind.supports(data))
    ? "editable"
    : "not-supported";
}

/** The inputs a node of this type has with these settings. */
export function inputsOf(
  type: string,
  settings: Record<string, unknown>,
): string[] {
  return kindOf(type)?.inputs(settings) ?? [];
}

/** Node types ChainBuddy can add and edit. */
export function editableTypes(): string[] {
  return NODE_KINDS.map((k) => k.type);
}

/**
 * The model's instructions, ending with the node types it may use and what
 * each gives and accepts, which is what decides what connects to what.
 */
export function systemPrompt(instructions: string): string {
  const lines = NODE_KINDS.map(
    (k) =>
      `- ${k.name} (\`${k.type}\`): gives ${k.output}; ` +
      (k.accepts.length
        ? `its inputs take ${k.accepts.join(" or ")}.`
        : "no inputs."),
  );
  return `${instructions.trim()}\n\nThe node types available to you. An output can connect to any input that takes what it gives:\n\n${lines.join("\n")}\n`;
}
