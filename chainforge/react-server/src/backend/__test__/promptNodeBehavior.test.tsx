/*
 * @jest-environment jsdom
 */

// What a Prompt Node did before the fix for edits made just before Run
// (promptNodeRunEdits.test.tsx), and must still do: these pass on the code
// before that fix too. Saves to the flow wait for a pause in typing; the
// status and the template variables' handles follow then; inputs are pulled
// in the handles' order; prompt variants are added and removed as before.

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

// How many times the node has rendered (committed)
let renders = 0;

const promptNode = (data: Record<string, unknown>) => (
  <ColorSchemeProvider colorScheme="dark" toggleColorScheme={() => undefined}>
    <MantineProvider>
      <ReactFlowProvider>
        <React.Profiler id="prompt-node" onRender={() => renders++}>
          <PromptNode
            id="prompt-1"
            type="prompt"
            data={{
              title: "Prompt Node",
              vars: [],
              llms: [llm],
              prompt: "",
              n: 1,
              contChat: false,
              refresh: false,
              refreshLLMList: false,
              ...data,
            }}
          />
        </React.Profiler>
      </ReactFlowProvider>
    </MantineProvider>
  </ColorSchemeProvider>
);

/** Lets `ms` pass, on Jest's clock. */
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

/** Renders the node, and lets it settle (it saves its models after a pause). */
const renderPromptNode = async (data: Record<string, unknown>) => {
  const view = render(promptNode(data));
  await wait(400);
  mockSetDataPropsForNode.mockClear();
  return view;
};

const type = (container: HTMLElement, value: string) =>
  fireEvent.change(container.querySelector("textarea") as HTMLElement, {
    target: { value },
  });

const clickRun = () =>
  fireEvent.click(screen.getByRole("button", { name: "▶" }));

/** What was saved to the flow, by property. */
const saved = (prop: string) =>
  mockSetDataPropsForNode.mock.calls
    .map((call) => call[1] as Record<string, unknown>)
    .filter((props) => prop in props)
    .map((props) => props[prop]);

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

describe("a Prompt Node, as it always has", () => {
  test("doesn't re-render while being typed in, only after a pause", async () => {
    const { container } = await renderPromptNode({ prompt: "Old." });
    renders = 0;
    for (const text of ["N", "Ne", "New", "New.", "New. And", "New. And more."])
      type(container, text);
    await wait(200);
    expect(renders).toBe(0);
    await wait(200);
    expect(renders).toBeGreaterThan(0); // the save, after the pause
  });

  test("saves a typed prompt to the flow once, after a pause", async () => {
    const { container } = await renderPromptNode({ prompt: "Old." });
    type(container, "N");
    type(container, "Ne");
    type(container, "New.");
    await wait(200);
    expect(saved("prompt")).toEqual([]);
    await wait(200);
    expect(saved("prompt")).toEqual(["New."]);
  });

  test("marks its responses out of date after a pause, not at once", async () => {
    const { container } = await renderPromptNode({ prompt: "Old." });
    clickRun();
    await waitFor(() =>
      expect(container.querySelector(".ready-status")).not.toBeNull(),
    );

    type(container, "New.");
    await wait(100);
    expect(container.querySelector(".warning-status")).toBeNull();
    await wait(300);
    expect(container.querySelector(".warning-status")).not.toBeNull();
  });

  test("saves a change to its models to the flow after a pause", async () => {
    const { container } = await renderPromptNode({
      prompt: "Hi.",
      llms: [llm, llm2],
    });
    const items = container.querySelectorAll(".llm-list-item");
    fireEvent.click(items[1].querySelector("button") as HTMLButtonElement);
    await wait(200);
    expect(saved("llms")).toEqual([]);
    await wait(200);
    expect(
      (saved("llms") as { name: string }[][]).map((ms) =>
        ms.map((m) => m.name),
      ),
    ).toEqual([["gemma3:1b"]]);
  });

  test("pulls its inputs in its handles' order", async () => {
    mockEdges = [
      { target: "prompt-1", targetHandle: "a" },
      { target: "prompt-1", targetHandle: "b" },
    ];
    // Saved with its handles in another order than the prompt names them
    await renderPromptNode({ prompt: "{b} then {a}", vars: ["a", "b"] });
    clickRun();
    await waitFor(() => expect(mockQueryLLM).toHaveBeenCalled());
    expect(Object.keys(mockQueryLLM.mock.calls[0][4] as object)).toEqual([
      "a",
      "b",
    ]);
  });

  test("when removed, drops a prompt still to be saved, but saves its models", async () => {
    const { container, unmount } = await renderPromptNode({
      prompt: "Hi.",
      llms: [llm, llm2],
    });
    type(container, "Typed, then removed.");
    const items = container.querySelectorAll(".llm-list-item");
    fireEvent.click(items[1].querySelector("button") as HTMLButtonElement);
    unmount();
    await wait(400);
    expect(saved("prompt")).toEqual([]);
    expect(saved("llms")).toHaveLength(1);
  });

  test("adds a prompt variant, copying the one shown", async () => {
    const { container } = await renderPromptNode({ prompt: "First." });
    fireEvent.click(screen.getByText("+ add variant"));
    await wait(0);
    expect(saved("prompt")).toEqual([["First.", "First."]]);
    expect(saved("promptVariantLabel")).toEqual([["Variant 1", "Variant 2"]]);
    expect(container.querySelector("textarea")?.value).toBe("First.");
  });

  test("removes the variant shown, and keeps a lone label (older flows)", async () => {
    const { container } = await renderPromptNode({
      prompt: ["A", "B", "C"],
      promptVariantLabel: ["Variant 1"],
      idxPromptVariantShown: 1,
    });
    // The variant controls' trash icon comes before the models'
    const trash = container.querySelector(".tabler-icon-trash") as SVGElement;
    fireEvent.click(trash.closest("button") as HTMLButtonElement);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await wait(0);
    expect(saved("prompt")).toEqual([["A", "C"]]);
    expect(saved("promptVariantLabel")).toEqual([]);
    expect(container.querySelector("textarea")?.value).toBe("A");
  });
});
