import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useTransition,
} from "react";
import { Handle, Position } from "reactflow";
import {
  Button,
  Menu,
  NativeSelect,
  Switch,
  useMantineColorScheme,
} from "@mantine/core";
import useStore from "./store";
import Plot from "react-plotly.js";
// The Plotly bundle react-plotly.js renders with (importing "plotly.js" would
// add a second copy), for resizing plots ourselves. It has no type declarations.
// @ts-expect-error No declaration file for plotly.js/dist/plotly
import Plotly from "plotly.js/dist/plotly";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import ResizeHandle from "./ResizeHandle";
import VisStatsPanel from "./VisStatsPanel";
import {
  buildEvalStatsRows,
  compareEvalStats,
  EvalStatsEntity,
  EvalStatsFactor,
  EvalStatsResult,
  EvalStatsRow,
  isEvalStatsAvailable,
  toStatsScore,
} from "./backend/evalStats";
import {
  cleanMetavarsFilterFunc,
  llmResponseDataToString,
  truncStr,
} from "./backend/utils";
import {
  Dict,
  EvaluationResults,
  EvaluationScore,
  JSONCompatible,
  LLMResponse,
  LLMResponseData,
} from "./backend/typing";
import { Status } from "./StatusIndicatorComponent";
import { grabResponses } from "./backend/backend";
import { StringLookup } from "./backend/cache";
import { IconChartBar, IconChartHistogram } from "@tabler/icons-react";
import {
  AIGenPlotPopover,
  AIPlotHeaderButtons,
  AIPlotView,
} from "./VisNodeAIPlot";
import { AIPlot } from "./backend/aiPlots";

/**
 * STATS
 */
import { sum } from "simple-statistics";
// import * as jStat from "jstat"; // jStat is a pure JS library without types

// FUTURE: Including in-progress error bar computation for future use.
// const bootstrapCI = (
//   values: number[],
//   numSamples = 1000,
//   alpha = 0.05,
//   overFunc?: (ns: number[]) => number,
// ) => {
//   const means = [];
//   const f = overFunc ?? mean;
//   for (let i = 0; i < numSamples; i++) {
//     // Resample with replacement
//     const resampled = sampleWithReplacement(values, values.length, Math.random);
//     means.push(f(resampled));
//   }

//   // Compute percentiles for the confidence interval
//   const lowerBound = quantile(means, alpha / 2); // 2.5th percentile
//   const upperBound = quantile(means, 1 - alpha / 2); // 97.5th percentile

//   return {
//     ciMean: mean(means), // Bootstrap mean (could be slightly different from original mean)
//     lowerBound: lowerBound,
//     upperBound: upperBound,
//   };
// };

// /**
//  * Computes the lower and upper bound for an error bar to display in a Plotly plot.
//  * @param samples The samples to compute the error bar for
//  * @param scaleBy A value to scale the outputs by
//  * @param overFunc The default function is mean. However, we might want to calculate CI over other values, such as sum or SD. In this case, we must use bootstrapping, since the t-stat standard error method doesn't work in these cases.
//  * @returns The [lowerBound, upperBound] values as a 2-item array, normalized to 100%.
//  */
// const computeErrorBar = (
//   samples: number[],
//   scaleBy?: number,
//   overFunc?: (ns: number[]) => number,
// ) => {
//   // FUTURE: Implement a more reliable method for computing error bars
//   if (samples.length < 2) return [0, 0]; // Not enough information
//   const scalar = scaleBy ?? 1.0;

//   // Choose method depending on # of samples
//   // NOTE: The cutoff here is informed by research of Zhu & Kolassa (https://doi.org/10.1080/03610918.2017.1348516)
//   //       which shows that below sample size 50, t-test provides a more reliable predictor of actual CI than bootstrapping methods.
//   if (samples.length < 50 && !overFunc) {
//     // Fallback to standard error-based confidence interval using t-stat
//     const se = standardDeviation(samples) / Math.sqrt(samples.length); // Compute standard Error
//     const t_value = (jStat as any).studentt.inv(
//       1 - (1 - 0.95) / 2,
//       samples.length - 1,
//     ); // 95% CI (assuming normality)
//     const m = mean(samples);
//     console.warn("Error bar t-stat:", m, se, t_value);
//     return [(m - t_value * se) * scalar, (m + t_value * se) * scalar];
//   } else {
//     // Compute a bootstrap 95% CI (confidence interval).
//     //  NOTE: We use bootstrapping because with prompts, we can *never* assume
//     //  the sample of LLM outputs is representative of the population for the user's hypothesis.
//     //  LLM outputs also don't have to follow a normal distribution.
//     //  This is resource-intensive but a much more reliable approx. than standard error/dev.
//     const { ciMean, lowerBound, upperBound } = bootstrapCI(
//       samples,
//       1000,
//       0.05,
//       overFunc,
//     );
//     console.warn("Error bar 95% CI:", ciMean, lowerBound, upperBound);
//     return [(ciMean - lowerBound) * scalar, (upperBound - ciMean) * scalar];
//   }
// };

const castEvalScoreToNum = (score: EvaluationScore): number => {
  if (typeof score === "number") return score;
  else if (typeof score === "boolean") return score === true ? 1 : 0;
  else return 0; // unknown, soft fail
};

const findEvalResKeys = (resps: LLMResponse[]): Set<string> => {
  const eval_res_keys = new Set<string>();
  resps.forEach((resp_obj) => {
    if (resp_obj.eval_res && resp_obj.eval_res.items) {
      resp_obj.eval_res.items.forEach((item) => {
        if (typeof item === "object") {
          Object.keys(item).forEach((k) => eval_res_keys.add(k));
        } else {
          // If the item is not an object, we can assume it's a single value
          eval_res_keys.add("score");
        }
      });
    }
  });
  return eval_res_keys;
};

/**
 *  UTIL FUNCTIONS FOR VIS PLOTS
 */

const smallTextStyle: React.CSSProperties = {
  fontSize: "13px",
  margin: "6pt 3pt 0 3pt",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

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
  return calcMaxCharsPerLine(shortnames) * 7.3;
};

