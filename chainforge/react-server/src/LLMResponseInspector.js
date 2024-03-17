/**
 * An inspector UI for examining LLM responses.
 *
 * Separated from ReactFlow node UI so that it can
 * be deployed in multiple locations.
 */
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  lazy,
  Suspense,
} from "react";
import {
  Collapse,
  MultiSelect,
  Table,
  NativeSelect,
  Checkbox,
  Flex,
  Tabs,
  ActionIcon,
  Tooltip,
  TextInput,
  Stack,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure, useToggle } from "@mantine/hooks";
import {
  IconTable,
  IconLayoutList,
  IconLetterCaseToggle,
  IconFilter,
  IconThumbUp,
} from "@tabler/icons-react";
import * as XLSX from "xlsx";
import useStore from "./store";
import {
  transformDict,
  truncStr,
  groupResponsesBy,
  batchResponsesByUID,
  cleanMetavarsFilterFunc,
} from "./backend/utils";
import { getLabelForResponse } from "./ResponseRatingToolbar";

// Lazy load the response toolbars
const ResponseRatingToolbar = lazy(() => import("./ResponseRatingToolbar.js"));

// Helper funcs
const countResponsesBy = (responses, keyFunc) => {
  const responses_by_key = {};
  const unspecified_group = [];
  responses.forEach((item, idx) => {
    const key = keyFunc(item);
    const d = key !== null ? responses_by_key : unspecified_group;
    if (key in d) d[key].push(idx);
    else d[key] = [idx];
  });
  return [responses_by_key, unspecified_group];
};
const getLLMName = (resp_obj) =>
  typeof resp_obj?.llm === "string" ? resp_obj.llm : resp_obj?.llm?.name;
const escapeRegExp = (txt) => txt.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

const SUCCESS_EVAL_SCORES = new Set(["true", "yes"]);
const FAILURE_EVAL_SCORES = new Set(["false", "no"]);
const getEvalResultStr = (eval_item, hide_prefix) => {
  if (Array.isArray(eval_item)) {
    return (hide_prefix ? "" : "scores: ") + eval_item.join(", ");
  } else if (typeof eval_item === "object") {
    const strs = Object.keys(eval_item).map((key) => {
      let val = eval_item[key];
      if (typeof val === "number" && val.toString().indexOf(".") > -1)
        val = val.toFixed(4); // truncate floats to 4 decimal places
      return <div><span>{key}: </span><span>{getEvalResultStr(val, true)}</span></div>;
    });
    return <Stack spacing={0}>{strs}</Stack>
  } else {
    const eval_str = eval_item.toString().trim().toLowerCase();
    const color = SUCCESS_EVAL_SCORES.has(eval_str)
      ? "black"
      : FAILURE_EVAL_SCORES.has(eval_str)
        ? "red"
        : "black";
    return (
      <>
        {!hide_prefix && <span style={{ color: "gray" }}>{"score: "}</span>}
        <span style={{ color }}>{eval_str}</span>
      </>
    );
  }
};

function getEvalResCols(responses) {
  // Look for + extract any consistent, *named* evaluation metrics (dicts)
  const metric_names = new Set();
  let has_unnamed_metric = false;
  let eval_res_cols = [];
  responses.forEach((res_obj) => {
    if (res_obj?.eval_res?.items === undefined) return;
    res_obj.eval_res.items.forEach((item) => {
      if (typeof item !== "object") {
        has_unnamed_metric = true;
        return;
      }
      Object.keys(item).forEach((metric_name) => metric_names.add(metric_name));
    });
  });

  if (metric_names.size === 0 || has_unnamed_metric)
    // None found, but there are scores, OR, there is at least one unnamed score. Add a generic col for scores:
    eval_res_cols.push("Score");

  if (metric_names.size > 0) {
    // Add a column for each named metric:
    eval_res_cols = eval_res_cols.concat(Array.from(metric_names));
  }

  return eval_res_cols;
}

function getIndicesOfSubstringMatches(s, substr, caseSensitive) {
  const regex = new RegExp(
    escapeRegExp(substr),
    "g" + (caseSensitive ? "" : "i"),
  );
  let result;
  const indices = [];
  while ((result = regex.exec(s))) indices.push(result.index);
  return indices;
}

