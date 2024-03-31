import React, { useState, useEffect, useCallback, useRef } from "react";
import { Handle, Position } from "reactflow";
import { NativeSelect } from "@mantine/core";
import useStore, { colorPalettes } from "./store";
import Plot from "react-plotly.js";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import PlotLegend, { PlotLegendProps } from "./PlotLegend";
import { cleanMetavarsFilterFunc, truncStr } from "./backend/utils";
import {
  Dict,
  EvaluationResults,
  EvaluationScore,
  JSONCompatible,
  LLMResponse,
} from "./backend/typing";
import { Status } from "./StatusIndicatorComponent";
import { grabResponses } from "./backend/backend";

// Helper funcs
const splitAndAddBreaks = (s: string, chunkSize: number) => {
  // Split the input string into chunks of specified size
  const chunks: string[] = [];
  for (let i = 0; i < s.length; i += chunkSize) {
    chunks.push(s.slice(i, i + chunkSize));
  }
  // Join the chunks with a <br> tag
  return chunks.join("<br>");
};

// Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
const createHoverTexts = (responses: string[]) => {
  const max_len = 500;
  return responses
    .map((s) => {
      // If responses were reduced across dimensions, this could include several. Pick the first and mark it as one of many:
      if (Array.isArray(s)) {
        const s_len = s.length;
        return s.map(
          (substr, idx) =>
            splitAndAddBreaks(truncStr(substr, max_len) ?? "", 60) +
            `<br><b>(${idx + 1} of ${s_len})</b>`,
        );
      } else return [splitAndAddBreaks(truncStr(s, max_len) ?? "", 60)];
    })
    .flat();
};

const getUniqueKeysInResponses = (
  responses: LLMResponse[],
  keyFunc: (r: LLMResponse) => string,
) => {
  const ukeys = new Set<string>();
  responses.forEach((res_obj) => ukeys.add(keyFunc(res_obj)));
  return Array.from(ukeys);
};

const extractEvalResultsForMetric = (
  metric: string,
  responses: LLMResponse[],
) => {
  return responses
    .map((resp_obj) =>
      resp_obj?.eval_res?.items?.map((item) =>
        typeof item === "object" ? item[metric] : undefined,
      ),
    )
    .flat();
};

const areSetsEqual = (xs: Set<any>, ys: Set<any>) =>
  xs.size === ys.size && [...xs].every((x) => ys.has(x));

function addLineBreaks(str: string, max_line_len: number) {
  if (!str || typeof str !== "string" || str.length === 0) return "";
  let result = "";
  const is_alphabetical = (s: string) => /^[A-Za-z]$/.test(s);
  for (let i = 0; i < str.length; i++) {
    result += str[i];
    if ((i + 1) % max_line_len === 0) {
      const next_char = i + 1 < str.length ? str[i + 1] : "";
      result +=
        (is_alphabetical(str[i]) && is_alphabetical(next_char) ? "-" : "") +
        "<br>";
    }
  }
  return result;
}

const genUniqueShortnames = (
  names: Iterable<string>,
  max_chars_per_line = 32,
) => {
  // Generate unique 'shortnames' to refer to each name:
  const past_shortnames_counts: Dict<number> = {};
  const shortnames: Dict<string> = {};
  const max_lines = 8;
  for (const name of names) {
    // Truncate string up to maximum num of chars
    let sn = truncStr(name, max_chars_per_line * max_lines - 3) ?? "";
    // Add <br> tags to spread across multiple lines, where necessary
    sn = addLineBreaks(sn, max_chars_per_line);
    if (sn in past_shortnames_counts) {
      past_shortnames_counts[sn] += 1;
      shortnames[name] = sn + `(${past_shortnames_counts[sn]})`;
    } else {
      shortnames[name] = sn;
      past_shortnames_counts[sn] = 1;
    }
  }
  return shortnames;
};

const calcMaxCharsPerLine = (shortnames: string[]) => {
  let max_chars = 1;
  for (let i = 0; i < shortnames.length; i++) {
    const sn = shortnames[i];
    if (sn.includes("<br>")) return sn.indexOf("<br>");
    else if (sn.length > max_chars) max_chars = sn.length;
  }
  return Math.max(max_chars, 9);
};

const calcLeftPaddingForYLabels = (shortnames: string[]) => {
  return calcMaxCharsPerLine(shortnames) * 7;
};

