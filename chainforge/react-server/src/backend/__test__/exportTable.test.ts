/*
 * @jest-environment jsdom
 */

// The table the Inspector exports to Excel: one row per response, with its
// stats. Only the energy columns are checked here.
jest.mock("react-plotly.js", () => ({ __esModule: true, default: () => null }));
jest.mock("plotly.js/dist/plotly", () => ({ __esModule: true, default: {} }));
// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => {
  const state = { nodes: [], getColorForLLMAndSetIfNotFound: () => "#888" };
  const useStore = (select: (s: typeof state) => unknown) => select(state);
  useStore.getState = () => state;
  return { __esModule: true, default: useStore };
});

// eslint-disable-next-line import/first
import { describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { responsesToTable } from "../../LLMResponseInspector";
// eslint-disable-next-line import/first
import { LLMResponse, ResponseStats } from "../typing";

const resp = (llm: string, stats: ResponseStats): LLMResponse => ({
  uid: llm,
  prompt: "Q",
  vars: {},
  metavars: {},
  llm,
  responses: ["A"],
  stats: [stats],
});

describe("exporting measured energy", () => {
  test("says where it was measured, and how far off it could be", async () => {
    const rows = await responsesToTable([
      resp("Ollama model", { energy_wh: 0.08, energy_noise_wh: 0.002 }),
      resp("LabServer", {
        energy_wh: 0.5,
        energy_reported_by: "LabServer",
        energy_other_gpu_use: ["ComfyUI"],
      }),
      resp("GPT", { est_energy_wh: { min: 0.1, max: 0.3 } }),
    ]);
    expect(rows[0]).toMatchObject({
      "Energy, measured (Wh)": 0.08,
      "Energy measured by": "this machine",
      "Energy noise (Wh)": 0.002,
    });
    expect(rows[1]).toMatchObject({
      "Energy, measured (Wh)": 0.5,
      "Energy measured by": "LabServer",
      "Other programs using the GPU": "ComfyUI",
    });
    expect(rows[1]).not.toHaveProperty("Energy noise (Wh)");
    // Only an estimate: nothing measured, by anyone
    expect(rows[2]).not.toHaveProperty("Energy measured by");
  });
});