// Splits a string by a substring or regex, but includes the delimiter (substring/regex match) elements in the returned array.
function splitAndIncludeDelimiter(s, substr, caseSensitive) {
  const indices = getIndicesOfSubstringMatches(s, substr, caseSensitive);
  if (indices.length === 0) return [s];

  const len_sub = substr.length;
  const results = [];
  let prev_idx = 0;
  indices.forEach((idx) => {
    const pre_delim = s.substring(prev_idx, idx);
    const delim = s.substring(idx, idx + len_sub);
    results.push(pre_delim);
    results.push(delim);
    prev_idx = idx + len_sub;
  });

  const end_str = s.substring(prev_idx);
  if (end_str.length > 0) results.push(end_str);

  return results;
}

// Returns an HTML version of text where 'searchValue' is highlighted.
function genSpansForHighlightedValue(text, searchValue, caseSensitive) {
  // Split texts by searchValue and map to <span> and <mark> elements
  return splitAndIncludeDelimiter(text, searchValue, caseSensitive).map(
    (s, idx) => {
      if (idx % 2 === 0) return <span key={idx}>{s}</span>;
      else
        return (
          <mark key={`m${idx}`} className="highlight">
            {s}
          </mark>
        );
    },
  );
}

// Export the JSON responses to an excel file (downloads the file):
export const exportToExcel = (jsonResponses, filename) => {
  if (!filename) filename = "responses.xlsx";

  // Check that there are responses to export:
  if (
    !jsonResponses ||
    (Array.isArray(jsonResponses) && jsonResponses.length === 0)
  ) {
    console.warn(
      "No responses to export. Try connecting the inspector node to a prompt node or evaluator node.",
    );
    return;
  }

  // We can construct the data as an array of JSON dicts, with keys as header names:
  // NOTE: We need to 'unwind' responses in each batch, since each res_obj can have N>1 responses.
  //       We will store every response text on a single row, but keep track of batches by creating a batch ID number.
  const data = jsonResponses
    .map((res_obj, res_obj_idx) => {
      const llm = getLLMName(res_obj);
      const prompt = res_obj.prompt;
      const vars = res_obj.vars;
      const metavars = res_obj.metavars ?? {};
      const ratings = {
        grade: getLabelForResponse(res_obj.uid, "grade"),
        note: getLabelForResponse(res_obj.uid, "note"),
      };
      const eval_res_items = res_obj.eval_res ? res_obj.eval_res.items : null;
      return res_obj.responses.map((r, r_idx) => {
        const row = {
          LLM: llm,
          Prompt: prompt,
          Response: r,
          "Response Batch Id": res_obj.uid ?? res_obj_idx,
        };

        // Add columns for vars
        Object.entries(vars).forEach(([varname, val]) => {
          row[`Var: ${varname}`] = val;
        });

        // Add column(s) for human ratings, if present
        if (ratings) {
          Object.entries(ratings).forEach(([rating_key, label_map]) => {
            if (!label_map) return;
            if (r_idx in label_map && label_map[r_idx] !== undefined)
              row[`Human rating: ${rating_key}`] = label_map[r_idx];
          });
        }

        // Add column(s) for evaluation results, if present
        if (eval_res_items && eval_res_items.length > r_idx) {
          const item = eval_res_items[r_idx];
          if (Array.isArray(item)) {
            row["Eval result"] = item.join(", ");
          } else if (typeof item === "object") {
            Object.keys(item).forEach((key) => {
              row[`Eval result: ${key}`] = item[key];
            });
          } else row["Eval result"] = item;
        }

        // Add columns for metavars, if present
        Object.entries(metavars).forEach(([varname, val]) => {
          if (!cleanMetavarsFilterFunc(varname)) return; // skip llm group metavars
          row[`Metavar: ${varname}`] = val;
        });

        return row;
      });
    })
    .flat();

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
};

const ResponseGroup = ({
  header,
  responseBoxes,
  responseBoxesWrapperClass,
  displayStyle,
  defaultState,
}) => {
  const [opened, { toggle }] = useDisclosure(defaultState);

  return (
    <div>
      <div className="response-group-component-header" onClick={toggle}>
        {header}
      </div>
      <Collapse
        in={opened}
        transitionDuration={500}
        transitionTimingFunction="ease-in"
        animateOpacity={true}
      >
        <div
          className={responseBoxesWrapperClass}
          style={{ display: displayStyle, flexWrap: "wrap" }}
        >
          {responseBoxes}
        </div>
      </Collapse>
    </div>
  );
};

