/*
 * @jest-environment jsdom
 */

// The Vis Node plotting response stats (latency, estimated energy, ...) in
// place of evaluation scores. Plotly is replaced by a stub that records the
// traces and layout it's given.
const plots: { data: any[]; layout: any }[] = [];
jest.mock("react-plotly.js", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef(
      (props: { data: any[]; layout: any }, _ref: any) => {
        plots.push({ data: props.data, layout: props.layout });
        return React.createElement("div", { "data-testid": "plot" });
      },
    ),
  };
});
jest.mock("plotly.js/dist/plotly", () => ({ __esModule: true, default: {} }));
// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
// The flow's nodes: a Prompt Node with the models, which responses name only
// by nickname
const mockNodes: any[] = [];
jest.mock("../../store", () => {
  const state = {
    setDataPropsForNode: jest.fn(),
    getColorForLLMAndSetIfNotFound: () => "#888",
    get nodes() {
      return mockNodes;
    },
  };
  const useStore = (select: (s: typeof state) => unknown) => select(state);
  useStore.getState = () => state;
  return { __esModule: true, default: useStore };
});
// Responses are passed in directly; nothing is fetched.
jest.mock("../backend", () => ({ __esModule: true, grabResponses: jest.fn() }));
// The AI plot isn't under test, and pulls in the AI providers.
jest.mock("../../VisNodeAIPlot", () => ({
  __esModule: true,
  AIGenPlotPopover: () => null,
  AIPlotHeaderButtons: () => null,
  AIPlotView: () => null,
}));

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
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { ColorSchemeProvider, MantineProvider } from "@mantine/core";
// eslint-disable-next-line import/first
import { VisView } from "../../VisNode";
// eslint-disable-next-line import/first
import { LLMResponse, ResponseStats } from "../typing";

const spec = (name: string, model: string) => ({
  name,
  emoji: "",
  base_model: "",
  model,
  temp: 1,
});

const respObj = (
  name: string,
  model: string,
  stats: (ResponseStats | null)[],
): LLMResponse => ({
  uid: name,
  prompt: "Q",
  vars: { topic: "sky" },
  metavars: {},
  // As stored after a query: the model's nickname, not its spec
  llm: name,
  responses: stats.map((_, i) => `${name} reply ${i}`),
  stats,
});

const energy = (min: number, max: number): ResponseStats => ({
  latency_ms: 1000,
  output_tokens: 100,
  est_energy_wh: { min, max },
});

// Haiku: covered by EcoLogits, but one response predates estimates.
// DeepSeek: not covered by EcoLogits at all.
const responses = [
  respObj("Haiku", "openrouter/anthropic/claude-haiku-4.5", [
    energy(0.01, 0.03),
    energy(0.02, 0.04),
    { latency_ms: 900, output_tokens: 90 },
  ]),
  respObj("Gemini", "openrouter/google/gemini-3.1-flash-lite", [
    energy(0.002, 0.012),
    energy(0.004, 0.014),
  ]),
  respObj("DeepSeek", "openrouter/deepseek/deepseek-v4-flash", [
    { latency_ms: 4000, output_tokens: 130 },
  ]),
];

mockNodes.push({
  id: "prompt",
  data: {
    llms: [
      spec("Haiku", "openrouter/anthropic/claude-haiku-4.5"),
      spec("Gemini", "openrouter/google/gemini-3.1-flash-lite"),
      spec("DeepSeek", "openrouter/deepseek/deepseek-v4-flash"),
      spec("GPT", "openrouter/openai/gpt-4o-mini"),
    ],
  },
});

const lastPlot = () => plots[plots.length - 1];

const renderVis = async (
  resps: LLMResponse[] = responses,
  headerSlot?: HTMLElement,
  node?: { id: string; data: any },
) => {
  const ref = React.createRef<any>();
  plots.length = 0;
  render(
    <ColorSchemeProvider colorScheme="dark" toggleColorScheme={() => undefined}>
      <MantineProvider>
        <VisView
          ref={ref}
          responses={resps}
          headerSlot={headerSlot}
          id={node?.id}
          data={node?.data}
        />
      </MantineProvider>
    </ColorSchemeProvider>,
  );
  await act(async () => {
    ref.current.resetControls(resps);
  });
  return ref;
};

const yAxisSelect = () =>
  screen
    .getAllByRole("combobox")
    .find((el) =>
      Array.from((el as HTMLSelectElement).options).some(
        (o) => o.value === "topic",
      ),
    ) as HTMLSelectElement;

