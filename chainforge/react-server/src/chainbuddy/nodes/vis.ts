import doc from "../knowledge/nodes/vis.md";
import { oneOf, titleSetting } from "./common";
import { NodeKind } from "./types";

/**
 * ChainBuddy's name for a measure → the key the node plots by. The node's own
 * keys for what it recorded while running are internal (`__stat_…`, see
 * backend/responseStats.ts), so ChainBuddy names them. Anything else is an
 * evaluator's own key, which only that evaluator knows, and passes through.
 */
const METRICS: Record<string, string> = {
  latency: "__stat_latency_s",
  time_before_output: "__stat_ttft_s",
  input_tokens: "__stat_input_tokens",
  output_tokens: "__stat_output_tokens",
  speed: "__stat_tokens_per_s",
  decoding_speed: "__stat_decode_tokens_per_s",
  cost: "__stat_cost_usd",
  energy_measured: "__stat_energy_mwh",
  energy_estimated: "__stat_est_energy_mwh",
};
const METRIC_NAMES = Object.fromEntries(
  Object.entries(METRICS).map(([name, key]) => [key, name]),
);

const CHARTS = ["bar", "box"];

export const visKind: NodeKind = {
  type: "vis",
  name: "Vis Node",
  doc,
  accepts: ["responses", "scored_responses"],
  handles: { inputs: { responses: "input" } },
  unconnectedHint: "Connect the responses it should plot to it.",

  settings: {
    title: titleSetting,
    metric: {
      label: "Plots",
      check: (value) => {
        if (typeof value !== "string" || value.trim() === "")
          return "metric should be the name of what to plot.";
        return value.startsWith("__")
          ? `metric shouldn't be one of the node's own keys. Use ${Object.keys(METRICS).join(", ")}, "score", or an evaluator's own key.`
          : undefined;
      },
    },
    chart: { label: "Chart", check: oneOf("chart", CHARTS) },
  },

  inputs: () => ["responses"],

  read(data) {
    const key = data.selected_eval_res_var;
    return {
      title: data.title ?? visKind.name,
      ...(key ? { metric: METRIC_NAMES[key] ?? key } : {}),
      chart: CHARTS.includes(data.graph_type) ? data.graph_type : CHARTS[0],
    };
  },

  write(settings, base) {
    const out = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;
    if (typeof settings.metric === "string")
      out.selected_eval_res_var = METRICS[settings.metric] ?? settings.metric;
    if (typeof settings.chart === "string" && CHARTS.includes(settings.chart))
      out.graph_type = settings.chart;
    return out;
  },
};