const LLMResponseInspector = ({ jsonResponses, wideFormat }) => {
  // Responses
  const [responses, setResponses] = useState([]);
  const [receivedResponsesOnce, setReceivedResponsesOnce] = useState(false);

  // The type of view to use to display responses. Can be either hierarchy or table.
  const [viewFormat, setViewFormat] = useState(
    wideFormat ? "table" : "hierarchy",
  );

  // The MultiSelect so people can dynamically set what vars they care about
  const [multiSelectVars, setMultiSelectVars] = useState([]);
  const [multiSelectValue, setMultiSelectValue] = useState([]);

  // Search bar functionality
  const [searchValue, setSearchValue] = useState("");
  const [caseSensitive, toggleCaseSensitivity] = useToggle([false, true]);
  const [filterBySearchValue, toggleFilterBySearchValue] = useToggle([
    true,
    false,
  ]);
  const [numMatches, setNumMatches] = useState(-1);

  // Count number of response texts wehenever jsonResponses changes
  const numResponses = useMemo(() => {
    if (
      jsonResponses &&
      Array.isArray(jsonResponses) &&
      jsonResponses.length > 0
    )
      return jsonResponses.reduce(
        (acc, resp_obj) => acc + resp_obj.responses.length,
        0,
      );
    else return 0;
  }, [jsonResponses]);

  // Regroup input responses by batch UID, whenever jsonResponses changes
  const batchedResponses = useMemo(
    () => (jsonResponses ? batchResponsesByUID(jsonResponses) : []),
    [jsonResponses],
  );

  // The var name to use for columns in the table view
  const [tableColVar, setTableColVar] = useState("$LLM");
  const [userSelectedTableCol, setUserSelectedTableCol] = useState(false);

  // State of the 'only show scores' toggle when eval results are present
  const [showEvalScoreOptions, setShowEvalScoreOptions] = useState(false);
  const [onlyShowScores, setOnlyShowScores] = useState(false);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );

  // Update the visualization whenever the jsonResponses or MultiSelect values change:
  const triggerRedraw = () => {
    if (
      !batchedResponses ||
      (Array.isArray(batchedResponses) && batchedResponses.length === 0)
    )
      return;

    // Find all vars in responses
    let found_vars = new Set();
    let found_metavars = new Set();
    let found_llms = new Set();
    batchedResponses.forEach((res_obj) => {
      Object.keys(res_obj.vars).forEach((v) => found_vars.add(v));
      Object.keys(res_obj.metavars).forEach((v) => found_metavars.add(v));
      found_llms.add(getLLMName(res_obj));
    });
    found_vars = Array.from(found_vars);
    found_metavars = Array.from(found_metavars).filter(cleanMetavarsFilterFunc);
    found_llms = Array.from(found_llms);

    // Whether there's some evaluation scores in the responses
    const contains_eval_res = batchedResponses.some(
      (res_obj) => res_obj.eval_res !== undefined,
    );
    const contains_multi_evals = contains_eval_res
      ? batchedResponses.some((res_obj) => {
          const items = res_obj.eval_res?.items;
          return items && items.length > 0 && typeof items[0] === "object";
        })
      : false;
    setShowEvalScoreOptions(contains_eval_res);

    // Set the variables accessible in the MultiSelect for 'group by'
    const msvars = found_vars
      .map((name) =>
        // We add a $ prefix to mark this as a prompt parameter, and so
        // in the future we can add special types of variables without name collisions
        ({ value: name, label: name }),
      )
      .concat({ value: "$LLM", label: "LLM" });
    if (contains_eval_res && viewFormat === "table")
      msvars.push({ value: "$EVAL_RES", label: "Eval results" });
    setMultiSelectVars(msvars);

    // If only one LLM is present, and user hasn't manually selected one to plot,
    // and there's more than one prompt variable as input, default to plotting the
    // eval scores, or the first found prompt variable as columns instead:
    if (
      viewFormat === "table" &&
      !userSelectedTableCol &&
      tableColVar === "$LLM"
    ) {
      if (
        contains_multi_evals ||
        (found_llms.length === 1 && contains_eval_res)
      ) {
        // Plot eval scores on columns
        setTableColVar("$EVAL_RES");
        return;
      } else if (found_llms.length === 1 && found_vars.length > 1) {
        setTableColVar(found_vars[0]);
        return; // useEffect will replot with the new values
      }
    }

    // If this is the first time receiving responses, set the multiSelectValue to whatever is the first:
    if (!receivedResponsesOnce) {
      setMultiSelectValue([msvars[0].value]);
      setReceivedResponsesOnce(true);
    } else if (
      multiSelectValue.some((name) => !msvars.some((o) => o.value === name))
    ) {
      // If the multi select vars changed and no longer includes the user's selected value,
      // erase every value that went away, then early exit because useEffect is going to immediately recall this function:
      setMultiSelectValue(
        multiSelectValue.filter((name) => msvars.some((o) => o.value === name)),
      );
      return; // useEffect will replot with the new values
    }

    // Regroup responses by batch ID
    let responses = batchedResponses;
    let numResponsesDisplayed = 0;
    const selected_vars = multiSelectValue;
    const empty_cell_text = searchValue.length > 0 ? "(no match)" : "(no data)";
    const search_regex = new RegExp(
      escapeRegExp(searchValue),
      caseSensitive ? "" : "i",
    );

    // Filter responses by search value, if user has searched
    if (searchValue.length > 0 && filterBySearchValue)
      responses = responses.filter((res_obj) =>
        res_obj.responses.some(search_regex.test.bind(search_regex)),
      );

    // Functions to associate a color to each LLM in responses
    const color_for_llm = (llm) => getColorForLLMAndSetIfNotFound(llm) + "99";
    const header_bg_colors = ["#e0f4fa", "#c0def9", "#a9c0f9", "#a6b2ea"];
    const response_box_colors = [
      "#eee",
      "#fff",
      "#eee",
      "#ddd",
      "#eee",
      "#ddd",
      "#eee",
    ];
    const rgroup_color = (depth) =>
      response_box_colors[depth % response_box_colors.length];

    const getHeaderBadge = (key, val, depth) => {
      if (val) {
        const s = truncStr(val.trim(), 1024);
        return (
          <div
            className="response-var-header"
            style={{
              backgroundColor:
                header_bg_colors[depth % header_bg_colors.length],
            }}
          >
            <span className="response-var-name">{key}&nbsp;=&nbsp;</span>
            <span className="response-var-value">{`"${s}"`}</span>
          </div>
        );
      } else {
        return (
          <div className="response-var-header">{`unspecified ${key}`}</div>
        );
      }
    };

    const generateResponseBoxes = (
      resps,
      eatenvars,
      fixed_width,
      hide_eval_scores,
    ) => {
      const hide_llm_name = eatenvars.includes("LLM");
      return resps.map((res_obj, res_idx) => {
        const eval_res_items =
          !hide_eval_scores && res_obj.eval_res ? res_obj.eval_res.items : null;

        // Bucket responses that have the same text, and sort by the
        // number of same responses so that the top div is the most prevalent response.
        let responses = res_obj.responses;

        // If user has searched for something, further filter the response texts by only those that contain the search term
        if (searchValue.length > 0) {
          const filtered_resps = responses.filter(
            search_regex.test.bind(search_regex),
          );
          numResponsesDisplayed += filtered_resps.length;
          if (filterBySearchValue) responses = filtered_resps;
        }

        // We need to keep track of the original evaluation result per response str:
        const resp_str_to_eval_res = {};
        if (eval_res_items)
          responses.forEach((r, idx) => {
            resp_str_to_eval_res[r] = eval_res_items[idx];
          });

        // Counts the responses with the same keys
        const same_resp_text_counts = countResponsesBy(responses, (r) => r)[0];
        const same_resp_keys = Object.keys(same_resp_text_counts).sort(
          (key1, key2) =>
            same_resp_text_counts[key2].length -
            same_resp_text_counts[key1].length,
        );

        const ps = same_resp_keys.map((r, idx) => {
          const origIdxs = same_resp_text_counts[r];
          const textToShow = searchValue
            ? genSpansForHighlightedValue(r, searchValue, caseSensitive)
            : r;
          return (
            <div key={idx}>
              <Flex justify="right" gap="xs" align="center">
                {!hide_llm_name &&
                idx === 0 &&
                same_resp_keys.length > 1 &&
                wideFormat === true ? (
                  <h1>{getLLMName(res_obj)}</h1>
                ) : (
                  <></>
                )}
                <Suspense>
                  <ResponseRatingToolbar
                    uid={res_obj.uid}
                    innerIdxs={origIdxs}
                    wideFormat={wideFormat}
                  />
                </Suspense>
                {!hide_llm_name &&
                idx === 0 &&
                (same_resp_keys.length === 1 || !wideFormat) ? (
                  <h1>{getLLMName(res_obj)}</h1>
                ) : (
                  <></>
                )}
              </Flex>
              {same_resp_text_counts[r].length > 1 ? (
                <span className="num-same-responses">
                  {same_resp_text_counts[r].length} times
                </span>
              ) : (
                <></>
              )}
              {eval_res_items ? (
                <p className="small-response-metrics">
                  {getEvalResultStr(resp_str_to_eval_res[r])}
                </p>
              ) : (
                <></>
              )}
              {contains_eval_res && onlyShowScores ? (
                <pre>{}</pre>
              ) : (
                <div className="small-response">{textToShow}</div>
              )}
            </div>
          );
        });

        // At the deepest level, there may still be some vars left over. We want to display these
        // as tags, too, so we need to display only the ones that weren't 'eaten' during the recursive call:
        // (e.g., the vars that weren't part of the initial 'varnames' list that form the groupings)
        const unused_vars = transformDict(
          res_obj.vars,
          (v) => !eatenvars.includes(v),
        );
        const var_tags = Object.keys(unused_vars).map((varname) => {
          const v = truncStr(unused_vars[varname].trim(), wideFormat ? 72 : 18);
          return (
            <div key={varname} className="response-var-inline">
              <span className="response-var-name">{varname}&nbsp;=&nbsp;</span>
              <span className="response-var-value">{v}</span>
            </div>
          );
        });
        return (
          <div
            key={"r" + res_idx}
            className="response-box"
            style={{
              backgroundColor: color_for_llm(getLLMName(res_obj)),
              width: `${fixed_width}%`,
            }}
          >
            <div className="response-var-inline-container">{var_tags}</div>
            {hide_llm_name ? (
              ps
            ) : (
              <div className="response-item-llm-name-wrapper">{ps}</div>
            )}
          </div>
        );
      });
    };

    // Generate a view of the responses based on the view format set by the user
    if (viewFormat === "table") {
      // Generate a table, with default columns for: input vars, LLMs queried
      // First get column names as input vars + LLMs:
      let var_cols, colnames, getColVal, found_sel_var_vals, eval_res_cols;
      let metavar_cols = []; // found_metavars; -- Disabling this functionality for now, since it is usually annoying.

      if (tableColVar === "$LLM") {
        var_cols = found_vars;
        getColVal = getLLMName;
        found_sel_var_vals = found_llms;
        colnames = var_cols.concat(metavar_cols).concat(found_llms);
      } else {
        metavar_cols = [];
        var_cols = found_vars
          .filter((v) => v !== tableColVar)
          .concat(found_llms.length > 1 ? ["LLM"] : []); // only add LLM column if num LLMs > 1
        getColVal = (r) => r.vars[tableColVar];
        colnames = var_cols;
        found_sel_var_vals = [];
      }

      // If the user wants to plot eval results in separate column, OR there's only a single LLM to show
      if (
        tableColVar === "$EVAL_RES"
      ) {
        // Plot evaluation results on separate column(s):
        eval_res_cols = getEvalResCols(responses);
        // if (tableColVar === "$EVAL_RES") {
        // This adds a column, "Response", abusing the way getColVal and found_sel_var_vals is used
        // below by making a dummy value (one giant group with all responses in it). We then
        // sort the responses by LLM, to give a nicer view.
        colnames = colnames.concat("Response", eval_res_cols);
        getColVal = () => "_";
        found_sel_var_vals = ["_"];
        responses.sort((a, b) => getLLMName(a).localeCompare(getLLMName(b)));
        // } else {
        //   colnames = colnames.concat(eval_res_cols);
        // }
      } else if (tableColVar !== "$LLM") {
        // Get the unique values for the selected variable
        found_sel_var_vals = Array.from(
          responses.reduce((acc, res_obj) => {
            acc.add(
              tableColVar in res_obj.vars
                ? res_obj.vars[tableColVar]
                : "(unspecified)",
            );
            return acc;
          }, new Set()),
        );
        colnames = colnames.concat(found_sel_var_vals);
      }

      const getVar = (r, v) => (v === "LLM" ? getLLMName(r) : r.vars[v]);

      // Then group responses by prompts. Each prompt will become a separate row of the table (will be treated as unique)
      const responses_by_prompt = groupResponsesBy(responses, (r) =>
        var_cols.map((v) => getVar(r, v)).join("|"),
      )[0];

      const rows = Object.entries(responses_by_prompt).map(
        // eslint-disable-next-line
        ([prompt, resp_objs], idx) => {
          // We assume here that prompt input vars will be the same across all responses in this bundle,
          // so we just take the value of the first one per each varname:
          const var_cols_vals = var_cols.map((v) => {
            const val =
              v === "LLM" ? getLLMName(resp_objs[0]) : resp_objs[0].vars[v];
            return val !== undefined ? val : "(unspecified)";
          });
          const metavar_cols_vals = metavar_cols.map((v) => {
            const val = resp_objs[0].metavars[v];
            return val !== undefined ? val : "(unspecified)";
          });
          let eval_cols_vals = [];
          if (eval_res_cols && eval_res_cols.length > 0) {
            // We can assume that there's only one response object, since to
            // if eval_res_cols is set, there must be only one LLM.
            eval_cols_vals = eval_res_cols.map((metric_name, metric_idx) => {
              const items = resp_objs[0].eval_res?.items;
              if (!items) return "(no result)";
              return items.map((item) => {
                if (item === undefined) return "(undefined)";
                if (
                  typeof item !== "object" &&
                  metric_idx === 0 &&
                  metric_name === "Score"
                )
                  return getEvalResultStr(item, true);
                else if (metric_name in item)
                  return getEvalResultStr(item[metric_name], true);
                else return "(unspecified)";
              }); // treat n>1 resps per prompt as multi-line results in the column
            });
          }
          const resp_objs_by_col_var = groupResponsesBy(
            resp_objs,
            getColVal,
          )[0];
          const sel_var_cols = found_sel_var_vals.map((val, idx) => {
            if (val in resp_objs_by_col_var) {
              const rs = resp_objs_by_col_var[val];
              // Return response divs as response box here:
              return (
                <div key={idx}>
                  {generateResponseBoxes(
                    rs,
                    var_cols,
                    100,
                    eval_res_cols !== undefined,
                  )}
                </div>
              );
            } else {
              return <i key={idx}>{empty_cell_text}</i>;
            }
          });

          return (
            <tr key={`r${idx}`}>
              {var_cols_vals.map((c, i) => (
                <td key={`v${i}`} className="inspect-table-var">
                  <ScrollArea.Autosize mah={600}>
                  {c}
                  </ScrollArea.Autosize>
                </td>
              ))}
              {metavar_cols_vals.map((c, i) => (
                <td key={`m${i}`} className="inspect-table-metavar">
                  {c}
                </td>
              ))}
              {sel_var_cols.map((c, i) => (
                <td key={`c${i}`} className="inspect-table-llm-resp">
                  {c}
                </td>
              ))}
              {eval_cols_vals.map((c, i) => (
                <td key={`e${i}`} className="inspect-table-score-col">
                  <Stack spacing={0}>{c}</Stack>
                </td>
              ))}
            </tr>
          );
        },
      );

      setResponses([
        <Table
          key="table"
          fontSize={wideFormat ? "sm" : "xs"}
          horizontalSpacing="xs"
          verticalSpacing={0}
          striped
          withColumnBorders={true}
        >
          <thead>
            <tr>
              {colnames.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody style={{ verticalAlign: "top" }}>{rows}</tbody>
        </Table>,
      ]);
    } else if (viewFormat === "hierarchy") {
      // Now we need to perform groupings by each var in the selected vars list,
      // nesting the groupings (preferrably with custom divs) and sorting within
      // each group by value of that group's var (so all same values are clumped together).
      // :: For instance, for varnames = ['LLM', '$var1', '$var2'] we should get back
      // :: nested divs first grouped by LLM (first level), then by var1, then var2 (deepest level).
      let leaf_id = 0;
      let first_opened = false;
      const groupByVars = (resps, varnames, eatenvars, header) => {
        if (resps.length === 0) return [];
        if (varnames.length === 0) {
          // Base case. Display n response(s) to each single prompt, back-to-back:
          let fixed_width = 100;
          const side_by_side_resps = wideFormat;
          if (side_by_side_resps && eatenvars.length > 0) {
            const num_llms = Array.from(new Set(resps.map(getLLMName))).length;
            fixed_width = Math.max(20, Math.trunc(100 / num_llms)) - 1; // 20% width is lowest we will go (5 LLM response boxes max)
          }
          const resp_boxes = generateResponseBoxes(
            resps,
            eatenvars,
            fixed_width,
          );
          const className = eatenvars.length > 0 ? "response-group" : "";
          const boxesClassName =
            eatenvars.length > 0 ? "response-boxes-wrapper" : "";
          const flexbox =
            side_by_side_resps && fixed_width < 100 ? "flex" : "block";
          const defaultOpened =
            !first_opened ||
            eatenvars.length === 0 ||
            eatenvars[eatenvars.length - 1] === "LLM";
          first_opened = true;
          leaf_id += 1;
          return (
            <div
              key={"l" + leaf_id}
              className={className}
              style={{ backgroundColor: rgroup_color(eatenvars.length) }}
            >
              <ResponseGroup
                header={header}
                responseBoxes={resp_boxes}
                responseBoxesWrapperClass={boxesClassName}
                displayStyle={flexbox}
                defaultState={defaultOpened}
              />
            </div>
          );
        }

        // Bucket responses by the first var in the list, where
        // we also bucket any 'leftover' responses that didn't have the requested variable (a kind of 'soft fail')
        const group_name = varnames[0];
        const [grouped_resps, leftover_resps] =
          group_name === "LLM"
            ? groupResponsesBy(resps, getLLMName)
            : groupResponsesBy(resps, (r) =>
                group_name in r.vars ? r.vars[group_name] : null,
              );
        const get_header =
          group_name === "LLM"
            ? (key, val) => (
                <div
                  key={val}
                  style={{ backgroundColor: color_for_llm(val) }}
                  className="response-llm-header"
                >
                  {val}
                </div>
              )
            : (key, val) => getHeaderBadge(key, val, eatenvars.length);

        // Now produce nested divs corresponding to the groups
        const remaining_vars = varnames.slice(1);
        const updated_eatenvars = eatenvars.concat([group_name]);
        const defaultOpened =
          !first_opened ||
          eatenvars.length === 0 ||
          eatenvars[eatenvars.length - 1] === "LLM";
        const grouped_resps_divs = Object.keys(grouped_resps).map((g) =>
          groupByVars(
            grouped_resps[g],
            remaining_vars,
            updated_eatenvars,
            get_header(group_name, g),
          ),
        );
        const leftover_resps_divs =
          leftover_resps.length > 0
            ? groupByVars(
                leftover_resps,
                remaining_vars,
                updated_eatenvars,
                get_header(group_name, undefined),
              )
            : [];

        leaf_id += 1;

        return (
          <div key={"h" + group_name + "_" + leaf_id}>
            {header ? (
              <div
                key={group_name}
                className="response-group"
                style={{ backgroundColor: rgroup_color(eatenvars.length) }}
              >
                <ResponseGroup
                  header={header}
                  responseBoxes={grouped_resps_divs}
                  responseBoxesWrapperClass="response-boxes-wrapper"
                  displayStyle="block"
                  defaultState={defaultOpened}
                />
              </div>
            ) : (
              <div key={group_name}>{grouped_resps_divs}</div>
            )}
            {leftover_resps_divs.length === 0 ? (
              <></>
            ) : (
              <div key={"__unspecified_group"} className="response-group">
                {leftover_resps_divs}
              </div>
            )}
          </div>
        );
      };

      // Produce DIV elements grouped by selected vars
      const divs = groupByVars(responses, selected_vars, [], null);
      setResponses(divs);
    }

    setNumMatches(numResponsesDisplayed);
  };

  // Trigger a redraw of the inspector when any of the below changes:
  useEffect(triggerRedraw, [
    multiSelectValue,
    batchedResponses,
    wideFormat,
    viewFormat,
    tableColVar,
    onlyShowScores,
    searchValue,
    caseSensitive,
    filterBySearchValue,
  ]);

  // When the user clicks an item in the drop-down,
  // we want to autoclose the multiselect drop-down:
  const multiSelectRef = useRef(null);
  const handleMultiSelectValueChange = (new_val) => {
    if (multiSelectRef) {
      multiSelectRef.current.blur();
    }
    setMultiSelectValue(new_val);
  };

  const handleSearchValueChange = (content) => {
    setSearchValue(content.target.value);
  };

  const sz = useMemo(() => (wideFormat ? "sm" : "xs"), [wideFormat]);

  const searchBar = useMemo(
    () => (
      <Flex gap="6px" align="end" w="100%">
        <TextInput
          id="search_bar"
          label={
            "Find" +
            (searchValue.length > 0 ? ` (${numMatches}/${numResponses})` : "")
          }
          autoComplete="off"
          size={sz}
          placeholder={"Search keywords"}
          w="100%"
          value={searchValue}
          onChange={handleSearchValueChange}
        />
        <div>
          <Tooltip
            label={`Case sensitivity (${caseSensitive ? "on" : "off"})`}
            withArrow
            arrowPosition="center"
          >
            <ActionIcon
              variant={caseSensitive ? "filled" : "light"}
              size={sz}
              mb="4px"
              onClick={toggleCaseSensitivity}
            >
              <IconLetterCaseToggle />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={`Filter responses by term (${filterBySearchValue ? "on" : "off"})`}
            withArrow
            arrowPosition="center"
          >
            <ActionIcon
              variant={filterBySearchValue ? "filled" : "light"}
              size={sz}
              mb="2px"
              onClick={toggleFilterBySearchValue}
            >
              <IconFilter />
            </ActionIcon>
          </Tooltip>
        </div>
      </Flex>
    ),
    [
      handleSearchValueChange,
      caseSensitive,
      searchValue,
      filterBySearchValue,
      numResponses,
      numMatches,
      sz,
      toggleCaseSensitivity,
      toggleFilterBySearchValue,
    ],
  );

  return (
    <div style={{ height: "100%" }}>
      <Tabs
        value={viewFormat}
        onTabChange={setViewFormat}
        styles={{ tabLabel: { fontSize: wideFormat ? "12pt" : "9pt" } }}
      >
        <Tabs.List>
          <Tabs.Tab value="hierarchy">
            <IconLayoutList
              size="10pt"
              style={{ marginBottom: wideFormat ? "0px" : "-4px" }}
            />
            {wideFormat ? " Grouped List" : ""}
          </Tabs.Tab>
          <Tabs.Tab value="table">
            <IconTable
              size="10pt"
              style={{ marginBottom: wideFormat ? "0px" : "-4px" }}
            />
            {wideFormat ? " Table View" : ""}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="hierarchy" pt="xs">
          <Flex gap={sz} align="end" w="100%" mb={wideFormat ? "0px" : "xs"}>
            <MultiSelect
              ref={multiSelectRef}
              onChange={handleMultiSelectValueChange}
              className="nodrag nowheel"
              label={
                "Group responses by" + (wideFormat ? " (order matters):" : ":")
              }
              data={multiSelectVars}
              placeholder="Pick vars to group responses, in order of importance"
              size={sz}
              value={multiSelectValue}
              clearSearchOnChange={true}
              clearSearchOnBlur={true}
              w={wideFormat ? "50%" : "100%"}
            />
            {searchBar}
            <Checkbox
              checked={onlyShowScores}
              label="Only show scores"
              onChange={(e) => setOnlyShowScores(e.currentTarget.checked)}
              mb="xs"
              size={sz}
              display={showEvalScoreOptions ? "inherit" : "none"}
            />
          </Flex>
        </Tabs.Panel>
        <Tabs.Panel value="table" pt="xs">
          <Flex gap={sz} align="end" mb="sm">
            <NativeSelect
              value={tableColVar}
              onChange={(event) => {
                setTableColVar(event.currentTarget.value);
                setUserSelectedTableCol(true);
              }}
              data={multiSelectVars}
              label="Select main column variable:"
              size={sz}
              w={wideFormat ? "50%" : "100%"}
            />
            {searchBar}
            <Checkbox
              checked={onlyShowScores}
              label="Only show scores"
              onChange={(e) => setOnlyShowScores(e.currentTarget.checked)}
              mb="md"
              size={sz}
              display={showEvalScoreOptions ? "inherit" : "none"}
            />
          </Flex>
        </Tabs.Panel>
      </Tabs>

      <div className="nowheel nodrag">{responses}</div>
    </div>
  );
};

export default LLMResponseInspector;