export interface VisNodeProps {
  data: {
    vars: { value: string; label: string }[];
    selected_vars: string[] | string;
    llm_groups?: { value: string; label: string }[];
    selected_llm_group?: string;
    input: string;
    refresh: boolean;
    title: string;
  };
  id: string;
}

const VisNode: React.FC<VisNodeProps> = ({ data, id }) => {
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const getColorForLLMAndSetIfNotFound = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );

  const [plotlySpec, setPlotlySpec] = useState<Dict[]>([]);
  const [plotlyLayout, setPlotlyLayout] = useState({});
  const [pastInputs, setPastInputs] = useState<JSONCompatible>([]);
  const [responses, setResponses] = useState<LLMResponse[]>([]);
  const [status, setStatus] = useState<Status>(Status.NONE);
  const [placeholderText, setPlaceholderText] = useState(<></>);

  const [plotLegend, setPlotLegend] = useState<React.ReactNode>(null);
  const [selectedLegendItems, setSelectedLegendItems] = useState<
    string[] | null
  >(null);

  const plotDivRef = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<Plot>(null);

  // The MultiSelect so people can dynamically set what vars they care about
  const [multiSelectVars, setMultiSelectVars] = useState(data.vars ?? []);
  const [multiSelectValue, setMultiSelectValue] = useState(
    Array.isArray(data.selected_vars) && data.selected_vars.length > 0
      ? data.selected_vars[0]
      : "LLM (default)",
  );

  // Typically, a user will only need the default LLM 'group' --all LLMs in responses.
  // However, when prompts are chained together, the original LLM info is stored in metavars as a key.
  // LLM groups allow you to plot against the original LLMs, even though a 'scorer' LLM might come after.
  const [availableLLMGroups, setAvailableLLMGroups] = useState(
    data.llm_groups ?? [{ value: "LLM", label: "LLM" }],
  );
  const [selectedLLMGroup, setSelectedLLMGroup] = useState(
    data.selected_llm_group ?? "LLM",
  );
  const handleChangeLLMGroup = (
    new_val: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setSelectedLLMGroup(new_val.target.value);
    setDataPropsForNode(id, { selected_llm_group: new_val.target.value });
  };

  // When the user clicks an item in the drop-down,
  // we want to autoclose the multiselect drop-down:
  const multiSelectRef = useRef<HTMLSelectElement>(null);
  const handleMultiSelectValueChange = (
    new_val: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    if (multiSelectRef?.current) {
      multiSelectRef.current.blur();
    }
    setStatus(Status.LOADING);
    setMultiSelectValue(new_val.target.value);
    setDataPropsForNode(id, { selected_vars: [new_val.target.value] });
  };

  // Re-plot responses when anything changes
  useEffect(() => {
    if (!responses || responses.length === 0 || !multiSelectValue) return;

    // Check if there are evaluation results
    if (responses.every((r) => r?.eval_res === undefined)) {
      setPlaceholderText(
        <p
          style={{
            maxWidth: "220px",
            backgroundColor: "#f0f0aa",
            padding: "10px",
            fontSize: "10pt",
          }}
        >
          To plot evaluation results, you need to run LLM responses through an
          Evaluator Node or LLM Scorer Node first.
        </p>,
      );
      return;
    }

    setStatus(Status.NONE);

    const get_llm = (resp_obj: LLMResponse) => {
      if (selectedLLMGroup === "LLM")
        return typeof resp_obj.llm === "string"
          ? resp_obj.llm
          : resp_obj.llm?.name;
      else return resp_obj.metavars[selectedLLMGroup] as string;
    };
    const getLLMsInResponses = (responses: LLMResponse[]) =>
      getUniqueKeysInResponses(responses, get_llm);

    // Get all LLMs in responses, by selected LLM group
    const llm_names = getLLMsInResponses(responses);

    // If there are variables but no variables are selected and only 1 LLM is present...
    // if (llm_names.length <= 1 && multiSelectVars && multiSelectVars.length > 0 && multiSelectValue.length === 0) {
    //     console.warn('No variables selected to plot.');
    //     setSelectedLegendItems(null);
    //     setPlotLegend(null);
    //     setPlotlySpec([]);
    //     setPlotlyLayout({});
    //     setPlaceholderText(
    //         <p style={{maxWidth: '220px', backgroundColor: '#f0f0aa', padding: '10px', fontSize: '10pt'}}>{
    //             "Please select at least one parameter to plot."
    //         }</p>
    //     )
    //     return;
    // }

    // Create Plotly spec here
    const varnames =
      multiSelectValue !== "LLM (default)" && multiSelectValue !== undefined
        ? [multiSelectValue]
        : [];
    const varcolors = colorPalettes.var; // ['#44d044', '#f1b933', '#e46161', '#8888f9', '#33bef0', '#bb55f9', '#cadefc', '#f8f398'];
    let spec: Dict[] | Dict = [];
    const layout: Dict = {
      autosize: true,
      dragmode: "pan",
      title: "",
      margin: {
        l: 125,
        r: 0,
        b: 36,
        t: 20,
        pad: 6,
      },
      yaxis: { showgrid: true },
    };

    // Bucket responses by LLM:
    const responses_by_llm: Dict<LLMResponse[]> = {};
    responses.forEach((item) => {
      const llm = get_llm(item);
      if (llm in responses_by_llm) responses_by_llm[llm].push(item);
      else responses_by_llm[llm] = [item];
    });

    // Get the type of evaluation results, if present
    // (This is assumed to be consistent across response batches)
    let typeof_eval_res =
      responses[0].eval_res && "dtype" in responses[0].eval_res
        ? responses[0].eval_res.dtype
        : "Numeric";

    // If categorical type, check if all binary:
    if (typeof_eval_res === "Categorical") {
      const is_all_bools = responses.reduce(
        (acc0: boolean, res_obj: LLMResponse) =>
          acc0 &&
          res_obj.eval_res !== undefined &&
          res_obj.eval_res.items?.reduce(
            (acc: boolean, cur: EvaluationScore) =>
              acc && typeof cur === "boolean",
            true,
          ),
        true,
      );
      if (is_all_bools) typeof_eval_res = "Boolean";
    }

    // Check the max length of eval results, as if it's only 1 score per item (num of generations per prompt n=1),
    // we might want to plot the result differently:
    let max_num_results_per_prompt = 1;
    responses.forEach((res_obj) => {
      if (
        res_obj.eval_res !== undefined &&
        res_obj.eval_res?.items?.length > max_num_results_per_prompt
      )
        max_num_results_per_prompt = res_obj.eval_res.items.length;
    });

    let plot_legend: React.ReactNode | null = null;
    let metric_axes_labels: string[] = [];
    let num_metrics = 1;
    if (
      typeof_eval_res.includes("KeyValue") &&
      responses[0].eval_res !== undefined
    ) {
      metric_axes_labels = Object.keys(responses[0].eval_res.items[0]);
      num_metrics = metric_axes_labels.length;
    }

    const get_var = (
      resp_obj: LLMResponse,
      varname: string,
      empty_str_if_undefined = false,
    ) => {
      const v = varname.startsWith("__meta_")
        ? resp_obj.metavars[varname.slice("__meta_".length)]
        : resp_obj.vars[varname];
      if (v === undefined && empty_str_if_undefined) return "";
      return v;
    };

    const get_var_and_trim = (
      resp_obj: LLMResponse,
      varname: string,
      empty_str_if_undefined = false,
    ) => {
      const v = get_var(resp_obj, varname, empty_str_if_undefined);
      if (v !== undefined) return v.trim();
      else return v;
    };

    const get_items = (eval_res_obj?: EvaluationResults) => {
      if (eval_res_obj === undefined) return [];
      if (typeof_eval_res.includes("KeyValue"))
        return eval_res_obj.items.map(
          (item) =>
            (item as Dict<boolean | number | string>)[metric_axes_labels[0]],
        );
      return eval_res_obj.items;
    };

    // Only for Boolean data
    const plot_accuracy = (
      resp_to_x: (r: LLMResponse) => string,
      group_type: "var" | "llm",
    ) => {
      // Plots the percentage of 'true' evaluations out of the total number of evaluations,
      // per category of 'resp_to_x', as a horizontal bar chart, with different colors per category.
      const names = new Set(responses.map(resp_to_x));
      const shortnames = genUniqueShortnames(names);
      const x_items: number[] = [];
      const y_items: string[] = [];
      const marker_colors: string[] = [];
      for (const name of names) {
        // Add a shortened version of the name as the y-tick
        y_items.push(shortnames[name]);

        // Calculate how much percentage a single 'true' value counts for:
        const num_eval_scores = responses.reduce((acc, r) => {
          if (resp_to_x(r) !== name) return acc;
          else return acc + get_items(r.eval_res).length;
        }, 0);
        const perc_scalar = 100 / num_eval_scores;

        // Calculate the length of the bar
        x_items.push(
          responses.reduce((acc: number, r: LLMResponse) => {
            if (resp_to_x(r) !== name) return acc;
            else
              return (
                acc +
                get_items(r.eval_res).filter((res) => res === true).length *
                  perc_scalar
              );
          }, 0),
        );

        // Lookup the color per LLM when displaying LLM differences,
        // otherwise use the palette for displaying variables.
        const color =
          group_type === "llm"
            ? getColorForLLMAndSetIfNotFound(name)
            : getColorForLLMAndSetIfNotFound(get_llm(responses[0]));
        marker_colors.push(color);
      }

      // Set the left margin to fit the yticks labels
      layout.margin.l = calcLeftPaddingForYLabels(Object.values(shortnames));

      spec = [
        {
          type: "bar",
          y: y_items,
          x: x_items,
          marker: {
            color: marker_colors,
          },
          // error_x: { // TODO: Error bars
          //     type: 'data',
          //     array: [0.5, 1, 2],
          //     visible: true
          // },
          hovertemplate: "%{x:.2f}%<extra>%{y}</extra>",
          showtrace: false,
          orientation: "h",
        },
      ];
      layout.xaxis = {
        range: [0, 100],
        tickmode: "linear",
        tick0: 0,
        dtick: 10,
      };

      if (metric_axes_labels.length > 0)
        layout.xaxis = {
          title: { font: { size: 12 }, text: metric_axes_labels[0] },
          ...layout.xaxis,
        };
      else
        layout.xaxis = {
          title: { font: { size: 12 }, text: "% percent true" },
          ...layout.xaxis,
        };
    };

    const plot_simple_boxplot = (
      resp_to_x: (r: LLMResponse) => string,
      group_type: "var" | "llm",
    ) => {
      let names = new Set<string>();
      const plotting_categorical_vars =
        group_type === "var" && typeof_eval_res === "Categorical";

      // When we're plotting vars, we want the stacked bar colors to be the *categories*,
      // and the x_items to be the names of vars, so that the left axis is a vertical list of varnames.
      if (plotting_categorical_vars) {
        // Get all categories present in the evaluation results
        responses.forEach((r) =>
          get_items(r.eval_res).forEach((i) => names.add(i.toString())),
        );
      } else {
        // Get all possible values of the single variable response ('name' vals)
        names = new Set(responses.map(resp_to_x));
      }

      const shortnames = genUniqueShortnames(names);
      for (const name of names) {
        let x_items: EvaluationScore[] = [];
        let text_items: string[] = [];

        if (plotting_categorical_vars) {
          responses.forEach((r) => {
            // Get all evaluation results for this response which match the category 'name':
            const eval_res = get_items(r.eval_res).filter((i) => i === name);
            x_items = x_items.concat(
              new Array(eval_res.length).fill(resp_to_x(r)),
            );
          });
        } else {
          responses.forEach((r) => {
            if (resp_to_x(r) !== name) return;
            x_items = x_items.concat(get_items(r.eval_res));
            text_items = text_items.concat(
              createHoverTexts(
                r.responses.map((v) => (typeof v === "string" ? v : v.d)),
              ),
            );
          });
        }

        // Lookup the color per LLM when displaying LLM differences,
        // otherwise use the palette for displaying variables.
        const color =
          group_type === "llm"
            ? getColorForLLMAndSetIfNotFound(name)
            : // :   varcolors[name_idx % varcolors.length];
              getColorForLLMAndSetIfNotFound(get_llm(responses[0]));

        if (
          typeof_eval_res === "Boolean" ||
          typeof_eval_res === "Categorical"
        ) {
          // Plot a histogram for categorical data.
          spec.push({
            type: "histogram",
            histfunc: "sum",
            name: shortnames[name],
            marker: { color },
            y: x_items,
            orientation: "h",
          });
          layout.barmode = "stack";
          layout.yaxis = {
            showticklabels: true,
            dtick: 1,
            type: "category",
            showgrid: true,
          };
          layout.xaxis = {
            title: { font: { size: 12 }, text: "Number of 'true' values" },
            ...layout.xaxis,
          };
        } else {
          // Plot a boxplot for all other cases.
          // x_items = [x_items.reduce((val, acc) => val + acc, 0)];
          const d: Dict = {
            name: shortnames[name],
            x: x_items,
            text: text_items,
            hovertemplate: "%{text}",
            orientation: "h",
            marker: { color },
          };

          // If only one result, plot a bar chart:
          if (x_items.length === 1) {
            d.type = "bar";
            d.textposition = "none"; // hide the text which appears within each bar
            d.y = new Array(x_items.length).fill(shortnames[name]);
          } else {
            // If multiple eval results per response object (num generations per prompt n > 1),
            // plot box-and-whiskers to illustrate the variability:
            d.type = "box";
            d.boxpoints = "all";
          }
          spec.push(d);
        }
      }
      layout.hovermode = "closest";
      layout.showlegend = false;

      // Set the left margin to fit the yticks labels
      layout.margin.l = calcLeftPaddingForYLabels(Object.values(shortnames));

      if (metric_axes_labels.length > 0)
        layout.xaxis = {
          title: { font: { size: 12 }, text: metric_axes_labels[0] },
          ...layout.xaxis,
        };
    };

    const plot_grouped_boxplot = (resp_to_x: (r: LLMResponse) => string) => {
      // Get all possible values of the single variable response ('name' vals)
      const names = new Set(responses.map(resp_to_x));
      const shortnames = genUniqueShortnames(names);

      llm_names.forEach((llm) => {
        // Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
        const rs = responses_by_llm[llm];

        let x_items: EvaluationScore[] = [];
        let y_items: EvaluationScore[] = [];
        let text_items: string[] = [];
        for (const name of names) {
          rs.forEach((r) => {
            if (resp_to_x(r) !== name) return;
            x_items = x_items.concat(get_items(r.eval_res)).flat();
            text_items = text_items
              .concat(
                createHoverTexts(
                  r.responses.map((v) => (typeof v === "string" ? v : v.d)),
                ),
              )
              .flat();
            y_items = y_items
              .concat(
                Array(get_items(r.eval_res).length).fill(shortnames[name]),
              )
              .flat();
          });
        }

        if (typeof_eval_res === "Boolean") {
          // Plot a histogram for boolean (true/false) categorical data.
          spec.push({
            type: "histogram",
            histfunc: "sum",
            name: llm,
            marker: { color: getColorForLLMAndSetIfNotFound(llm) },
            x: x_items.map((i) => (i === true ? "1" : "0")),
            y: y_items,
            orientation: "h",
          });
          layout.barmode = "stack";
          layout.xaxis = {
            title: { font: { size: 12 }, text: "Number of 'true' values" },
            ...layout.xaxis,
          };
        } else {
          // Plot a boxplot or bar chart for other cases.
          const d = {
            name: llm,
            marker: { color: getColorForLLMAndSetIfNotFound(llm) },
            x: x_items,
            y: y_items,
            boxpoints: "all",
            text: text_items,
            hovertemplate: "%{text} <b><i>(%{x})</i></b>",
            orientation: "h",
          } as Dict;

          // If only one result, plot a bar chart:
          if (max_num_results_per_prompt === 1) {
            d.type = "bar";
            d.textposition = "none"; // hide the text which appears within each bar
          } else {
            // If multiple eval results per response object (num generations per prompt n > 1),
            // plot box-and-whiskers to illustrate the variability:
            d.type = "box";
          }

          spec.push(d);
          layout.xaxis = {
            title: { font: { size: 12 }, text: "score" },
            ...layout.axis,
          };
        }
      });
      layout.boxmode = "group";
      layout.bargap = 0.5;

      // Set the left margin to fit the yticks labels
      layout.margin.l = calcLeftPaddingForYLabels(Object.values(shortnames));

      if (metric_axes_labels.length > 0)
        layout.xaxis = {
          title: { font: { size: 12 }, text: metric_axes_labels[0] },
        };
    };

    if (num_metrics > 1) {
      // For 2 or more metrics, display a parallel coordinates plot.
      // :: For instance, if evaluator produces { height: 32, weight: 120 } plot responses with 2 metrics, 'height' and 'weight'
      if (varnames.length === 1) {
        const unique_vals = getUniqueKeysInResponses(responses, (resp_obj) =>
          get_var(resp_obj, varnames[0]),
        );
        // const response_txts = responses.map(res_obj => res_obj.responses).flat();

        const group_colors = varcolors;
        const unselected_line_color = "#ddd";
        const spec_colors = responses
          .map((resp_obj) => {
            const idx = unique_vals.indexOf(get_var(resp_obj, varnames[0]));
            return resp_obj.eval_res
              ? Array(resp_obj.eval_res.items.length).fill(idx)
              : [];
          })
          .flat();

        const colorscale: [number, string][] = [];
        for (let i = 0; i < unique_vals.length; i++) {
          if (
            !selectedLegendItems ||
            selectedLegendItems.indexOf(unique_vals[i]) > -1
          )
            colorscale.push([
              i / (unique_vals.length - 1),
              group_colors[i % group_colors.length],
            ]);
          else
            colorscale.push([
              i / (unique_vals.length - 1),
              unselected_line_color,
            ]);
        }

        const dimensions: Dict = [];
        metric_axes_labels.forEach((metric) => {
          const evals = extractEvalResultsForMetric(metric, responses);
          dimensions.push({
            range: evals.every((e) => typeof e === "number")
              ? [
                  Math.min(...(evals as number[])),
                  Math.max(...(evals as number[])),
                ]
              : undefined,
            label: metric,
            values: evals,
          });
        });

        spec.push({
          type: "parcoords",
          pad: [10, 10, 10, 10],
          line: {
            color: spec_colors,
            colorscale,
          },
          dimensions,
        });
        layout.margin = { l: 40, r: 40, b: 40, t: 50, pad: 0 };
        layout.paper_bgcolor = "white";
        layout.font = { color: "black" };
        layout.selectedpoints = [];

        // There's no built-in legend for parallel coords, unfortunately, so we need to construct our own:
        const legend_labels: Dict<string> = {};
        unique_vals.forEach((v, idx) => {
          if (!selectedLegendItems || selectedLegendItems.indexOf(v) > -1)
            legend_labels[v] = group_colors[idx % group_colors.length];
          else legend_labels[v] = unselected_line_color;
        });
        const onClickLegendItem = (label: string) => {
          if (
            selectedLegendItems &&
            selectedLegendItems.length === 1 &&
            selectedLegendItems[0] === label
          )
            setSelectedLegendItems(null); // Clicking twice on a legend item deselects it and displays all
          else setSelectedLegendItems([label]);
        };
        plot_legend = (
          <PlotLegend labels={legend_labels} onClickLabel={onClickLegendItem} />
        );

        // Tried to support Plotly hover events here, but looks like
        // currently there are unsupported for parcoords: https://github.com/plotly/plotly.js/issues/3012
        // onHover = (e) => {
        //     console.log(e.curveNumber);
        //     // const curveIdx = e.curveNumber;
        //     // if (curveIdx < response_txts.length) {
        //     //     if (!selectedLegendItems || selectedLegendItems.indexOf(unique_vals[spec_colors[curveIdx]]) > -1)
        //     //         console.log(response_txts[curveIdx]);
        //     // }
        // };
      } else {
        setSelectedLegendItems(null);
        const error_text =
          "Plotting evaluations with more than one metric and more than one prompt parameter is currently unsupported.";
        setPlaceholderText(
          <p
            style={{
              maxWidth: "220px",
              backgroundColor: "#f0aaaa",
              padding: "10px",
              fontSize: "10pt",
            }}
          >
            {error_text}
          </p>,
        );
        console.error(error_text);
      }
    } else {
      // A single metric --use plots like grouped box-and-whiskers, 3d scatterplot
      if (varnames.length === 0) {
        // No variables means they used a single prompt (no template) to generate responses
        // (Users are likely evaluating differences in responses between LLMs)
        if (typeof_eval_res === "Boolean") plot_accuracy(get_llm, "llm");
        else plot_simple_boxplot(get_llm, "llm");
      } else if (varnames.length === 1) {
        // 1 var; numeric eval
        if (llm_names.length === 1) {
          if (typeof_eval_res === "Boolean")
            // Accuracy plot per value of the selected variable:
            plot_accuracy((r) => get_var_and_trim(r, varnames[0]), "var");
          else {
            // Simple box plot, as there is only a single LLM in the response
            plot_simple_boxplot((r) => get_var_and_trim(r, varnames[0]), "var");
          }
        } else {
          // There are multiple LLMs in the response; do a grouped box plot by LLM.
          // Note that 'name' is now the LLM, and 'x' stores the value of the var:
          plot_grouped_boxplot((r) => get_var_and_trim(r, varnames[0]));
        }
      } else if (varnames.length === 2) {
        // Input is 2 vars; numeric eval
        // Display a 3D scatterplot with 2 dimensions:

        const names_0 = new Set(
          responses.map((r) => get_var_and_trim(r, varnames[0])),
        );
        const shortnames_0 = genUniqueShortnames(names_0);
        const names_1 = new Set(
          responses.map((r) => get_var_and_trim(r, varnames[1])),
        );
        const shortnames_1 = genUniqueShortnames(names_1);

        if (llm_names.length === 1) {
          spec = {
            type: "scatter3d",
            x: responses
              .map((r) => get_var(r, varnames[0], true))
              .map((s) => shortnames_0[s]),
            y: responses
              .map((r) => get_var(r, varnames[1], true))
              .map((s) => shortnames_1[s]),
            z: responses.map(
              (r) =>
                get_items(r.eval_res).reduce(
                  (acc: number, val) =>
                    acc + (typeof val === "number" ? val : 0),
                  0,
                ) / (r.eval_res?.items.length ?? 1),
            ), // calculates mean
            mode: "markers",
            marker: {
              color: getColorForLLMAndSetIfNotFound(llm_names[0]),
            },
          };
        } else {
          spec = [];
          llm_names.forEach((llm) => {
            const resps = responses.filter((r) => get_llm(r) === llm);
            spec.push({
              type: "scatter3d",
              x: resps
                .map((r) => get_var(r, varnames[0], true))
                .map((s) => shortnames_0[s]),
              y: resps
                .map((r) => get_var(r, varnames[1], true))
                .map((s) => shortnames_1[s]),
              z: resps.map(
                (r) =>
                  get_items(r.eval_res).reduce(
                    (acc: number, val) =>
                      acc + (typeof val === "number" ? val : 0),
                    0,
                  ) / (r.eval_res?.items.length ?? 1),
              ), // calculates mean
              mode: "markers",
              marker: {
                color: getColorForLLMAndSetIfNotFound(llm),
              },
              name: llm,
            });
          });
        }
      }
    }

    if (!Array.isArray(spec)) spec = [spec];

    setPlotLegend(plot_legend);
    setPlotlySpec(spec as Dict[]);
    setPlotlyLayout(layout);

    // if (plotDivRef && plotDivRef.current) {
    //     plotDivRef.current.style.width = '300px';
    // }
  }, [
    multiSelectVars,
    multiSelectValue,
    selectedLLMGroup,
    responses,
    selectedLegendItems,
    plotDivRef,
  ]);

  const handleOnConnect = useCallback(() => {
    // Grab the input node ids
    const input_node_ids = [data.input];

    grabResponses(input_node_ids)
      .then(function (resps) {
        if (resps && resps.length > 0) {
          // Store responses and extract + store vars
          // toReversed exists, but TypeScript does not see it.
          setResponses((resps as any).toReversed());

          // Find all vars in responses
          let varnames: string[] | Set<string> = new Set<string>();
          let metavars: string[] | Set<string> = new Set<string>();
          resps.forEach((resp_obj) => {
            Object.keys(resp_obj.vars).forEach((v) =>
              (varnames as Set<string>).add(v),
            );
            if (resp_obj.metavars)
              Object.keys(resp_obj.metavars).forEach((v) =>
                (metavars as Set<string>).add(v),
              );
          });
          varnames = Array.from(varnames);
          metavars = Array.from(metavars);

          // Get all vars for the y-axis dropdown, merging metavars and vars into one list,
          // and excluding any special 'LLM group' metavars:
          const msvars = [{ value: "LLM (default)", label: "LLM (default)" }]
            .concat(varnames.map((name) => ({ value: name, label: name })))
            .concat(
              metavars.filter(cleanMetavarsFilterFunc).map((name) => ({
                value: `__meta_${name}`,
                label: `${name} (meta)`,
              })),
            );

          // Find all the special 'LLM group' metavars and put them in the 'group by' dropdown:
          const available_llm_groups = [{ value: "LLM", label: "LLM" }].concat(
            metavars.filter(cleanMetavarsFilterFunc).map((name) => ({
              value: name,
              label: `LLMs #${parseInt(name.slice(4)) + 1}`,
            })),
          );
          if (available_llm_groups.length > 1)
            available_llm_groups[0] = { value: "LLM", label: "LLMs (last)" };
          setAvailableLLMGroups(available_llm_groups);

          // Check for a change in available parameters
          if (
            !multiSelectVars ||
            !multiSelectValue ||
            !areSetsEqual(
              new Set(msvars.map((o) => o.value)),
              new Set(multiSelectVars.map((o) => o.value)),
            )
          ) {
            setMultiSelectValue("LLM (default)");
            setMultiSelectVars(msvars);
            setDataPropsForNode(id, {
              vars: msvars,
              selected_vars: [],
              llm_groups: available_llm_groups,
            });
          }
          // From here a React effect will detect the changes to these values and display a new plot
        }
      })
      .catch(console.error);
  }, [data]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input !== pastInputs) {
      setPastInputs(data.input);
      handleOnConnect();
    }
  }

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      // Recreate the visualization:
      setDataPropsForNode(id, { refresh: false });
      handleOnConnect();
    }
  }, [data, id, handleOnConnect, setDataPropsForNode]);

  // Resizing the plot when div is resized:
  const setPlotDivRef = useCallback(
    (elem: HTMLDivElement) => {
      // To listen for resize events of the textarea, we need to use a ResizeObserver.
      // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div wrapping the Plotly vis.
      if (!plotDivRef.current && window.ResizeObserver) {
        const observer = new window.ResizeObserver(() => {
          if (
            !plotlyRef ||
            !plotlyRef.current ||
            // @ts-expect-error resizeHandler is a private property we access to force a redraw.
            !plotlyRef.current.resizeHandler ||
            !plotlySpec ||
            plotlySpec.length === 0
          )
            return;
          // The below calls Plotly.Plots.resize() on the specific element
          // @ts-expect-error resizeHandler is a private property we access to force a redraw.
          plotlyRef.current.resizeHandler();
        });

        observer.observe(elem);
      }
      plotDivRef.current = elem;
    },
    [plotDivRef, plotlySpec],
  );

  return (
    <BaseNode classNames="vis-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Vis Node"}
        nodeId={id}
        status={status}
        icon={"📊"}
      />
      <div
        style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}
      >
        <div style={{ display: "inline-flex", maxWidth: "50%" }}>
          <span
            style={{
              fontSize: "10pt",
              margin: "6pt 3pt 0 3pt",
              fontWeight: "bold",
              whiteSpace: "nowrap",
            }}
          >
            y-axis:
          </span>
          <NativeSelect
            ref={multiSelectRef}
            onChange={handleMultiSelectValueChange}
            className="nodrag nowheel"
            data={multiSelectVars}
            placeholder="Pick param to plot"
            size="xs"
            value={multiSelectValue}
            miw="80px"
          />
        </div>
        <div
          style={{
            display: "inline-flex",
            justifyContent: "space-evenly",
            maxWidth: "30%",
            marginLeft: "10pt",
          }}
        >
          <span
            style={{
              fontSize: "10pt",
              margin: "6pt 3pt 0 0",
              fontWeight: "bold",
              whiteSpace: "nowrap",
            }}
          >
            x-axis:
          </span>
          <NativeSelect
            className="nodrag nowheel"
            data={["score"]}
            size="xs"
            value={"score"}
            miw="80px"
            disabled
          />
        </div>
        <div
          style={{
            display: "inline-flex",
            justifyContent: "space-evenly",
            maxWidth: "30%",
            marginLeft: "10pt",
          }}
        >
          <span
            style={{
              fontSize: "10pt",
              margin: "6pt 3pt 0 0",
              fontWeight: "bold",
              whiteSpace: "nowrap",
            }}
          >
            group by:
          </span>
          <NativeSelect
            className="nodrag nowheel"
            onChange={handleChangeLLMGroup}
            data={availableLLMGroups}
            size="xs"
            value={selectedLLMGroup}
            miw="80px"
            disabled={availableLLMGroups.length <= 1}
          />
        </div>
      </div>
      <hr />
      <div
        className="nodrag"
        ref={setPlotDivRef}
        style={{ minWidth: "150px", minHeight: "100px" }}
      >
        {plotlySpec && plotlySpec.length > 0 ? <></> : placeholderText}
        <Plot
          ref={plotlyRef}
          data={plotlySpec}
          layout={plotlyLayout}
          useResizeHandler={true}
          className="plotly-vis"
          style={{
            display: plotlySpec && plotlySpec.length > 0 ? "block" : "none",
          }}
        />
        {plotLegend ?? <></>}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="grouped-handle"
        style={{ top: "50%" }}
        onConnect={handleOnConnect}
      />
    </BaseNode>
  );
};

export default VisNode;