interface VisNodeData {
  vars: { value: string; label: string }[];
  selected_vars: string[] | string;
  llm_groups?: { value: string; label: string }[];
  selected_llm_group?: string;
  eval_res_vars?: string[];
  selected_eval_res_var?: string;
  input: string;
  refresh: boolean;
  title: string;
  // A plot the AI made, shown instead of the default plot until the user goes back
  aiPlot?: AIPlot | null;
  /** Show statistics from evalstats under the plot (local ChainForge only). */
  show_stats?: boolean;
}

/** The statistics to compute for the plot currently shown. */
interface StatsRequest {
  key: string;
  rows: EvalStatsRow[];
  itemLabels: Dict<string>;
  /** The Vis Node keys of the groupings compared: "LLM", a var, or `__meta_<name>`. */
  factorKeys: string[];
  asPercent: boolean;
  /** Why this plot can't have statistics, in place of rows to compare. */
  unsupported?: string;
}

/**
 * Confidence intervals drawn over a plot, as diamonds at the mean with
 * whiskers, one per group. `names` and `shortnames` are the plot's own, so
 * each interval lands on its group's row.
 */
const ciOverlayTrace = (
  names: Iterable<string>,
  shortnames: Dict<string>,
  entityByName: Dict<EvalStatsEntity>,
  scale: number,
  alpha: number,
  colorScheme: string,
): Dict => {
  const x: number[] = [];
  const y: string[] = [];
  const plus: number[] = [];
  const minus: number[] = [];
  const bounds: number[][] = [];
  for (const name of names) {
    const e = entityByName[name];
    if (!e || e.mean === null || e.ci_low === null || e.ci_high === null)
      continue;
    x.push(e.mean * scale);
    y.push(shortnames[name]);
    plus.push((e.ci_high - e.mean) * scale);
    minus.push((e.mean - e.ci_low) * scale);
    bounds.push([e.ci_low * scale, e.ci_high * scale]);
  }
  const ink = colorScheme === "light" ? "#222" : "#eee";
  const fmt = scale === 100 ? ":.1f" : ":.3g";
  const ciPct = Math.round((1 - alpha) * 100);
  return {
    type: "scatter",
    mode: "markers",
    // Horizontal, so that in grouped plots it can sit beside its bar or box.
    orientation: "h",
    x,
    y,
    customdata: bounds,
    marker: { symbol: "diamond", size: 7, color: ink },
    error_x: {
      type: "data",
      symmetric: false,
      array: plus,
      arrayminus: minus,
      color: ink,
      thickness: 1.5,
      width: 4,
    },
    hovertemplate: `mean %{x${fmt}} [%{customdata[0]${fmt}}, %{customdata[1]${fmt}}]<extra>${ciPct}% CI</extra>`,
    showlegend: false,
  };
};

/**
 * Graph types to choose between, for data that can be shown either way.
 * Defined once, so a graph type keeps its identity across renders.
 */
const GRAPH_OPTIONS = [
  { key: "bar", label: "Bar Chart", icon: <IconChartBar size={18} /> },
  {
    key: "box",
    label: "Box & Whiskers",
    icon: <IconChartHistogram size={18} />,
  },
];

/**
 * VIS VIEW COMPONENT
 * The inner part of the Vis Node.
 */
export interface VisViewProps {
  responses: LLMResponse[];
  wideFormat?: boolean;
  id?: string;
  data?: VisNodeData;
  whenReplotting?: (isReplotting: boolean) => void;
  /** Show statistics from evalstats under the plot, when the backend has it. */
  showStats?: boolean;
}
export interface VisViewRef {
  resetControls: (responses: LLMResponse[]) => void;
}

/**
 * Inner component for code evaluators/processors, storing the body of the UI (outside of the header and footers).
 */
