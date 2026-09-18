/**
 * PROTOTYPE ONLY. A pretend canvas, for running ChainBuddy's real tools
 * against real models without the app (see __test__/liveAgent.test.ts).
 */

import { NODE_SPECS, simpleInputsFor } from "../flowApi/nodeSpecs";
import { createFlowTools } from "../flowApi/tools";
import {
  CanvasPort,
  ChangeSet,
  FlowView,
  ModelInfo,
  NodeView,
} from "../flowApi/types";

/** A small flow to edit: three texts feeding a one-model summary prompt. */
export const EXAMPLE_FLOW: FlowView = {
  nodes: [
    stubNode("textfields-1", "textfields", "Texts", {
      values: [
        "The mitochondria is the powerhouse of the cell, producing most of its chemical energy.",
        "Photosynthesis turns light, water and carbon dioxide into sugar and oxygen.",
        "Plate tectonics describes how Earth's outer shell moves in large pieces.",
      ],
      disabled_values: [],
    }),
    stubNode("prompt-1", "prompt", "Summaries", {
      prompts: [
        { label: "Plain", text: "Summarize this in one sentence: {text}" },
      ],
      models: [
        {
          model: "openrouter/anthropic/claude-haiku-4.5",
          nickname: "Claude Haiku 4.5",
        },
      ],
      responses_per_prompt: 1,
    }),
  ],
  connections: [
    {
      from: { node: "textfields-1", output: "values" },
      to: { node: "prompt-1", input: "text" },
    },
  ],
};

export function stubNode(
  id: string,
  type: string,
  title: string,
  settings: Record<string, unknown>,
): NodeView {
  return {
    id,
    type,
    title,
    support: "editable",
    settings,
    inputs: simpleInputsFor(type, settings),
    outputs: [NODE_SPECS[type].output],
  };
}

export function createStubCanvas(options: {
  flow?: FlowView;
  models: ModelInfo[];
}) {
  const flow = options.flow ?? { nodes: [], connections: [] };
  const proposals: ChangeSet[] = [];
  const canvas: CanvasPort = {
    readFlow: () => flow,
    listModels: () => options.models,
    inputsFor: simpleInputsFor,
    propose: (changeSet) => {
      proposals.push(changeSet);
      return {
        id: `change-set-${proposals.length}`,
        replaced:
          proposals.length > 1
            ? `change-set-${proposals.length - 1}`
            : undefined,
      };
    },
  };
  return { canvas, proposals };
}

export function createStubTools(options: {
  flow?: FlowView;
  models: ModelInfo[];
  nodeDocs?: Record<string, string>;
}) {
  const { canvas, proposals } = createStubCanvas(options);
  return {
    tools: createFlowTools({ canvas, nodeDocs: options.nodeDocs ?? {} }),
    proposals,
  };
}
