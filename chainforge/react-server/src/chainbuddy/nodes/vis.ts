import doc from "../knowledge/nodes/vis.md";
import { PLOTTABLE_STATS } from "../../backend/responseStats";
import { oneOf, titleSetting } from "./common";
import { NodeKind } from "./types";

/** ChainBuddy's name for a measure, from its label: "Energy, measured (mWh)" → "energy_measured". */
const nameOf = (label: string) =>
  label
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * The measures ChainForge records while running prompts, by ChainBuddy's name
 * → the key the node plots by. Read from ChainForge's own list, so a measure
 * it adds reaches ChainBuddy with no change here. Any other metric is an
 * evaluator's own key, which only that evaluator knows, and passes through.
 */
const measures = () =>
  Object.fromEntries(PLOTTABLE_STATS.map((s) => [nameOf(s.label), s.key]));
const measureName = (key: string) =>
  Object.entries(measures()).find(([, k]) => k === key)?.[0];

/** The Vis Node's chart types (GRAPH_OPTIONS in VisNode.tsx). */
const CHARTS = ["bar", "box", "violin", "gradient"];

export const visKind: NodeKind = {
  type: "vis",
  name: "Vis Node",
  doc,
  accepts: ["responses", "scored_responses"],
  // It plots one input; ChainForge ignores any others.
  oneSource: true,
  handles: { inputs: { responses: "input" } },
  unconnectedHint: "Connect the responses it should plot to it.",

  settings: {
    title: titleSetting,
    metric: {
      label: "Plots",
      values: () => ["score", ...Object.keys(measures())],
      check: (value) => {
        if (typeof value !== "string" || value.trim() === "")
          return "metric should be the name of what to plot.";
        return value.startsWith("__")
          ? `metric shouldn't be one of the node's own keys. Use "score", a measure (${Object.keys(measures()).join(", ")}), or an evaluator's own key.`
          : undefined;
      },
    },
    chart: {
      label: "Chart",
      values: () => CHARTS,
      check: oneOf("chart", CHARTS),
    },
  },

  inputs: () => ["responses"],

  // Measures are recorded on a Prompt Node's own responses; an evaluator's
  // scored responses don't carry them.
  checkSource: (gives, settings) =>
    gives === "scored_responses" &&
    typeof settings.metric === "string" &&
    measures()[settings.metric]
      ? `it plots ${settings.metric}, which only a Prompt Node's own responses carry, not an evaluator's. Connect it straight to the Prompt Node, or plot "score".`
      : undefined,

  read(data) {
    const key = data.selected_eval_res_var;
    return {
      title: data.title ?? visKind.name,
      ...(key ? { metric: measureName(key) ?? key } : {}),
      chart: CHARTS.includes(data.graph_type) ? data.graph_type : CHARTS[0],
    };
  },

  write(settings, base) {
    const out = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;
    if (typeof settings.metric === "string")
      out.selected_eval_res_var =
        measures()[settings.metric] ?? settings.metric;
    if (typeof settings.chart === "string" && CHARTS.includes(settings.chart))
      out.graph_type = settings.chart;
    return out;
  },
};