export const VisView = forwardRef<VisViewRef, VisViewProps>(
  function VisViewComponent(
    { responses, id, data, whenReplotting, wideFormat, showStats },
    ref,
  ) {
    // Color scheme
    const { colorScheme } = useMantineColorScheme();

    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const getColorForLLMAndSetIfNotFound = useStore(
      (state) => state.getColorForLLMAndSetIfNotFound,
    );

    const plotDivRef = useRef<HTMLDivElement | null>(null);
    const plotlyRef = useRef<Plot>(null);
    const [plotlySpec, setPlotlySpec] = useState<Dict[]>([]);
    const [plotlyLayout, setPlotlyLayout] = useState({});

    // So updating the plot doesn't block the UI
    const [isPlotRerenderPending, startTransition] = useTransition();

    // For some data types, there are multiple graph options available...
    const [graphType, setGraphType] = useState(GRAPH_OPTIONS[0]);
    // Called while replotting, to force the graph type some data needs. The
    // replot runs again when the graph type changes, so this must leave state
    // alone when that type is already selected; otherwise the plot redraws in
    // an endless loop (hundreds of times a second).
    const setForcedGraphType = (key: string) => {
      const nextGraphType =
        GRAPH_OPTIONS.find((o) => o.key === key) ?? GRAPH_OPTIONS[0];
      setGraphType((prev) =>
        prev.key === nextGraphType.key ? prev : nextGraphType,
      );
      return nextGraphType;
    };
    const [disableGraphTypeOption, setDisableGraphTypeOption] = useState(false);

    const [placeholderText, setPlaceholderText] = useState(<></>);

    const [plotLegend, setPlotLegend] = useState<React.ReactNode>(null);
    const [selectedLegendItems] = useState<string[] | null>(null);

    // The MultiSelect so people can dynamically set what vars they care about
    const [multiSelectVars, setMultiSelectVars] = useState(data?.vars ?? []);
    const [multiSelectValue, setMultiSelectValue] = useState(
      data && Array.isArray(data.selected_vars) && data.selected_vars.length > 0
        ? data.selected_vars[0]
        : "LLM (default)",
    );

    // The x-axis, which are the names of eval results (if a dictionary)
    const [evalResVars, setEvalResVars] = useState<string[]>(
      data?.eval_res_vars ?? ["score"],
    );
    const [selectedEvalResVar, setSelectedEvalResVar] = useState(
      data?.selected_eval_res_var ?? "score",
    );
    const handleChangeSelectedEvalResVar = useCallback(
      (new_val: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedEvalResVar(new_val.target.value);
        if (id)
          setDataPropsForNode(id, {
            selected_eval_res_var: new_val.target.value,
          });
      },
      [id, setDataPropsForNode],
    );

    // Typically, a user will only need the default LLM 'group' --all LLMs in responses.
    // However, when prompts are chained together, the original LLM info is stored in metavars as a key.
    // LLM groups allow you to plot against the original LLMs, even though a 'scorer' LLM might come after.
    const [availableLLMGroups, setAvailableLLMGroups] = useState(
      data?.llm_groups ?? [{ value: "LLM", label: "LLM" }],
    );
    const [selectedLLMGroup, setSelectedLLMGroup] = useState(
      data?.selected_llm_group ?? "LLM",
    );
    const handleChangeLLMGroup = useCallback(
      (new_val: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedLLMGroup(new_val.target.value);
        if (id)
          setDataPropsForNode(id, { selected_llm_group: new_val.target.value });
      },
      [id, setDataPropsForNode],
    );

    // Statistics from evalstats, when ChainForge runs locally with the [stats] extra.
    const getColorForLLM = useStore((state) => state.getColorForLLM);
    const [statsAvailable, setStatsAvailable] = useState(false);
    useEffect(() => {
      isEvalStatsAvailable().then(setStatsAvailable);
    }, []);
    // What to compute for the current plot, set while replotting. It is only
    // replaced when its key changes, so replotting the same data doesn't refetch.
    const [statsRequest, setStatsRequest] = useState<StatsRequest | null>(null);
    const [statsResponse, setStatsResponse] = useState<{
      key: string;
      result?: EvalStatsResult;
      error?: string;
    } | null>(null);
    useEffect(() => {
      if (!statsRequest || statsRequest.unsupported) return;
      const { key, rows, itemLabels } = statsRequest;
      let cancelled = false;
      // Wait for settings to stop changing before asking the backend.
      const timer = setTimeout(() => {
        compareEvalStats(rows, itemLabels)
          .then((result) => {
            if (!cancelled) setStatsResponse({ key, result });
          })
          .catch((err: Error) => {
            if (!cancelled) setStatsResponse({ key, error: err.message });
          });
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [statsRequest]);

    // When the user clicks an item in the drop-down,
    // we want to autoclose the multiselect drop-down:
    const multiSelectRef = useRef<HTMLSelectElement>(null);
    const handleMultiSelectValueChange = (
      new_val: React.ChangeEvent<HTMLSelectElement>,
    ) => {
      if (multiSelectRef?.current) {
        multiSelectRef.current.blur();
      }
      // setStatus(Status.LOADING);
      setMultiSelectValue(new_val.target.value);
      if (id)
        setDataPropsForNode(id, { selected_vars: [new_val.target.value] });
    };

    // Call this to reset the dropdowns and options for the user when the response format changes
    const resetControls = (resps: LLMResponse[]) => {
      if (resps.length === 0) return;

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

      // Find all keys in eval results
      const eval_res_keys = findEvalResKeys(resps);
      if (eval_res_keys.size === 0) {
        eval_res_keys.add("score"); // default to 'score' if no keys found
      } else if (selectedEvalResVar === "score") {
        // We need to set the default eval res var to the first one in the list
        setSelectedEvalResVar(eval_res_keys.values().next().value as string);
      }

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

      // Find all the special metavars and vars and put them in the 'group by' dropdown:
      const available_llm_groups = [{ value: "LLM", label: "LLM" }]
        .concat(varnames.map((name) => ({ value: name, label: name })))
        .concat(
          metavars.filter(cleanMetavarsFilterFunc).map((name) => {
            return {
              value: `__meta_${name}`,
              label: `${name} (meta)`,
            };
          }),
        );
      if (available_llm_groups.some((g) => g.value.startsWith("__meta_llm_")))
        available_llm_groups[0] = { value: "LLM", label: "LLMs (last)" };
      setAvailableLLMGroups(available_llm_groups);

      // Check for a change in available parameters
      if (
        !multiSelectVars ||
        !multiSelectValue ||
        !evalResVars ||
        !areSetsEqual(
          new Set(msvars.map((o) => o.value)),
          new Set(multiSelectVars.map((o) => o.value)),
        ) ||
        !areSetsEqual(new Set(evalResVars), eval_res_keys)
      ) {
        setMultiSelectValue("LLM (default)");
        setMultiSelectVars(msvars);
        setEvalResVars(Array.from(eval_res_keys));
        if (id)
          setDataPropsForNode(id, {
            vars: msvars,
            selected_vars: [],
            llm_groups: available_llm_groups,
            eval_res_vars: Array.from(eval_res_keys),
          });
      }
    };

    // On init, run resetControls
    useEffect(() => {
      resetControls(responses);
    }, []);

    const castData = (v: LLMResponseData) =>
      typeof v === "string" || typeof v === "number"
        ? StringLookup.get(v) ?? "(unknown lookup error)"
        : v.d;

    // Define functions accessible from the parent component
    useImperativeHandle(ref, () => ({
      resetControls,
    }));

    // Pending transitions display loading spinner
    useEffect(() => {
      if (!whenReplotting) return;
      whenReplotting(isPlotRerenderPending);
    }, [isPlotRerenderPending]);

    // Re-plot responses when any responses or settings change
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
              fontSize: "13px",
            }}
          >
            To plot evaluation results, you need to run LLM responses through an
            Evaluator Node or LLM Scorer Node first.
          </p>,
        );
        setStatsRequest(null);
        return;
      }

      startTransition(() => {
        const normalizeGroupBucket = (value: unknown): string => {
          if (value === undefined || value === null) return "(missing)";
          return llmResponseDataToString(value as LLMResponseData).trim();
        };

        const get_llm = (resp_obj: LLMResponse) => {
          if (selectedLLMGroup === "LLM") {
            if (
              typeof resp_obj.llm === "string" ||
              typeof resp_obj.llm === "number"
            ) {
              return StringLookup.get(resp_obj.llm) ?? String(resp_obj.llm);
            }
            return normalizeGroupBucket(resp_obj.llm?.name);
          } else if (selectedLLMGroup?.startsWith("__meta_")) {
            const meta_key = selectedLLMGroup.slice("__meta_".length);
            return normalizeGroupBucket(resp_obj.metavars?.[meta_key]);
          } else {
            return normalizeGroupBucket(resp_obj.vars[selectedLLMGroup]);
          }
        };
        const getLLMsInResponses = (responses: LLMResponse[]) =>
          getUniqueKeysInResponses(responses, get_llm);

        // Get all LLMs in responses, by selected LLM group
        const llm_names = getLLMsInResponses(responses);

        // Create Plotly spec here
        const varnames =
          multiSelectValue !== "LLM (default)" && multiSelectValue !== undefined
            ? [multiSelectValue]
            : [];
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
          yaxis: {
            showgrid: true,
            color: colorScheme === "light" ? "#444" : "#ddd",
          },
          // Make the plot background transparent
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          xaxis: {
            color: colorScheme === "light" ? "#444" : "#ddd",
          },
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

        let sel_typeof_eval_res = typeof_eval_res;
        if (typeof_eval_res.includes("KeyValue")) {
          const first_item = responses[0].eval_res?.items?.[0];
          if (typeof first_item === "object") {
            const val = first_item[selectedEvalResVar];
            if (typeof val === "boolean") {
              sel_typeof_eval_res = "Boolean";
            } else if (typeof val === "number") {
              sel_typeof_eval_res = "Numeric";
            } else if (typeof val === "string") {
              sel_typeof_eval_res = "Categorical";
            }
          }
        }

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
          if (is_all_bools) {
            typeof_eval_res = "Boolean";
            sel_typeof_eval_res = "Boolean";
            setDisableGraphTypeOption(true);
          }
        } else {
          setDisableGraphTypeOption(false);
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

        const plot_legend: React.ReactNode | null = null;
        let metric_axes_labels: string[] = [];
        if (
          typeof_eval_res.includes("KeyValue") &&
          responses.some((r) => r.eval_res !== undefined)
        ) {
          metric_axes_labels = Array.from(findEvalResKeys(responses));
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
          return llmResponseDataToString(v);
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
                (item as Dict<boolean | number | string>)[selectedEvalResVar],
            );
          return eval_res_obj.items;
        };

        // Statistics: what the plot below compares, and evalstats' results for
        // it once they arrive (drawn over plots of single groupings).
        let stats_entities: Dict<EvalStatsEntity> | undefined;
        let stats_alpha = 0.05;
        if (showStats && statsAvailable) {
          const llm_factor: EvalStatsFactor = {
            key: selectedLLMGroup,
            valueOf: get_llm,
          };
          let stats_factors: EvalStatsFactor[] = [];
          let unsupported: string | undefined;
          if (
            sel_typeof_eval_res !== "Boolean" &&
            sel_typeof_eval_res !== "Numeric"
          )
            unsupported = "Statistics need numeric or true/false scores.";
          else if (varnames.length === 0) stats_factors = [llm_factor];
          else if (varnames.length === 1) {
            const var_factor: EvalStatsFactor = {
              key: varnames[0],
              valueOf: (r) => get_var_and_trim(r, varnames[0], true),
            };
            stats_factors =
              llm_names.length === 1 || selectedLLMGroup === varnames[0]
                ? [var_factor]
                : [llm_factor, var_factor];
          } else
            unsupported =
              "Statistics aren't available for plots of two variables.";

          let request: StatsRequest;
          if (unsupported)
            request = {
              key: unsupported,
              rows: [],
              itemLabels: {},
              factorKeys: [],
              asPercent: false,
              unsupported,
            };
          else {
            const { rows, itemLabels } = buildEvalStatsRows(
              responses,
              stats_factors,
              (r) => get_items(r.eval_res).map(toStatsScore),
            );
            const factorKeys = stats_factors.map((f) => f.key);
            request = {
              key: JSON.stringify([factorKeys, rows]),
              rows,
              itemLabels,
              factorKeys,
              asPercent: sel_typeof_eval_res === "Boolean",
            };
          }
          setStatsRequest((prev) =>
            prev?.key === request.key ? prev : request,
          );

          const result =
            statsResponse?.key === request.key
              ? statsResponse.result
              : undefined;
          if (result?.ok) {
            stats_alpha = result.alpha;
            // By group, or by [group, value of the variable] when comparing both.
            const by_name: Dict<EvalStatsEntity> = {};
            result.entities.forEach((e) => {
              const key =
                request.factorKeys.length === 1
                  ? e.group
                  : JSON.stringify([e.group, e.group2]);
              by_name[key] = e;
            });
            stats_entities = by_name;
          }
        } else setStatsRequest(null);

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
          // const error_values: number[][] = [];
          for (const name of names) {
            // Add a shortened version of the name as the y-tick
            y_items.push(shortnames[name]);

            // Calculate the number of true values over the total possible number
            let num_true_vals = 0;
            let num_eval_scores = 0;
            const all_samples: number[] = [];
            for (const r of responses) {
              if (resp_to_x(r) !== name) continue;
              const items = get_items(r.eval_res);
              Array.prototype.push.apply(
                all_samples,
                items.map((i) => (i === true ? 1 : 0)),
              ); // extend the `all_samples` array
              num_eval_scores += items.length;
              num_true_vals += items.filter((res) => res === true).length;
            }
            if (num_eval_scores > 0)
              x_items.push(num_true_vals * (100 / num_eval_scores));

            // Compute error bar info
            // error_values.push(computeErrorBar(all_samples, 100));

            // Lookup the color per LLM when displaying LLM differences,
            // otherwise use the palette for displaying variables.
            const color =
              group_type === "llm"
                ? getColorForLLMAndSetIfNotFound(name)
                : getColorForLLMAndSetIfNotFound(get_llm(responses[0]));
            marker_colors.push(color);
          }

          // Set the left margin to fit the yticks labels
          layout.margin.l = calcLeftPaddingForYLabels(
            Object.values(shortnames),
          );

          spec = [
            {
              type: "bar",
              y: y_items,
              x: x_items,
              marker: {
                color: marker_colors,
              },
              // error_x: {
              //   type: "data",
              //   // Asymmetric errors bars, since we're using bootstrapping to determine the 95% CI
              //   array: error_values.map((e) => e[1]), // Upper bound
              //   arrayminus: error_values.map((e) => e[0]), // Lower bound
              //   visible: true,
              // },
              hovertemplate: "%{x:.2f}%<extra>%{y}</extra>",
              showtrace: false,
              orientation: "h",
            },
          ];
          if (stats_entities) {
            spec.push(
              ciOverlayTrace(
                names,
                shortnames,
                stats_entities,
                100,
                stats_alpha,
                colorScheme,
              ),
            );
            // A second trace would otherwise bring up Plotly's legend.
            layout.showlegend = false;
          }
          layout.xaxis = {
            range: [0, 100],
            tickmode: "linear",
            tick0: 0,
            dtick: 10,
            ...layout.xaxis,
          };

          setForcedGraphType("bar"); // bar chart

          if (metric_axes_labels.length > 0)
            layout.xaxis = {
              title: { font: { size: 12 }, text: selectedEvalResVar },
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
            group_type === "var" && sel_typeof_eval_res === "Categorical";

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
          const yLabelShortnames = genUniqueShortnames(
            new Set(responses.map(resp_to_x)),
          );
          for (const name of names) {
            let x_items: EvaluationScore[] = [];
            let text_items: string[] = [];

            if (plotting_categorical_vars) {
              responses.forEach((r) => {
                // Get all evaluation results for this response which match the category 'name':
                const eval_res = get_items(r.eval_res).filter(
                  (i) => i === name,
                );
                const rawLabel = resp_to_x(r);
                const yLabel = yLabelShortnames[rawLabel] ?? rawLabel;
                x_items = x_items.concat(
                  new Array(eval_res.length).fill(yLabel),
                );
              });
            } else {
              responses.forEach((r) => {
                if (resp_to_x(r) !== name) return;
                x_items = x_items.concat(get_items(r.eval_res));
                text_items = text_items.concat(
                  createHoverTexts(r.responses.map(castData)),
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
              sel_typeof_eval_res === "Boolean" ||
              sel_typeof_eval_res === "Categorical"
            ) {
              // Plot a histogram for categorical or boolean data.
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
              // Plot bar or boxplots for all other cases.
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
                setForcedGraphType("bar");
              } else {
                // If multiple eval results per response object (num generations per prompt n > 1),
                // let user decide:
                if (graphType.key === "bar") {
                  d.type = "histogram";
                  d.histfunc = "sum";
                  d.y = new Array(x_items.length).fill(shortnames[name]);
                  d.textposition = "none"; // hide the text which appears within each bar
                  const xaxis_title =
                    metric_axes_labels.length > 0
                      ? "Sum of '" + selectedEvalResVar + "'"
                      : "Sum of scores";
                  layout.xaxis = {
                    title: { font: { size: 12 }, text: xaxis_title },
                    ...layout.xaxis,
                  };

                  // Compute error bars if present
                  // const error_values = [
                  //   computeErrorBar(x_items.map(castEvalScoreToNum), 1.0, sum),
                  // ];
                  // if (error_values.length > 0)
                  //   d.error_x = {
                  //     type: "data",
                  //     // Asymmetric errors bars, since we're using bootstrapping to determine the 95% CI
                  //     array: error_values.map((e) => e[1]), // Upper bound
                  //     arrayminus: error_values.map((e) => e[0]), // Lower bound
                  //     visible: true,
                  //   };
                } else {
                  // Box-and-whiskers plot
                  d.type = "box";
                  d.boxpoints = "all";
                }
              }

              spec.push(d);
            }
          }
          // Intervals of the mean only fit box plots here; bars show sums.
          if (
            stats_entities &&
            !plotting_categorical_vars &&
            spec.length > 0 &&
            spec.every((trace: Dict) => trace.type === "box")
          ) {
            // Boxes mark medians; also mark the means the intervals are around.
            spec.forEach((trace: Dict) => {
              trace.boxmean = true;
            });
            spec.push(
              ciOverlayTrace(
                names,
                shortnames,
                stats_entities,
                1,
                stats_alpha,
                colorScheme,
              ),
            );
          }
          layout.hovermode = "closest";
          layout.showlegend = false;

          // Set the left margin to fit the yticks labels
          layout.margin.l = calcLeftPaddingForYLabels(
            Object.values(shortnames),
          );

          if (metric_axes_labels.length > 0)
            layout.xaxis = {
              title: { font: { size: 12 }, text: selectedEvalResVar },
              ...layout.xaxis,
            };
        };

        const plot_grouped_boxplot = (
          resp_to_x: (r: LLMResponse) => string,
        ) => {
          // Get all possible values of the single variable response ('name' vals)
          const names = new Set(responses.map(resp_to_x));
          const shortnames = genUniqueShortnames(names);

          llm_names.forEach((llm) => {
            // Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
            const rs = responses_by_llm[llm];

            let x_items: EvaluationScore[] = [];
            let y_items: EvaluationScore[] = [];
            // let x_items_by_shortname: { [key: string]: [] } = {};
            let text_items: string[] = [];
            for (const name of names) {
              rs.forEach((r) => {
                if (resp_to_x(r) !== name) return;
                const items = get_items(r.eval_res);
                x_items = x_items.concat(items).flat();
                text_items = text_items
                  .concat(createHoverTexts(r.responses.map(castData)))
                  .flat();
                y_items = y_items
                  .concat(Array(items.length).fill(shortnames[name]))
                  .flat();
              });
            }

            if (sel_typeof_eval_res === "Boolean") {
              // Percent true for each value of the variable, one bar per group
              // side by side (not stacked), so each bar can carry its own
              // confidence interval.
              const bar_x: number[] = [];
              const bar_y: string[] = [];
              for (const name of names) {
                const vals = x_items.filter(
                  (_, idx) => y_items[idx] === shortnames[name],
                );
                if (vals.length === 0) continue;
                bar_y.push(shortnames[name]);
                bar_x.push(
                  (100 * vals.filter((v) => v === true).length) / vals.length,
                );
              }
              spec.push({
                type: "bar",
                name: llm,
                offsetgroup: llm,
                marker: { color: getColorForLLMAndSetIfNotFound(llm) },
                x: bar_x,
                y: bar_y,
                orientation: "h",
                hovertemplate: "%{x:.1f}%<extra>%{fullData.name}</extra>",
              });
              layout.barmode = "group";
              layout.xaxis = {
                title: { font: { size: 12 }, text: "% percent true" },
                range: [0, 100],
                ...layout.xaxis,
              };
              setForcedGraphType("bar");
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
              // if (max_num_results_per_prompt === 1) {
              let xaxis_title = "score";
              if (graphType.key === "bar") {
                d.type = "bar";
                d.textposition = "none"; // hide the text which appears within each bar
                xaxis_title =
                  metric_axes_labels.length > 0
                    ? "Sum of '" + selectedEvalResVar + "'"
                    : "Sum of scores";

                if (sel_typeof_eval_res === "Numeric") {
                  // To make error bars work, we need to sum the numbers, instead of relying
                  // upon the stacked bar chart:
                  let sum_x_items: number[] = [];
                  // let error_bars: number[][] = [];
                  const seq_y_items = [];
                  for (const name of Object.values(shortnames)) {
                    seq_y_items.push(name);
                    const xs_for_y = x_items
                      .filter((_, idx) => y_items[idx] === name)
                      .map(castEvalScoreToNum);
                    sum_x_items = sum_x_items.concat(sum(xs_for_y));
                    // error_bars = error_bars.concat([
                    //   computeErrorBar(xs_for_y, 1.0, sum),
                    // ]);
                  }
                  d.x = sum_x_items;
                  d.y = seq_y_items;
                  d.hovertemplate = llm;
                  delete d.text;

                  // Add error bars to plot
                  // d.error_x = {
                  //   type: "data",
                  //   // Asymmetric errors bars, since we're using bootstrapping to determine the 95% CI
                  //   array: error_bars.map((e) => e[1]), // Upper bound
                  //   arrayminus: error_bars.map((e) => e[0]), // Lower bound
                  //   visible: true,
                  // };
                }
              } else {
                // Box-and-whiskers plot
                d.type = "box";
                d.offsetgroup = llm;
              }

              spec.push(d);
              layout.xaxis = {
                title: { font: { size: 12 }, text: xaxis_title },
                ...layout.xaxis,
              };
            }
          });
          // Confidence intervals for each group and value, beside their bars
          // (percent true) or boxes. Bars of sums have none.
          if (
            stats_entities &&
            (sel_typeof_eval_res === "Boolean" ||
              spec.every((trace: Dict) => trace.type === "box"))
          ) {
            const entities = stats_entities;
            const scale = sel_typeof_eval_res === "Boolean" ? 100 : 1;
            llm_names.forEach((llm) => {
              const by_name: Dict<EvalStatsEntity> = {};
              for (const name of names) {
                const e = entities[JSON.stringify([llm, name])];
                if (e) by_name[name] = e;
              }
              spec.push({
                ...ciOverlayTrace(
                  names,
                  shortnames,
                  by_name,
                  scale,
                  stats_alpha,
                  colorScheme,
                ),
                offsetgroup: llm,
              });
            });
            // Boxes mark medians; also mark the means the intervals are around.
            spec.forEach((trace: Dict) => {
              if (trace.type === "box") trace.boxmean = true;
            });
            layout.scattermode = "group";
          }
          layout.boxmode = "group";
          layout.bargap = 0.5;

          // Set the left margin to fit the yticks labels
          layout.margin.l = calcLeftPaddingForYLabels(
            Object.values(shortnames),
          );

          if (metric_axes_labels.length > 0)
            layout.xaxis = {
              title: { font: { size: 12 }, text: selectedEvalResVar },
              ...layout.xaxis,
            };
        };

        // PARALLEL COORDINATES PLOT -- Disabled for now.
        // May be re-enabled in the future.
        // if (num_metrics > 1) {
        //   // For 2 or more metrics, display a parallel coordinates plot.
        //   // :: For instance, if evaluator produces { height: 32, weight: 120 } plot responses with 2 metrics, 'height' and 'weight'
        //   if (varnames.length === 1) {
        //     const unique_vals = getUniqueKeysInResponses(
        //       responses,
        //       (resp_obj) => get_var(resp_obj, varnames[0]),
        //     );
        //     // const response_txts = responses.map(res_obj => res_obj.responses).flat();

        //     const group_colors = varcolors;
        //     const unselected_line_color = "#ddd";
        //     const spec_colors = responses
        //       .map((resp_obj) => {
        //         const idx = unique_vals.indexOf(get_var(resp_obj, varnames[0]));
        //         return resp_obj.eval_res
        //           ? Array(resp_obj.eval_res.items.length).fill(idx)
        //           : [];
        //       })
        //       .flat();

        //     const colorscale: [number, string][] = [];
        //     for (let i = 0; i < unique_vals.length; i++) {
        //       if (
        //         !selectedLegendItems ||
        //         selectedLegendItems.indexOf(unique_vals[i]) > -1
        //       )
        //         colorscale.push([
        //           i / (unique_vals.length - 1),
        //           group_colors[i % group_colors.length],
        //         ]);
        //       else
        //         colorscale.push([
        //           i / (unique_vals.length - 1),
        //           unselected_line_color,
        //         ]);
        //     }

        //     const dimensions: Dict = [];
        //     metric_axes_labels.forEach((metric) => {
        //       const evals = extractEvalResultsForMetric(metric, responses);
        //       dimensions.push({
        //         range: evals.every((e) => typeof e === "number")
        //           ? [
        //               Math.min(...(evals as number[])),
        //               Math.max(...(evals as number[])),
        //             ]
        //           : undefined,
        //         label: metric,
        //         values: evals,
        //       });
        //     });

        //     spec.push({
        //       type: "parcoords",
        //       pad: [10, 10, 10, 10],
        //       line: {
        //         color: spec_colors,
        //         colorscale,
        //       },
        //       dimensions,
        //     });
        //     layout.margin = { l: 40, r: 40, b: 40, t: 50, pad: 0 };
        //     layout.paper_bgcolor = "white";
        //     layout.font = { color: "black" };
        //     layout.selectedpoints = [];

        //     // There's no built-in legend for parallel coords, unfortunately, so we need to construct our own:
        //     const legend_labels: Dict<string> = {};
        //     unique_vals.forEach((v, idx) => {
        //       if (!selectedLegendItems || selectedLegendItems.indexOf(v) > -1)
        //         legend_labels[v] = group_colors[idx % group_colors.length];
        //       else legend_labels[v] = unselected_line_color;
        //     });
        //     const onClickLegendItem = (label: string) => {
        //       if (
        //         selectedLegendItems &&
        //         selectedLegendItems.length === 1 &&
        //         selectedLegendItems[0] === label
        //       )
        //         setSelectedLegendItems(null); // Clicking twice on a legend item deselects it and displays all
        //       else setSelectedLegendItems([label]);
        //     };
        //     plot_legend = (
        //       <PlotLegend
        //         labels={legend_labels}
        //         onClickLabel={onClickLegendItem}
        //       />
        //     );

        //     // Tried to support Plotly hover events here, but looks like
        //     // currently there are unsupported for parcoords: https://github.com/plotly/plotly.js/issues/3012
        //     // onHover = (e) => {
        //     //     console.log(e.curveNumber);
        //     //     // const curveIdx = e.curveNumber;
        //     //     // if (curveIdx < response_txts.length) {
        //     //     //     if (!selectedLegendItems || selectedLegendItems.indexOf(unique_vals[spec_colors[curveIdx]]) > -1)
        //     //     //         console.log(response_txts[curveIdx]);
        //     //     // }
        //     // };
        //   } else {
        //     setSelectedLegendItems(null);
        //     const error_text =
        //       "Plotting evaluations with more than one metric and more than one prompt parameter is currently unsupported.";
        //     setPlaceholderText(
        //       <p
        //         style={{
        //           maxWidth: "220px",
        //           backgroundColor: "#f0aaaa",
        //           padding: "10px",
        //           fontSize: "13px",
        //         }}
        //       >
        //         {error_text}
        //       </p>,
        //     );
        //     console.error(error_text);
        //   }
        // } else {

        // A single metric --use plots like grouped box-and-whiskers, 3d scatterplot
        if (varnames.length === 0) {
          // No variables means they used a single prompt (no template) to generate responses
          // (Users are likely evaluating differences in responses between LLMs)
          if (sel_typeof_eval_res === "Boolean") plot_accuracy(get_llm, "llm");
          else plot_simple_boxplot(get_llm, "llm");
        } else if (varnames.length === 1) {
          // 1 var; numeric eval
          if (llm_names.length === 1) {
            if (sel_typeof_eval_res === "Boolean")
              // Accuracy plot per value of the selected variable:
              plot_accuracy((r) => get_var_and_trim(r, varnames[0]), "var");
            else {
              // Simple box plot, as there is only a single LLM in the response
              plot_simple_boxplot(
                (r) => get_var_and_trim(r, varnames[0]),
                "var",
              );
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

        if (!Array.isArray(spec)) spec = [spec];

        // Plotly derives grid lines from the axis color, which in dark mode
        // makes them bright enough to crowd out the data. Keep them faint.
        if (colorScheme !== "light") {
          layout.xaxis = {
            gridcolor: "rgba(255, 255, 255, 0.1)",
            zerolinecolor: "rgba(255, 255, 255, 0.25)",
            ...layout.xaxis,
          };
          layout.yaxis = {
            gridcolor: "rgba(255, 255, 255, 0.1)",
            zerolinecolor: "rgba(255, 255, 255, 0.25)",
            ...layout.yaxis,
          };
        }

        setPlotLegend(plot_legend);
        setPlotlySpec(spec as Dict[]);
        setPlotlyLayout(layout);
      });

      // if (plotDivRef && plotDivRef.current) {
      //     plotDivRef.current.style.width = '300px';
      // }
    }, [
      multiSelectVars,
      multiSelectValue,
      evalResVars,
      selectedEvalResVar,
      selectedLLMGroup,
      responses,
      selectedLegendItems,
      plotDivRef,
      // By key, so only a real change of graph type replots.
      graphType.key,
      colorScheme,
      showStats,
      statsAvailable,
      statsResponse,
    ]);

    // Resize the plot when the div around it is resized (e.g. with the resize
    // handle). One observer for the div's lifetime, which resizes the plot only
    // when the div's size actually changed, and never while the plot is empty
    // or hidden (Plotly throws "Resize must be passed a displayed plot div").
    // Previously a new observer was added on every replot and never removed.
    const plotlySpecRef = useRef(plotlySpec);
    plotlySpecRef.current = plotlySpec;
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const setPlotDivRef = useCallback((elem: HTMLDivElement | null) => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      plotDivRef.current = elem;
      if (!elem || !window.ResizeObserver) return;

      let lastSize = "";
      const observer = new window.ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        const size = `${Math.round(width)}x${Math.round(height)}`;
        if (size === lastSize) return;
        lastSize = size;
        // The plot's div (react-plotly's `el`), resized only while displayed.
        const gd = (plotlyRef.current as unknown as { el?: HTMLElement } | null)
          ?.el;
        if (
          !gd ||
          plotlySpecRef.current.length === 0 ||
          elem.offsetWidth === 0 ||
          gd.offsetParent === null
        )
          return;
        Promise.resolve(Plotly.Plots.resize(gd)).catch(() => undefined);
      });
      observer.observe(elem);
      resizeObserverRef.current = observer;
    }, []);
    useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            margin: wideFormat ? "6pt 0 6pt 0" : undefined,
          }}
        >
          <div style={{ display: "inline-flex", maxWidth: "50%" }}>
            <span style={smallTextStyle}>y-axis:</span>
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
            <span style={smallTextStyle}>x-axis:</span>
            <NativeSelect
              className="nodrag nowheel"
              data={evalResVars}
              size="xs"
              value={selectedEvalResVar}
              onChange={handleChangeSelectedEvalResVar}
              miw="80px"
            />
          </div>
          {availableLLMGroups && availableLLMGroups.length > 1 ? (
            <div
              style={{
                display: "inline-flex",
                justifyContent: "space-evenly",
                maxWidth: "30%",
                marginLeft: "10pt",
              }}
            >
              <span style={smallTextStyle}>group by:</span>
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
          ) : (
            <></>
          )}
          <div
            style={{
              display: "inline-flex",
              justifyContent: "end",
              maxWidth: "30%",
              marginLeft: "10pt",
            }}
          >
            <Menu
              shadow="md"
              width={200}
              withArrow
              disabled={disableGraphTypeOption}
            >
              <Menu.Target>
                <Button
                  variant="outline"
                  size="xs"
                  color="gray"
                  leftIcon={graphType.icon}
                  disabled={disableGraphTypeOption}
                >
                  {graphType.label}
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                {GRAPH_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.key}
                    icon={option.icon}
                    onClick={() => setGraphType(option)}
                  >
                    {option.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </div>
        </div>
        {!wideFormat && <hr />}
        <div
          className="nodrag"
          ref={setPlotDivRef}
          style={{
            minWidth: "150px",
            minHeight: "100px",
            position: "relative",
          }}
        >
          {plotlySpec && plotlySpec.length > 0 ? <></> : placeholderText}
          <Plot
            ref={plotlyRef}
            data={plotlySpec}
            layout={plotlyLayout}
            // Not react-plotly's window resize handler: it resizes plots even
            // while hidden (e.g. in a closed inspector), which Plotly rejects.
            // The ResizeObserver above resizes the plot instead.
            useResizeHandler={false}
            className="plotly-vis"
            style={{
              display: plotlySpec && plotlySpec.length > 0 ? "block" : "none",
              // border: wideFormat ? "1px solid #bbb" : "none",
              // paddingBottom: wideFormat ? "6pt" : "0",
            }}
          />
          {plotLegend ?? <></>}
          <ResizeHandle targetRef={plotDivRef} minWidth={150} minHeight={100} />
        </div>
        {statsAvailable && showStats && (
          <VisStatsPanel
            // While new statistics load, the last ones stay up (marked updating).
            result={statsResponse?.result}
            loading={
              !!statsRequest &&
              !statsRequest.unsupported &&
              statsResponse?.key !== statsRequest.key
            }
            error={
              statsRequest && statsResponse?.key === statsRequest.key
                ? statsResponse.error
                : undefined
            }
            unsupported={statsRequest?.unsupported}
            asPercent={statsRequest?.asPercent ?? false}
            nameOf={(e) => {
              const factors = statsResponse?.result?.ok
                ? statsResponse.result.factors
                : ["group" as const];
              return factors.map((f) => e[f] ?? "").join(" · ");
            }}
            colorOf={
              // LLMs (or whatever the plot groups by) have colors in the plot.
              statsRequest?.factorKeys[0] === selectedLLMGroup
                ? (e) => getColorForLLM(e.group)
                : undefined
            }
            colorScheme={colorScheme}
          />
        )}
      </>
    );
  },
);