const xAxisSelect = () =>
  screen
    .getAllByRole("combobox")
    .find((el) =>
      Array.from((el as HTMLSelectElement).options).some(
        (o) => o.value === "__stat_latency_s",
      ),
    ) as HTMLSelectElement;

beforeEach(() => {
  plots.length = 0;
});

describe("Vis Node plotting response stats", () => {
  test("offers the responses' stats as x-axis values, without an evaluator", async () => {
    await renderVis();
    const select = xAxisSelect();
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toEqual([
      "Latency (s)",
      "Output tokens",
      "Energy, estimated (mWh)",
    ]);
    // No evaluator results, so it starts on a stat, and plots it
    expect(select.value).toBe("__stat_latency_s");
    await waitFor(() => expect(lastPlot()?.data.length).toBeGreaterThan(0));
    expect(lastPlot().layout.xaxis.title.text).toBe(
      "Mean latency (s) per response",
    );
    // The left margin grows to fit the y-axis labels as Plotly draws them
    expect(lastPlot().layout.yaxis.automargin).toBe(true);
  });

  test("plots energy as each model's mean per response, leaving out responses without one", async () => {
    await renderVis();
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    await waitFor(() =>
      expect(lastPlot()?.layout.xaxis?.title?.text).toBe(
        "Mean energy, estimated (mWh) per response",
      ),
    );
    const bars = lastPlot().data;
    // Averaged, not summed, and DeepSeek (no estimates) isn't plotted
    expect(bars.map((d) => d.histfunc)).toEqual(["avg", "avg"]);
    expect(bars.map((d) => d.name).sort()).toEqual(["Gemini", "Haiku"]);
    const haiku = bars.find((d) => d.name === "Haiku");
    expect(haiku.x).toEqual([20, 30]);
    // Hovering a point shows its range
    expect(haiku.text[0]).toContain(
      "Energy: 10–30 mWh (estimated by EcoLogits)",
    );
  });

  test("says which models EcoLogits doesn't cover, and not ones it does", async () => {
    await renderVis();
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    const note = await screen.findByText("Some estimates could not be shown.");
    // Below the plot's div, not in it: the plot resizes to fill that div, so
    // anything else in it makes the plot grow without end
    expect(screen.getByTestId("plot").parentElement?.contains(note)).toBe(
      false,
    );
    // The details are the note's description, for screen readers...
    const trigger = note.closest("[aria-describedby]") as HTMLElement;
    const details = document.getElementById(
      trigger.getAttribute("aria-describedby") as string,
    )?.textContent;
    expect(details).toContain(
      "EcoLogits has no estimates for models DeepSeek,",
    );
    expect(details).toContain("Some responses from Haiku have no estimate");
    expect(details).not.toMatch(/models[^.]*Haiku/);
    // ...and a tooltip, which keyboard users open by focusing the note
    expect(trigger.tabIndex).toBe(0);
    fireEvent.focus(trigger);
    expect((await screen.findByRole("tooltip")).textContent).toBe(details);
  });

  test("finds models inside a group of models", async () => {
    mockNodes.push({
      id: "grouped",
      data: {
        llms: [
          {
            group: "Others",
            items: [spec("Grok", "openrouter/x-ai/grok-4.6")],
          },
        ],
      },
    });
    try {
      await renderVis([
        ...responses,
        respObj("Grok", "openrouter/x-ai/grok-4.6", [
          { latency_ms: 500, output_tokens: 40 },
        ]),
      ]);
      fireEvent.change(xAxisSelect(), {
        target: { value: "__stat_est_energy_mwh" },
      });
      const note = await screen.findByText(
        "Some estimates could not be shown.",
      );
      const trigger = note.closest("[aria-describedby]") as HTMLElement;
      expect(
        document.getElementById(
          trigger.getAttribute("aria-describedby") as string,
        )?.textContent,
      ).toContain("for models DeepSeek, Grok,");
    } finally {
      mockNodes.pop();
    }
  });

  test("hovering a box shows one summary on its median, not each of its stats", async () => {
    await renderVis();
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    fireEvent.click(screen.getByText("Bar Chart"));
    fireEvent.click(await screen.findByText("Box & Whiskers"));
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "box")).toBe(true),
    );
    const { data } = lastPlot();
    const boxes = data.filter((d) => d.type === "box");
    expect(boxes.every((d) => d.hoveron === "points")).toBe(true);
    const summaries = data.filter((d) => d.type === "scatter");
    expect(summaries).toHaveLength(2);
    const haiku = summaries.find((d) => d.y[0] === "Haiku");
    expect(haiku.x).toEqual([25]);
    expect(haiku.text[0]).toBe(
      "<b>Haiku</b><br>median 25 · range 20–30 · n = 2",
    );
  });

  test("keeps the y-axis choice when only the x-axis options change", async () => {
    const ref = await renderVis();
    fireEvent.change(yAxisSelect(), { target: { value: "topic" } });
    expect(yAxisSelect().value).toBe("topic");
    // A rerun adds a model that reports cost: a new x-axis option
    const withCost = [
      ...responses,
      respObj("GPT", "openrouter/openai/gpt-4o-mini", [
        { latency_ms: 800, output_tokens: 50, cost_usd: 0.0001 },
      ]),
    ];
    await act(async () => {
      ref.current.resetControls(withCost);
    });
    expect(Array.from(xAxisSelect().options).map((o) => o.value)).toContain(
      "__stat_cost_usd",
    );
    expect(yAxisSelect().value).toBe("topic");
  });

  test("grouped boxes get a summary on each median too", async () => {
    await renderVis();
    fireEvent.change(yAxisSelect(), { target: { value: "topic" } });
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    fireEvent.click(screen.getByText("Bar Chart"));
    fireEvent.click(await screen.findByText("Box & Whiskers"));
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "box")).toBe(true),
    );
    const { data, layout } = lastPlot();
    const boxes = data.filter((d) => d.type === "box");
    const summaries = data.filter((d) => d.type === "scatter");
    expect(boxes.every((d) => d.hoveron === "points")).toBe(true);
    // One summary per model, grouped like its boxes so it sits on them
    expect(summaries.map((d) => d.offsetgroup).sort()).toEqual(
      boxes.map((d) => d.offsetgroup).sort(),
    );
    expect(layout.scattermode).toBe("group");
    const haiku = summaries.find((d) => d.offsetgroup === "Haiku");
    expect(haiku.text[0]).toBe(
      "<b>Haiku · sky</b><br>median 25 · range 20–30 · n = 2",
    );
  });

  test("violins keep their points, stop at the data, and hover like boxes", async () => {
    await renderVis();
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    fireEvent.click(screen.getByText("Bar Chart"));
    fireEvent.click(await screen.findByText("Violin"));
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "violin")).toBe(true),
    );
    const { data } = lastPlot();
    const violins = data.filter((d) => d.type === "violin");
    expect(violins).toHaveLength(2);
    violins.forEach((d) => {
      expect(d.points).toBe("all");
      expect(d.spanmode).toBe("hard");
      expect(d.hoveron).toBe("points");
      expect(d.boxpoints).toBeUndefined();
    });
    const haiku = data.find(
      (d) => d.type === "scatter" && d.y?.[0] === "Haiku",
    );
    expect(haiku.text[0]).toBe(
      "<b>Haiku</b><br>median 25 · range 20–30 · n = 2",
    );
  });

  test("grouped violins sit side by side, with a summary on each", async () => {
    await renderVis();
    fireEvent.change(yAxisSelect(), { target: { value: "topic" } });
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    fireEvent.click(screen.getByText("Bar Chart"));
    fireEvent.click(await screen.findByText("Violin"));
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "violin")).toBe(true),
    );
    const { data, layout } = lastPlot();
    const violins = data.filter((d) => d.type === "violin");
    const summaries = data.filter((d) => d.type === "scatter");
    expect(layout.violinmode).toBe("group");
    expect(layout.scattermode).toBe("group");
    expect(summaries.map((d) => d.offsetgroup).sort()).toEqual(
      violins.map((d) => d.offsetgroup).sort(),
    );
    const haiku = summaries.find((d) => d.offsetgroup === "Haiku");
    expect(haiku.text[0]).toBe(
      "<b>Haiku · sky</b><br>median 25 · range 20–30 · n = 2",
    );
  });

  test("a density gradient shades a strip per model, with a tick per value", async () => {
    await renderVis();
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    fireEvent.click(screen.getByText("Bar Chart"));
    fireEvent.click(await screen.findByText("Density Gradient"));
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "heatmap")).toBe(true),
    );
    const { data, layout } = lastPlot();
    // One shaded strip per model with estimates, darkest at its densest
    const strips = data.filter((d) => d.type === "heatmap");
    expect(strips).toHaveLength(2);
    strips.forEach((d) => expect(Math.max(...d.z[0])).toBe(1));
    // Rows on a numeric axis, labelled with the models, without tick marks
    expect(layout.yaxis.type).toBe("linear");
    expect(layout.yaxis.ticktext).toEqual(["Haiku", "Gemini"]);
    expect(layout.yaxis.ticks).toBe("");
    expect(layout.xaxis.ticks).toBe("");
    // A tick per value, and the same summary on the median as a box plot
    const haikuTicks = data.find(
      (d) => d.type === "scatter" && d.text?.length === 2 && d.x.includes(20),
    );
    expect(haikuTicks.x).toEqual([20, 30]);
    const summary = data.find((d) =>
      String(d.text?.[0]).startsWith("<b>Haiku</b>"),
    );
    expect(summary.text[0]).toBe(
      "<b>Haiku</b><br>median 25 · range 20–30 · n = 2",
    );
  });

  test("a density gradient still shades values bunched tightly against the plot's range", async () => {
    // Gemini's two values are 0.01 apart, on a plot 1000 wide: narrower than
    // a cell of the shading, which used to leave its strip blank
    await renderVis([
      respObj("Haiku", "openrouter/anthropic/claude-haiku-4.5", [
        energy(0, 0),
        energy(1, 1),
      ]),
      respObj("Gemini", "openrouter/google/gemini-3.1-flash-lite", [
        energy(0.5, 0.5),
        energy(0.50001, 0.50001),
      ]),
    ]);
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    fireEvent.click(screen.getByText("Bar Chart"));
    fireEvent.click(await screen.findByText("Density Gradient"));
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "heatmap")).toBe(true),
    );
    const strips = lastPlot().data.filter((d) => d.type === "heatmap");
    expect(strips).toHaveLength(2);
    strips.forEach((d) => expect(Math.max(...d.z[0])).toBe(1));
  });

  test("a grouped density gradient splits each row into a strip per model", async () => {
    await renderVis();
    fireEvent.change(yAxisSelect(), { target: { value: "topic" } });
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_est_energy_mwh" },
    });
    fireEvent.click(screen.getByText("Bar Chart"));
    fireEvent.click(await screen.findByText("Density Gradient"));
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "heatmap")).toBe(true),
    );
    const { data, layout } = lastPlot();
    expect(layout.yaxis.ticktext).toEqual(["sky"]);
    // Each model's strip within the row, the first model's on top
    const strips = data.filter((d) => d.type === "heatmap");
    expect(strips).toHaveLength(2);
    const [top, bottom] = strips.map((d) => (d.y[0] + d.y[1]) / 2);
    expect(top).toBeGreaterThan(bottom);
    strips.forEach((d) => {
      expect(d.y[0]).toBeGreaterThanOrEqual(-0.5);
      expect(d.y[1]).toBeLessThanOrEqual(0.5);
    });
    // The models are in the legend, since the strips can't be
    expect(
      data.filter((d) => d.showlegend !== false).map((d) => d.name),
    ).toEqual(expect.arrayContaining(["Haiku", "Gemini"]));
    const summary = data.find((d) =>
      String(d.text?.[0]).startsWith("<b>Haiku · sky</b>"),
    );
    expect(summary.text[0]).toBe(
      "<b>Haiku · sky</b><br>median 25 · range 20–30 · n = 2",
    );
  });

  test("puts the chart type button in the node's header, when given one", async () => {
    const header = document.createElement("span");
    document.body.appendChild(header);
    try {
      await renderVis(responses, header);
      fireEvent.change(xAxisSelect(), {
        target: { value: "__stat_est_energy_mwh" },
      });
      // In the header, with its name, and not also in the toolbar
      const button = header.querySelector("button") as HTMLButtonElement;
      expect(button.textContent).toBe("Bar Chart");
      expect(screen.getAllByText("Bar Chart")).toHaveLength(1);
      fireEvent.click(button);
      fireEvent.click(await screen.findByText("Box & Whiskers"));
      await waitFor(() =>
        expect(lastPlot()?.data.some((d) => d.type === "box")).toBe(true),
      );
      expect(button.textContent).toBe("Box & Whiskers");
    } finally {
      header.remove();
    }
  });

  test("warns when measured energies were taken under different power settings", async () => {
    const measured = (power_mode: string): ResponseStats => ({
      latency_ms: 1000,
      output_tokens: 100,
      energy_wh: 0.05,
      energy_conditions: { power_source: "battery", power_mode },
    });
    await renderVis([
      respObj("Haiku", "ollama", [
        measured("Automatic"),
        measured("Automatic"),
      ]),
      respObj("Gemini", "ollama", [measured("Low Power")]),
    ]);
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_energy_mwh" },
    });
    const note = await screen.findByText(
      "Measured under different power settings.",
    );
    const trigger = note.closest("[aria-describedby]") as HTMLElement;
    expect(
      document.getElementById(trigger.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe(
      "These were measured under different power settings (2 on battery, in Automatic power mode; 1 on battery, in Low Power Mode), which change the energy the same work takes. Compare them with care.",
    );
  });

  test("keeps its chart type and size in the node's data, for saved flows", async () => {
    const store = require("../../store").default;
    const setData = store.getState().setDataPropsForNode as jest.Mock;
    setData.mockClear();
    (HTMLElement.prototype as any).setPointerCapture = jest.fn();
    // As loaded from a saved flow: a box plot, resized to 321 x 234
    await renderVis(responses, undefined, {
      id: "vis1",
      data: {
        graph_type: "box",
        plot_size: { width: 321, height: 234 },
        selected_eval_res_var: "__stat_est_energy_mwh",
      },
    });
    const plotDiv = screen.getByTestId("plot").parentElement as HTMLElement;
    expect(plotDiv.style.width).toBe("321px");
    expect(plotDiv.style.height).toBe("234px");
    await waitFor(() =>
      expect(lastPlot()?.data.some((d) => d.type === "box")).toBe(true),
    );

    // Choosing a chart type, and resizing, save to the node's data
    fireEvent.click(screen.getByText("Box & Whiskers"));
    fireEvent.click(await screen.findByText("Bar Chart"));
    expect(setData).toHaveBeenCalledWith("vis1", { graph_type: "bar" });
    const handle = plotDiv.parentElement!.querySelector(
      '[style*="nwse-resize"]',
    ) as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(setData).toHaveBeenCalledWith("vis1", {
      plot_size: expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    });
  });

  test("follows its saved chart type and size when the node's data changes", async () => {
    const view = (data: any) => (
      <ColorSchemeProvider
        colorScheme="dark"
        toggleColorScheme={() => undefined}
      >
        <MantineProvider>
          <VisView responses={responses} id="vis2" data={data} />
        </MantineProvider>
      </ColorSchemeProvider>
    );
    const base = { selected_eval_res_var: "__stat_est_energy_mwh" };
    const { rerender } = render(
      view({
        ...base,
        graph_type: "bar",
        plot_size: { width: 300, height: 200 },
      }),
    );
    const plotDiv = screen.getByTestId("plot").parentElement as HTMLElement;
    expect(plotDiv.style.width).toBe("300px");
    expect(screen.getByText("Bar Chart")).toBeTruthy();
    // E.g. a saved flow loaded in its place, without remounting the node
    rerender(
      view({
        ...base,
        graph_type: "box",
        plot_size: { width: 410, height: 260 },
      }),
    );
    expect(await screen.findByText("Box & Whiskers")).toBeTruthy();
    expect(plotDiv.style.width).toBe("410px");
    expect(plotDiv.style.height).toBe("260px");
    // An older flow, with neither saved: the defaults, not what was shown before
    rerender(view(base));
    expect(await screen.findByText("Bar Chart")).toBeTruthy();
    expect(plotDiv.style.width).toBe("");
    expect(plotDiv.style.height).toBe("");
  });

  test("counts measurements with unknown power settings as their own group", async () => {
    const measured = (conditions?: any): ResponseStats => ({
      latency_ms: 1000,
      output_tokens: 100,
      energy_wh: 0.05,
      ...(conditions ? { energy_conditions: conditions } : {}),
    });
    await renderVis([
      respObj("Haiku", "ollama", [
        measured({ power_source: "AC power", power_mode: "Automatic" }),
      ]),
      respObj("Gemini", "ollama", [measured()]), // e.g. measured before they were recorded
    ]);
    fireEvent.change(xAxisSelect(), {
      target: { value: "__stat_energy_mwh" },
    });
    const note = await screen.findByText(
      "Measured under different power settings.",
    );
    const trigger = note.closest("[aria-describedby]") as HTMLElement;
    expect(
      document.getElementById(trigger.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toContain("1 under unknown power settings");
  });
});
