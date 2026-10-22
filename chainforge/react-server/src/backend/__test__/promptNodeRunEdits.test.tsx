/*
 * @jest-environment jsdom
 */

// A Prompt Node saves what's typed to the flow after a pause in typing
// (saving re-renders the flow). Running right after an edit must still use
// it: the prompt, its template variables and the models as they are now.

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
// The flow: this node, and the edges into it the test sets
const mockSetDataPropsForNode = jest.fn();
let mockEdges: { target: string; targetHandle: string }[] = [];
jest.mock("../../store", () => {
  const state: Record<string, unknown> = {
    get edges() {
      return mockEdges;
    },
    nodes: [],
    apiKeys: {},
    AvailableLLMs: [],
    favorites: {},
    globalSettings: { aiSupport: false },
    // A value for each variable asked for
    pullInputData: (vars: string[]) =>
      Object.fromEntries(vars.map((v) => [v, [`${v} value`]])),
    getImmediateInputNodeTypes: () => [],
    setDataPropsForNode: (...args: unknown[]) =>
      mockSetDataPropsForNode(...args),
    pingOutputNodes: () => undefined,
    bringNodeToFront: () => undefined,
    getColorForLLMAndSetIfNotFound: () => "#888",
    getColorForLLM: () => "#888",
  };
  // Anything else the node or its parts read: a no-op (the same one each
  // time, as the store's functions are, so they don't re-make the node's
  // callbacks on every render)
  const noops: Record<string, () => undefined> = {};
  const store = new Proxy(state, {
    get: (target, key: string) =>
      key in target ? target[key] : (noops[key] ??= () => undefined),
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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
// eslint-disable-next-line import/first
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
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

const nodeData = (prompt: string, llms = [llm]) => ({
  title: "Prompt Node",
  vars: [],
  llms,
  prompt,
  n: 1,
  contChat: false,
  refresh: false,
  refreshLLMList: false,
});

const promptNode = (data: ReturnType<typeof nodeData>) => (
  <ColorSchemeProvider colorScheme="dark" toggleColorScheme={() => undefined}>
    <MantineProvider>
      <ReactFlowProvider>
        <PromptNode id="prompt-1" type="prompt" data={data} />
      </ReactFlowProvider>
    </MantineProvider>
  </ColorSchemeProvider>
);

/** Renders the node, and lets it settle (it saves its models after a pause). */
const renderPromptNode = async (prompt: string, llms = [llm]) => {
  const data = nodeData(prompt, llms);
  const view = render(promptNode(data));
  await wait(400);
  return { ...view, data };
};

/** Lets `ms` pass, on Jest's clock. */
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

const type = (container: HTMLElement, value: string) =>
  fireEvent.change(container.querySelector("textarea") as HTMLElement, {
    target: { value },
  });

const clickRun = () =>
  fireEvent.click(screen.getByRole("button", { name: "▶" }));

/** What each query was sent: its prompt, its models and its inputs. */
const promptsSent = () => mockQueryLLM.mock.calls.map((call) => call[3]);
const modelsSent = () =>
  mockQueryLLM.mock.calls.map((call) =>
    (call[1] as { name: string }[]).map((m) => m.name),
  );
const inputsSent = () =>
  mockQueryLLM.mock.calls.map((call) => Object.keys(call[4] as object).sort());

// jsdom has no ResizeObserver, which the prompt box uses to fit its highlights
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  jest.useFakeTimers();
  mockProgressUpdates = 0;
  mockEdges = [];
  mockQueryLLM.mockClear();
  mockSetDataPropsForNode.mockClear();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("running a Prompt Node right after editing it", () => {
  test("sends the prompt as typed, and saves it to the flow", async () => {
    const { container } = await renderPromptNode("An old prompt.");

    // Typed, then Run straight away: before the pause that saves it
    type(container, "Name three colors.");
    clickRun();

    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());
    expect(promptsSent()).toEqual(["Name three colors."]);
    expect(mockSetDataPropsForNode).toHaveBeenCalledWith("prompt-1", {
      prompt: "Name three colors.",
    });
  });

  test("fills in a template variable just added", async () => {
    mockEdges = [
      { target: "prompt-1", targetHandle: "a" },
      { target: "prompt-1", targetHandle: "b" },
    ];
    const { container } = await renderPromptNode("Tell me about {a}.");

    type(container, "Compare {a} and {b}.");
    clickRun();

    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());
    expect(inputsSent()).toEqual([["a", "b"]]);
  });

  test("counts an input connected just before", async () => {
    const view = await renderPromptNode("Tell me about {a}.");

    // Connected, then Run (nothing else about the node changed)
    mockEdges = [{ target: "prompt-1", targetHandle: "a" }];
    view.rerender(promptNode(view.data));
    clickRun();

    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());
    expect(inputsSent()).toEqual([["a"]]);
  });

  test("uses the models as chosen, though the change isn't saved yet", async () => {
    const { container } = await renderPromptNode("Name three colors.", [
      llm,
      llm2,
    ]);

    // Removed a model, then Run straight away
    const items = container.querySelectorAll(".llm-list-item");
    fireEvent.click(items[1].querySelector("button") as HTMLButtonElement);
    clickRun();

    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());
    expect(modelsSent()).toEqual([["gemma3:1b"]]);
  });

  test("an edit made while it runs is saved, despite its progress updates", async () => {
    const { container } = await renderPromptNode("An old prompt.");

    // A run that keeps updating its progress bars for a second
    mockProgressUpdates = 20;
    clickRun();
    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());

    type(container, "Name three colors.");
    // Saved after the pause, though the progress bars updated in between
    await wait(400);
    expect(mockSetDataPropsForNode).toHaveBeenCalledWith("prompt-1", {
      prompt: "Name three colors.",
    });
  });
});