/**
 * VIS NODE
 */
export interface VisNodeProps {
  data: VisNodeData;
  id: string;
}

const VisNode: React.FC<VisNodeProps> = ({ data, id }) => {
  // The core plotting/graph view, as a separate component
  const visViewRef = useRef<VisViewRef | null>(null);

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const aiSupport = useStore((state) => state.globalSettings.aiSupport);

  const [status, setStatus] = useState<Status>(Status.NONE);
  const [pastInputs, setPastInputs] = useState<JSONCompatible>([]);
  const [responses, setResponses] = useState<LLMResponse[]>([]);

  // Statistics are switched on from the header, when the backend has evalstats.
  const [statsAvailable, setStatsAvailable] = useState(false);
  useEffect(() => {
    isEvalStatsAvailable().then(setStatsAvailable);
  }, []);

  // On load of vis view
  // const setVisViewRef = useCallback((elem: VisViewRef) => {
  //   if (elem && !visViewRef.current) {
  //     visViewRef.current = elem;
  //     elem.resetControls(responses);
  //   }
  // }, [responses]);

  const handleOnConnect = useCallback(() => {
    // Grab the input node ids
    const input_node_ids = [data.input];

    grabResponses(input_node_ids)
      .then(function (resps) {
        if (resps && resps.length > 0) {
          // Store responses and extract + store vars
          // toReversed exists, but TypeScript does not see it.
          setResponses((resps as any).toReversed());

          visViewRef?.current?.resetControls(resps);
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

  return (
    <BaseNode classNames="vis-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Vis Node"}
        nodeId={id}
        status={status}
        icon={"📊"}
        customButtons={[
          ...(data.aiPlot?.code
            ? [
                <AIPlotHeaderButtons
                  key="ai-plot-buttons"
                  plot={data.aiPlot}
                  onCodeChange={(code) =>
                    setDataPropsForNode(id, {
                      aiPlot: { ...data.aiPlot, code } as unknown as Dict,
                    })
                  }
                  onBack={() => setDataPropsForNode(id, { aiPlot: null })}
                />,
              ]
            : []),
          ...(aiSupport
            ? [
                <AIGenPlotPopover
                  key="ai-popover"
                  responses={responses}
                  onPlotReady={(aiPlot) =>
                    setDataPropsForNode(id, {
                      aiPlot: aiPlot as unknown as Dict,
                    })
                  }
                />,
              ]
            : []),
          ...(statsAvailable
            ? [
                <Switch
                  key="stats"
                  size="xs"
                  label="Stats"
                  title="Confidence intervals and significance tests, from evalstats"
                  checked={data.show_stats ?? false}
                  onChange={(event) =>
                    setDataPropsForNode(id, {
                      show_stats: event.currentTarget.checked,
                    })
                  }
                  className="nodrag"
                  styles={{
                    root: {
                      display: "inline-flex",
                      alignItems: "center",
                      marginRight: 6,
                    },
                    label: { paddingLeft: 4, fontSize: "9pt" },
                  }}
                />,
              ]
            : []),
        ]}
      />
      {data.aiPlot?.code && (
        <AIPlotView plot={data.aiPlot} responses={responses} />
      )}
      {/* Kept mounted, so its controls keep their state while an AI plot shows */}
      <div style={{ display: data.aiPlot?.code ? "none" : undefined }}>
        <VisView
          ref={visViewRef}
          id={id}
          responses={responses}
          showStats={data.show_stats ?? false}
          data={data}
          whenReplotting={(isReplotting) =>
            setStatus(isReplotting ? Status.LOADING : Status.NONE)
          }
        />
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
