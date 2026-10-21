/*
 * @jest-environment jsdom
 */

// A Prompt Node saves what's typed after a pause in typing (saving re-renders
// the flow). Running right after typing must still use what was typed, not
// the text as last saved.

// Plots (in the response inspector) aren't under test, and need a canvas.
jest.mock("react-plotly.js", () => ({ __esModule: true, default: () => null }));
jest.mock("plotly.js/dist/plotly", () => ({ __esModule: true, default: {} }));
// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({ execPy: () => undefined }));
jest.mock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
// The AI features aren't under test, and pull in the AI providers.
jest.mock("../../AiPopover", () => ({
  __esModule: true,
  AIGenPromptVariantsPopover: () => null,
}));
// What the node asks the backend: how many queries, then the queries
const mockQueryLLM = jest.fn();
// How many progress updates a run sends (every 50 ms) before finishing
let mockProgressUpdates = 0;
// (Plain functions: Jest resets jest.fn() implementations before each test.)
jest.mock("../backend", () => ({
  __esModule: true,
  clearCachedResponses: () => undefined,
  generatePrompts: async () => [],
  grabResponses: async () => [],
  countQueries: async () => ({
    counts: {},
    total_num_responses: { "llm-1": 1 },
  }),
  queryLLM: (...args: unknown[]) => {
    mockQueryLLM(...args);
    const onProgress = args[8] as any; // the progress listener
    return new Promise((resolve) => {
      let sent = 0;
      const tick = () => {
        if (sent++ >= mockProgressUpdates) return resolve({ responses: [] });
        onProgress?.({ "llm-1": { success: 0, error: 0 } });
        setTimeout(tick, 50);
      };
      tick();
    });
  },
}));
// The flow: just this node, with no inputs
const mockSetDataPropsForNode = jest.fn();
jest.mock("../../store", () => {
  const state: Record<string, unknown> = {
    edges: [],
    nodes: [],
    apiKeys: {},
    AvailableLLMs: [],
    favorites: {},
    globalSettings: { aiSupport: false },
    pullInputData: () => ({}),
    getImmediateInputNodeTypes: () => [],
    setDataPropsForNode: (...args: unknown[]) =>
      mockSetDataPropsForNode(...args),
    pingOutputNodes: () => undefined,
    bringNodeToFront: () => undefined,
    getColorForLLMAndSetIfNotFound: () => "#888",
    getColorForLLM: () => "#888",
  };
  // Anything else the node or its parts read: a no-op
  const store = new Proxy(state, {
    get: (target, key: string) =>
      key in target ? target[key] : () => undefined,
  });
  const useStore = (select: (s: typeof store) => unknown) => select(store);
  useStore.getState = () => store;
  return {
    __esModule: true,
    default: useStore,
    initLLMProviderMenu: [],
    initLLMProviders: [],
  };
});

// eslint-disable-next-line import/first
import React from "react";
// eslint-disable-next-line import/first
import { act, fireEvent, render, waitFor } from "@testing-library/react";
// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { ColorSchemeProvider, MantineProvider } from "@mantine/core";
// eslint-disable-next-line import/first
import { ReactFlowProvider } from "reactflow";
// eslint-disable-next-line import/first
import PromptNode from "../../PromptNode";

const llm = {
  key: "llm-1",
  name: "gemma3:1b",
  emoji: "🦙",
  model: "ollama",
  base_model: "ollama",
  temp: 1,
  settings: { ollamaModel: "gemma3:1b" },
};

const llm2 = {
  ...llm,
  key: "llm-2",
  name: "qwen3:4b",
  settings: { ollamaModel: "qwen3:4b" },
};

const renderPromptNode = (prompt: string, llms = [llm]) =>
  render(
    <ColorSchemeProvider colorScheme="dark" toggleColorScheme={() => undefined}>
      <MantineProvider>
        <ReactFlowProvider>
          <PromptNode
            id="prompt-1"
            type="prompt"
            data={{
              title: "Prompt Node",
              vars: [],
              llms,
              prompt,
              n: 1,
              contChat: false,
              refresh: false,
              refreshLLMList: false,
            }}
          />
        </ReactFlowProvider>
      </MantineProvider>
    </ColorSchemeProvider>,
  );

/** The models each query was sent to. */
const modelsSent = () =>
  mockQueryLLM.mock.calls.map((call) =>
    (call[1] as { name: string }[]).map((m) => m.name),
  );

/** The prompt each query was sent with. */
const promptsSent = () => mockQueryLLM.mock.calls.map((call) => call[3]);

const promptBox = (container: HTMLElement) =>
  container.querySelector("textarea") as HTMLTextAreaElement;

const runButton = (container: HTMLElement) =>
  container.querySelector(
    "button.AmitSahoo45-button-3:not(.nodrag[title])",
  ) as HTMLButtonElement;

// jsdom has no ResizeObserver, which the prompt box uses to fit its highlights
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  mockProgressUpdates = 0;
  mockQueryLLM.mockClear();
  mockSetDataPropsForNode.mockClear();
});

describe("running a Prompt Node right after editing it", () => {
  test("sends the prompt as typed, not as last saved", async () => {
    const { container } = renderPromptNode("An old prompt.");
    // Let the model list report its models (saved after a pause, too)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));

    // Typed, then Run straight away: before the pause that saves it
    fireEvent.change(promptBox(container), {
      target: { value: "Name three colors." },
    });
    fireEvent.click(runButton(container));

    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());
    expect(promptsSent()).toEqual(["Name three colors."]);
    // And the edit was saved to the node then, not dropped
    expect(mockSetDataPropsForNode).toHaveBeenCalledWith("prompt-1", {
      prompt: "Name three colors.",
    });
  });

  test("an edit made while it runs is saved, despite its progress updates", async () => {
    const { container } = renderPromptNode("An old prompt.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));

    // A run that keeps updating its progress bars for a second
    mockProgressUpdates = 20;
    fireEvent.click(runButton(container));
    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());

    fireEvent.change(promptBox(container), {
      target: { value: "Name three colors." },
    });
    // Saved after the pause, though the progress bars updated in between
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(mockSetDataPropsForNode).toHaveBeenCalledWith("prompt-1", {
      prompt: "Name three colors.",
    });
  });

  test("uses the models as chosen, though the change isn't saved yet", async () => {
    const { container } = renderPromptNode("Name three colors.", [llm, llm2]);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));

    // Removed a model, then Run straight away
    const items = container.querySelectorAll(".llm-list-item");
    fireEvent.click(items[1].querySelector("button") as HTMLButtonElement);
    fireEvent.click(runButton(container));

    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());
    expect(modelsSent()).toEqual([["gemma3:1b"]]);
  });
});
