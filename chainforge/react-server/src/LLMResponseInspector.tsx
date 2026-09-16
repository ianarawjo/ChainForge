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
  useTransition,
} from "react";
import {
  MultiSelect,
  NativeSelect,
  Checkbox,
  Flex,
  Tabs,
  ActionIcon,
  Tooltip,
  TextInput,
  LoadingOverlay,
  Box,
  Text,
  useMantineColorScheme,
  type MantineTheme,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
  IconTable,
  IconLayoutList,
  IconLetterCaseToggle,
  IconFilter,
  IconChartBar,
  IconLayoutGrid,
} from "@tabler/icons-react";
import ResponseGridView, {
  COMPACT_SELECT_STYLES,
  ResponseLightbox,
} from "./ResponseGridView";
import { ScoreChips, TableResponseCell } from "./TableResponseCell";
import {
  collectGridItems,
  GridAccessors,
  GridItem,
  scoreMetrics,
} from "./backend/responseGrid";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  MRT_ShowHideColumnsButton,
  MRT_ToggleFiltersButton,
  MRT_ToggleDensePaddingButton,
} from "mantine-react-table";
import * as XLSX from "xlsx";
import useStore from "./store";
import {
  transformDict,
  truncStr,
  groupResponsesBy,
  batchResponsesByUID,
  cleanMetavarsFilterFunc,
  llmResponseDataToString,
  REASONING_METAVAR,
  reasoningAt,
  DebounceRef,
  genDebounceFunc,
  blobOrFileToDataURL,
  blobToBase64,
} from "./backend/utils";
import { MediaBox, ResponseGroup, getEvalResultStr } from "./ResponseBoxes";
import { getLabelForResponse } from "./ResponseRatingToolbar";
import {
  Dict,
  EvaluationScore,
  LLMResponse,
  LLMResponseData,
  TemplateVarInfo,
  isImageResponseData,
} from "./backend/typing";
import { MediaLookup, StringLookup } from "./backend/cache";
import { VisView } from "./VisNode";

// Helper funcs
const getLLMName = (resp_obj: LLMResponse) =>
  (typeof resp_obj?.llm === "string" || typeof resp_obj?.llm === "number"
    ? StringLookup.get(resp_obj.llm)
    : StringLookup.get(resp_obj?.llm?.name)) ?? "(string lookup failed)";
const escapeRegExp = (txt: string) =>
  txt.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

function getEvalResCols(responses: LLMResponse[]) {
  // Look for + extract any consistent, *named* evaluation metrics (dicts)
  const metric_names = new Set<string>();
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

function getIndicesOfSubstringMatches(
  s: string,
  substr: string,
  caseSensitive?: boolean,
) {
  const regex = new RegExp(
    escapeRegExp(substr),
    "g" + (caseSensitive ? "" : "i"),
  );
  let result: RegExpExecArray | null;
  const indices: number[] = [];
  while ((result = regex.exec(s))) indices.push(result.index);
  return indices;
}

// Splits a string by a substring or regex, but includes the delimiter (substring/regex match) elements in the returned array.
function splitAndIncludeDelimiter(
  s: string,
  substr: string,
  caseSensitive?: boolean,
) {
  const indices = getIndicesOfSubstringMatches(s, substr, caseSensitive);
  if (indices.length === 0) return [s];

  const len_sub = substr.length;
  const results: string[] = [];
  let prev_idx = 0;
  indices.forEach((idx: number) => {
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
function genSpansForHighlightedValue(
  text: string,
  searchValue: string,
  caseSensitive?: boolean,
) {
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

/** Excel cells hold at most 32,767 characters, so longer text (e.g. long reasoning) is cut short. */
const fitExcelCell = (text: string) =>
  text.length > 32767 ? text.slice(0, 32766) + "…" : text;

// Transform the JSON responses into a table
export const pulledInputsToTable = (data: string[] | TemplateVarInfo[]) => {
  // The data is the result of pullInputData. We need to transform it into a table.
  return data
    .map((info) => {
      console.log(info);
      if (typeof info === "string") return { text: info };
      const llm = getLLMName({ llm: info.llm } as LLMResponse);
      const prompt = StringLookup.get(info.prompt) ?? undefined;
      const vars = info.fill_history ?? {};
      const metavars = info.metavars ?? {};
      const row: Dict<string | number> = {};
      const uid =
        info.uid ??
        ("batch_id" in info ? (info.batch_id as string) : undefined);

      if (info.llm !== undefined) row.Method = llm;
      if (prompt !== undefined) row.Prompt = prompt;
      if (info.text !== undefined) {
        row[info.llm !== undefined ? "Response" : "text"] =
          llmResponseDataToString(info.text);
      }
      if (uid) row["Batch Id"] = uid;
      const reasoning = metavars[REASONING_METAVAR];
      if (reasoning !== undefined)
        row.Reasoning = fitExcelCell(llmResponseDataToString(reasoning));

      // Add columns for vars
      Object.entries(vars).forEach(([varname, val]) => {
        if (varname === undefined || varname.length === 0) return; // skip empty varnames
        row[varname] = llmResponseDataToString(val);
      });

      // Add columns for metavars, if present
      Object.entries(metavars).forEach(([varname, val]) => {
        if (varname === undefined || varname.length === 0) return; // skip empty varnames
        if (!cleanMetavarsFilterFunc(varname)) return; // skip llm group metavars
        row[varname] = llmResponseDataToString(val);
      });

      // Add column for images, if present
      if (info.image !== undefined) {
        row[info.llm !== undefined ? "Image Response" : "image"] =
          llmResponseDataToString(info.image);
      }

      return row;
    })
    .flat();
};

export const responsesToTable = async (
  jsonResponses: LLMResponse[],
  wrapVars?: boolean,
) => {
  const _resp_to_string = async (resp: LLMResponseData) => {
    if (isImageResponseData(resp)) {
      // TODO: Find out a way to export images to excel.
      // NOTE: base64 does not work because of the text size limit in excel.
      //       We get the error: "Text length must not exceed 32767 characters"
      return `media/${resp.d}`;
      // const blob = await MediaLookup.get(resp.d);
      // if (blob === undefined) return undefined;
      // return await blobOrFileToDataURL(blob);
    } else return llmResponseDataToString(resp);
  };

  const tableDataPromises = jsonResponses
    .map((res_obj, res_obj_idx) => {
      const llm = getLLMName(res_obj);
      const prompt = StringLookup.get(res_obj.prompt) ?? "";
      const vars = res_obj.vars;
      const metavars = res_obj.metavars ?? {};
      const ratings = {
        grade: getLabelForResponse(res_obj.uid, "grade"),
        note: getLabelForResponse(res_obj.uid, "note"),
      };
      const eval_res_items = res_obj.eval_res ? res_obj.eval_res.items : null;
      return res_obj.responses.map(async (r, r_idx) => {
        const row: Dict<string | number | boolean> = {
          Method: llm,
          Prompt: prompt,
          Response: (await _resp_to_string(r)) ?? "",
          "Batch Id": res_obj.uid ?? res_obj_idx,
        };
        const reasoning = reasoningAt(res_obj, r_idx);
        if (reasoning) row.Reasoning = fitExcelCell(reasoning);

        // Add columns for vars
        for (const [varname, val] of Object.entries(vars)) {
          row[wrapVars ? `Var: ${varname}` : varname] =
            (await _resp_to_string(val)) ?? "";
        }

        // Add column(s) for human ratings, if present
        if (ratings) {
          Object.entries(ratings).forEach(([rating_key, label_map]) => {
            if (!label_map) return;
            if (r_idx in label_map && label_map[r_idx] !== undefined) {
              const rating = label_map[r_idx];
              row[`Human rating: ${rating_key}`] =
                typeof rating === "boolean"
                  ? rating
                    ? "GOOD"
                    : "BAD"
                  : rating;
            }
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
        for (const [varname, val] of Object.entries(metavars)) {
          if (!cleanMetavarsFilterFunc(varname)) continue; // skip llm group metavars
          row[wrapVars ? `Metavar: ${varname}` : varname] =
            (await _resp_to_string(val)) ?? "";
        }

        return row;
      });
    })
    .flat();

  const tableData = await Promise.allSettled(tableDataPromises).then(
    (resolvedTableData) => {
      const filteredTableData = resolvedTableData.filter(
        (result) => result.status === "fulfilled",
      ) as PromiseFulfilledResult<any>[];
      return filteredTableData.map((result) => result.value);
    },
  );

  return tableData;
};

// Export the JSON responses to an excel file (downloads the file):
export const exportToExcel = (
  jsonResponses: LLMResponse[],
  filename?: string,
) => {
  if (filename === undefined) filename = "responses.xlsx";

  // Check that there are responses to export:
  if (
    !jsonResponses ||
    (Array.isArray(jsonResponses) && jsonResponses.length === 0)
  ) {
    throw new Error(
      "No responses to export. Try connecting the inspector node to a prompt node or evaluator node.",
    );
  }

  // We can construct the data as an array of JSON dicts, with keys as header names:
  // NOTE: We need to 'unwind' responses in each batch, since each res_obj can have N>1 responses.
  //       We will store every response text on a single row, but keep track of batches by creating a batch ID number.
  responsesToTable(jsonResponses, true)
    .then((data) => {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, filename as string);
    })
    .catch((e) => {
      console.error("Failed to export responses to Excel. Data corrupted?", e);
    });
};

export interface LLMResponseInspectorProps {
  jsonResponses: LLMResponse[];
  isOpen: boolean;
  wideFormat?: boolean;
  customLLMFieldName?: string;
  disableBackgroundColor?: boolean;
  treatLLMFieldAsUnique?: boolean;
  ignoreAndHideLLMField?: boolean; // If true, LLM field will not be shown in the table view
  ignoreAndHideEvalResField?: boolean; // If true, "Eval Res" column option will not be shown in the table view
  defaultTableColVar?: string;
  /**
   * The tab to open on, when the host remembers which one the user last chose.
   * Passing it also suppresses the automatic switch to "table" on multi-evals,
   * so a remembered choice is not overridden the moment responses arrive.
   */
  viewFormat?: string;
  /** Called when the user picks a different tab, so the host can save it. */
  onViewFormatChange?: (viewFormat: string) => void;
}

const LLMResponseInspector: React.FC<LLMResponseInspectorProps> = ({
  jsonResponses,
  isOpen,
  wideFormat,
  customLLMFieldName,
  disableBackgroundColor,
  treatLLMFieldAsUnique,
  ignoreAndHideLLMField,
  ignoreAndHideEvalResField,
  defaultTableColVar,
  viewFormat: rememberedViewFormat,
  onViewFormatChange,
}) => {
  // Responses
  const [responseDivs, setResponseDivs] = useState<React.ReactNode>([]);
  const [receivedResponsesOnce, setReceivedResponsesOnce] = useState(false);

  // Color scheme
  const { colorScheme } = useMantineColorScheme();

  // Debounce isOpen changes, to avoid blocking the UI
  const [isOpenDelayed, setIsOpenDelayed] = useState(false);
  useEffect(() => {
    setTimeout(() => {
      setIsOpenDelayed(isOpen);
    }, 300);
  }, [isOpen]);

  // The type of view to use to display responses. Can be either hierarchy or table.
  const [viewFormat, setViewFormat] = useState(
    rememberedViewFormat ?? (wideFormat ? "table" : "hierarchy"),
  );

  // The MultiSelect so people can dynamically set what vars they care about
  const [multiSelectVars, setMultiSelectVars] = useState<
    { value: string; label: string }[]
  >([]);
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>([]);

  // Search bar functionality
  const [searchValue, setSearchValue] = useState("");
  const [caseSensitive, toggleCaseSensitivity] = useToggle([false, true]);
  const [filterBySearchValue, toggleFilterBySearchValue] = useToggle([
    true,
    false,
  ]);

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

  // Table view data
  const [tableColumns, setTableColumns] = useState<MRT_ColumnDef<any>[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);
  // The variable columns stay on the left while scrolling sideways. Only in
  // the wide inspector: in a narrow one they would take all the room.
  const [tableColumnPinning, setTableColumnPinning] = useState<{
    left?: string[];
    right?: string[];
  }>({ left: [], right: [] });
  const table = useMantineReactTable({
    columns: tableColumns,
    data: tableRows,
    // Columns grow to share the available width; their sizes are minimums.
    layoutMode: "grid",
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    enableStickyHeader: true,
    enablePinning: wideFormat,
    state: { columnPinning: tableColumnPinning },
    onColumnPinningChange: setTableColumnPinning,
    initialState: {
      density: "md",
      pagination: { pageSize: wideFormat ? 50 : 20, pageIndex: 0 },
    },
    // The last column's resize handle pokes past the edge, which would make
    // the table scroll sideways a little. Clip (not hidden) keeps it from
    // becoming a scroll container, so pinned header cells still stick.
    mantineTableHeadRowProps: { style: { overflowX: "clip" } },
    mantineTableHeadCellProps: {
      style: {
        fontSize: wideFormat ? 13 : 12,
        padding: "6px 8px",
        alignItems: "end",
      },
    },
    renderToolbarInternalActions: ({ table }) => (
      <>
        {/* built-in buttons (must pass in table prop for them to work!) */}
        <MRT_ToggleFiltersButton table={table} />
        <MRT_ShowHideColumnsButton table={table} />
        <MRT_ToggleDensePaddingButton table={table} />
      </>
    ),
    renderTopToolbarCustomActions: () => (
      <Flex gap="sm" align="center" wrap="wrap">
        <Flex align="center" gap={6} wrap="nowrap">
          <Text size="xs" color="dimmed">
            Columns
          </Text>
          <NativeSelect
            aria-label="Columns"
            value={tableColVar}
            onChange={(event) => {
              setTableColVar(event.currentTarget.value);
              setUserSelectedTableCol(true);
            }}
            data={multiSelectVars}
            size="xs"
            styles={COMPACT_SELECT_STYLES}
            w={wideFormat ? 160 : 110}
          />
        </Flex>
        {tableSearchBar}
      </Flex>
    ),
  });

  // A larger view of a table response, opened by clicking it.
  const tableLightboxAccessors: GridAccessors = useMemo(
    () => ({
      modelOf: getLLMName,
      valueOf: (r, name) =>
        r.vars && name in r.vars
          ? llmResponseDataToString(r.vars[name])
          : undefined,
      textOf: llmResponseDataToString,
    }),
    [],
  );
  const [tableLightbox, setTableLightbox] = useState<{
    items: GridItem[];
    index: number;
  } | null>(null);
  const tableLightboxMetrics = useMemo(
    () => scoreMetrics(tableLightbox?.items ?? []),
    [tableLightbox?.items],
  );

  // The var name to use for columns in the table view
  const [tableColVar, setTableColVar] = useState(defaultTableColVar ?? "$LLM");
  const [userSelectedTableCol, setUserSelectedTableCol] = useState(false);

  // State of the 'only show scores' toggle when eval results are present
  const [showEvalScoreOptions, setShowEvalScoreOptions] = useState(false);
  const [onlyShowScores, setOnlyShowScores] = useState(false);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );

  // Debounce helpers
  const debounceTimeoutRef: DebounceRef = useRef(null);
  const debounce = genDebounceFunc(debounceTimeoutRef);

  // Offload intensive computation to redraw and avoid blocking UI
  const [isPending, startTransition] = useTransition();

  // Show loading spinner not every update, but only after a certain time has passed during loading.
  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);
  const [showLoadingSpinnerTimeout, setShowLoadingSpinnerTimeout] =
    useState<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isPending && !showLoadingSpinner) {
      if (showLoadingSpinnerTimeout) clearTimeout(showLoadingSpinnerTimeout);
      const timeout = setTimeout(() => setShowLoadingSpinner(true), 500); // Delay by 500ms
      setShowLoadingSpinnerTimeout(timeout);
    } else {
      if (showLoadingSpinnerTimeout) {
        clearTimeout(showLoadingSpinnerTimeout);
        setShowLoadingSpinnerTimeout(null);
      }
      setShowLoadingSpinner(false); // Hide immediately when isPending is false
    }
  }, [isPending]);

  // Update the visualization whenever the jsonResponses or MultiSelect values change:
  const triggerRedraw = () => {
    if (
      !batchedResponses ||
      (Array.isArray(batchedResponses) && batchedResponses.length === 0)
    )
      return;

    startTransition(() => {
      // Find all vars in responses
      let found_vars: Array<string> | Set<string> = new Set<string>();
      let found_metavars: Array<string> | Set<string> = new Set<string>();
      let found_llms: Array<string> | Set<string> = new Set<string>();
      batchedResponses.forEach((res_obj) => {
        Object.keys(res_obj.vars).forEach((v) =>
          (found_vars as Set<string>).add(v),
        );
        Object.keys(res_obj.metavars).forEach((v) =>
          (found_metavars as Set<string>).add(v),
        );
        (found_llms as Set<string>).add(getLLMName(res_obj));
      });
      found_vars = Array.from(found_vars);
      found_metavars = Array.from(found_metavars).filter(
        cleanMetavarsFilterFunc,
      );
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

      let effectiveTableColVar = tableColVar;

      if (
        ignoreAndHideLLMField &&
        !userSelectedTableCol &&
        tableColVar === "$LLM"
      ) {
        effectiveTableColVar = "retrievalMethod";
        setTableColVar("retrievalMethod");
      }

      // Set the variables accessible in the MultiSelect for 'group by'
      let msvars = found_vars
        .map((name: string) => {
          let label = name;
          if (name === "retrievalMethod") label = "Retrieval method";
          // We add a $ prefix to mark this as a prompt parameter, and so
          // in the future we can add special types of variables without name collisions
          return { value: name, label };
        })
        .concat({ value: "$LLM", label: customLLMFieldName || "LLM" });

      if (ignoreAndHideLLMField) {
        // If we are ignoring the LLM field, we need to remove it from the msvars
        msvars = msvars.filter((v) => v.value !== "$LLM");
      }

      if (
        contains_eval_res &&
        viewFormat === "table" &&
        !ignoreAndHideEvalResField
      )
        msvars.push({ value: "$EVAL_RES", label: "Scores" });

      setMultiSelectVars(msvars);

      // If only one LLM is present, and user hasn't manually selected one to plot,
      // and there's more than one prompt variable as input, default to plotting the
      // eval scores, or the first found prompt variable as columns instead:
      if (
        !ignoreAndHideEvalResField &&
        viewFormat === "table" &&
        !userSelectedTableCol &&
        effectiveTableColVar === "$LLM" &&
        (contains_multi_evals || (found_llms.length === 1 && contains_eval_res))
      ) {
        // Plot eval scores on columns
        setTableColVar("$EVAL_RES");
        return;
      }

      // If this is the first time receiving responses, set the multiSelectValue to whatever is the first:
      if (!receivedResponsesOnce) {
        if (contains_multi_evals && rememberedViewFormat === undefined)
          // If multiple evals are detected, default to "table" format --
          // unless the host handed us the tab the user last chose.
          setViewFormat("table");
        setMultiSelectValue([msvars[0].value]);
        setReceivedResponsesOnce(true);
      } else if (
        multiSelectValue.some((name) => !msvars.some((o) => o.value === name))
      ) {
        // If the multi select vars changed and no longer includes the user's selected value,
        // erase every value that went away, then early exit because useEffect is going to immediately recall this function:
        setMultiSelectValue(
          multiSelectValue.filter((name) =>
            msvars.some((o) => o.value === name),
          ),
        );
        return; // useEffect will replot with the new values
      }

      // Regroup responses by batch ID
      let responses = batchedResponses;
      // let numResponsesDisplayed = 0;
      const selected_vars = multiSelectValue;
      const empty_cell_text =
        searchValue.length > 0 ? "(no match)" : "(no data)";
      const search_regex = new RegExp(
        escapeRegExp(searchValue),
        caseSensitive ? "" : "i",
      );

      // Filter responses by search value, if user has searched
      if (searchValue.length > 0 && filterBySearchValue)
        responses = responses.filter((res_obj) =>
          res_obj.responses.some(
            (r) =>
              (typeof r === "string" || typeof r === "number") &&
              search_regex.test(StringLookup.get(r) ?? ""),
          ),
        );

      // Functions to associate a color to each LLM in responses
      const color_for_llm = disableBackgroundColor
        ? (c: string) => "transparent"
        : (llm: string) => getColorForLLMAndSetIfNotFound(llm) + "99";
      const header_bg_colors =
        colorScheme === "light"
          ? ["#e0f4fa", "#c0def9", "#a9c0f9", "#a6b2ea"]
          : ["#333", "#222", "#333", "#222"];
      const response_box_colors =
        colorScheme === "light"
          ? ["#eee", "#fff", "#eee", "#ddd", "#eee", "#ddd", "#eee"]
          : ["#222", "#111", "#222", "#111", "#222", "#111", "#222"];
      const rgroup_color = (depth: number) =>
        response_box_colors[depth % response_box_colors.length];

      const getHeaderBadge = (
        key: string,
        val: string | undefined,
        depth: number,
      ) => {
        if (val !== undefined) {
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

      // How responses are shown, searched and opened in full, in both the
      // Grouped List and the Table View.
      const highlightText = searchValue
        ? (txt: string) =>
            genSpansForHighlightedValue(txt, searchValue, caseSensitive)
        : undefined;
      const showText =
        searchValue.length > 0 && filterBySearchValue
          ? (txt: string) => search_regex.test(txt)
          : undefined;
      const responseItems = collectGridItems(responses, tableLightboxAccessors);
      const openResponse = (response: LLMResponse, index: number) => {
        const at = responseItems.findIndex(
          (item) => item.response === response && item.index === index,
        );
        if (at >= 0) setTableLightbox({ items: responseItems, index: at });
      };
      // Each response is colored by its model, as everywhere in ChainForge.
      // Looked up here, not while rendering, since a new model gets a color
      // assigned in the store.
      const llmColors: Dict<string> = {};
      (found_llms as string[]).forEach((llm) => {
        llmColors[llm] = getColorForLLMAndSetIfNotFound(llm);
      });
      const modelColorFor = disableBackgroundColor
        ? undefined
        : (r: LLMResponse) => llmColors[getLLMName(r)];

      // The Grouped List's responses, as cards like the Table View's, showing
      // their full text.
      const generateResponseBoxes = (
        resps: LLMResponse[],
        eatenvars: string[],
        fixed_width: number,
      ) => {
        // The group header already names the model when grouping by it.
        const hide_llm_name =
          eatenvars.includes("$LLM") || eatenvars.includes("LLM");
        return resps.map((res_obj, res_idx) => {
          // At the deepest level, there may still be some vars left over. We want to display these
          // as tags, too, so we need to display only the ones that weren't 'eaten' during the recursive call:
          // (e.g., the vars that weren't part of the initial 'varnames' list that form the groupings)
          const unused_vars = Object.fromEntries(
            Object.entries(
              transformDict(res_obj.vars, (v) => !eatenvars.includes(v)),
            ).map(([name, value]) => [
              name,
              truncStr(
                llmResponseDataToString(value).trim(),
                wideFormat ? 72 : 18,
              ) ?? "",
            ]),
          );
          return (
            <div
              key={"r" + res_idx}
              style={{
                width: `${fixed_width}%`,
                padding: "0 2px 4px",
                boxSizing: "border-box",
                // The same text size as the Table View's cards.
                fontSize: wideFormat ? 13 : 12,
                lineHeight: 1.4,
              }}
            >
              <TableResponseCell
                responses={[res_obj]}
                lines="none"
                onlyShowScores={contains_eval_res && onlyShowScores}
                showText={showText}
                renderText={highlightText}
                onOpen={openResponse}
                modelColorFor={modelColorFor}
                modelNameFor={hide_llm_name ? undefined : getLLMName}
                varsFor={() => unused_vars}
              />
            </div>
          );
        });
      };

      /* TABLE VIEW */
      // Generate a view of the responses based on the view format set by the user
      if (viewFormat === "table") {
        // Generate a table, with default columns for: input vars, LLMs queried
        // First get column names as input vars + LLMs:
        let var_cols: string[],
          colnames: string[],
          getColVal: (r: LLMResponse) => string | number | undefined,
          found_sel_var_vals: string[],
          eval_res_cols: string[];
        const metavar_cols: string[] = []; // found_metavars; -- Disabling this functionality for now, since it is usually annoying.
        if (effectiveTableColVar === "$LLM") {
          var_cols = found_vars;
          getColVal = getLLMName;
          found_sel_var_vals = found_llms;
          colnames = var_cols.concat(metavar_cols).concat(found_llms);
        } else {
          var_cols = found_vars
            .filter((v) => v !== effectiveTableColVar)
            .concat(found_llms.length > 1 ? ["LLM"] : []); // only add LLM column if num LLMs > 1
          getColVal = (r) =>
            llmResponseDataToString(r.vars[effectiveTableColVar]);
          colnames = metavar_cols.concat(var_cols);
          found_sel_var_vals = [];
        }

        // If the user wants to plot eval results in separate column, OR there's only a single LLM to show
        if (effectiveTableColVar === "$EVAL_RES") {
          // Plot evaluation results on separate column(s):
          eval_res_cols = getEvalResCols(responses);
          // if (effectiveTableColVar === "$EVAL_RES") {
          // This adds a column, "Response", abusing the way getColVal and found_sel_var_vals is used
          // below by making a dummy value (one giant group with all responses in it). We then
          // sort the responses by LLM, to give a nicer view.
          colnames = colnames.concat("Response", eval_res_cols);
          getColVal = () => "_";
          found_sel_var_vals = ["_"];
          responses.sort((a, b) => getLLMName(a).localeCompare(getLLMName(b)));
        } else if (effectiveTableColVar !== "$LLM") {
          // Get the unique values for the selected variable
          found_sel_var_vals = Array.from(
            responses.reduce((acc, res_obj) => {
              acc.add(
                effectiveTableColVar in res_obj.vars
                  ? llmResponseDataToString(res_obj.vars[effectiveTableColVar])
                  : "(unspecified)",
              );
              return acc;
            }, new Set<string>()),
          );
          colnames = colnames.concat(
            found_sel_var_vals.map(
              (v) => StringLookup.get(v) ?? "(string lookup failed)",
            ),
          );
        }

        const getVar = (r: LLMResponse, v: string) =>
          v === "LLM" ? getLLMName(r) : StringLookup.get(r.vars[v]) ?? "";

        // Then group responses by prompts. Each prompt will become a separate row of the table (will be treated as unique)
        if (ignoreAndHideLLMField) {
          // If we are ignoring the LLM field, we need to remove it from the var_cols
          var_cols = var_cols.filter((v) => v !== "LLM");
          // Also, we need to remove the LLM column from the colnames
          colnames = colnames.filter((c) => c !== "LLM");
        }

        const responses_by_prompt = groupResponsesBy(responses, (r) => {
          const group = var_cols
            .map((v) => getVar(r, v))
            .map(llmResponseDataToString)
            .join("|");
          if (
            treatLLMFieldAsUnique &&
            tableColVar === "$LLM" &&
            r.responses.length > 0
          )
            return group + "|" + llmResponseDataToString(r.responses[0]);
          else return group;
        })[0];

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
            let eval_cols_vals: [
              string | JSX.Element,
              string,
              string,
              EvaluationScore | undefined,
            ][][] = [];
            if (eval_res_cols && eval_res_cols.length > 0) {
              // We can assume that there's only one response object, since
              // if eval_res_cols is set, there must be only one LLM.
              eval_cols_vals = eval_res_cols.map((metric_name, metric_idx) => {
                const items = resp_objs[0].eval_res?.items;
                const uid = resp_objs[0].uid;
                if (!items)
                  return [["(no result)", "(no result)", uid, undefined]];
                return items.map((item) => {
                  if (item === undefined)
                    return ["(undefined)", "(undefined)", uid, item];
                  if (
                    typeof item !== "object" &&
                    metric_idx === 0 &&
                    metric_name === "Score"
                  )
                    return [...getEvalResultStr(item, true), uid, item] as [
                      string | JSX.Element,
                      string,
                      string,
                      EvaluationScore,
                    ];
                  else if (typeof item === "object" && metric_name in item)
                    return [
                      ...getEvalResultStr(item[metric_name], true),
                      uid,
                      item[metric_name],
                    ] as [
                      string | JSX.Element,
                      string,
                      string,
                      EvaluationScore,
                    ];
                  else return ["(unspecified)", "(unspecified)", uid, item];
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
                return rs;
                // return llmResponseDataToString(rs[0].responses[0]); // TODO: Fix
                // return (
                //   <div key={idx}>
                //     {generateResponseBoxes(
                //       rs,
                //       var_cols,
                //       100,
                //       eval_res_cols !== undefined,
                //     )}
                //   </div>
                // );
              } else {
                return empty_cell_text;
                // return <i key={idx}>{empty_cell_text}</i>;
              }
            });

            // const serializeLLMResponseData = async (
            //   val: LLMResponseData,
            // ): Promise<string | undefined> => {
            //   if (typeof val === "string" || typeof val === "number")
            //     return StringLookup.get(val) ?? "(string lookup failed)";
            //   else if (isImageResponseData(val)) {
            //     return await MediaLookup.getUrl(val.d);
            //   } else {
            //     return await MediaLookup.getAsText(val.d);
            //   }
            // }

            const row: Dict<
              | string
              | LLMResponseData
              | undefined
              | LLMResponse[]
              | LLMResponseData[]
              | {
                  type: "eval";
                  data: (
                    | string
                    | JSX.Element
                    | EvaluationScore
                    | undefined
                  )[][];
                }
            > = {};
            let vals_arr_start_idx = 0;
            var_cols_vals.forEach((v, i) => {
              row[`c${i}`] = v;
            });
            vals_arr_start_idx += var_cols_vals.length;
            metavar_cols_vals.forEach((v, i) => {
              row[`c${i + vals_arr_start_idx}`] = v;
            });
            vals_arr_start_idx += metavar_cols_vals.length;
            sel_var_cols.forEach((v, i) => {
              const isStr = typeof v === "string" || typeof v === "number";
              row[`c${i + vals_arr_start_idx}`] = isStr
                ? StringLookup.get(v)
                : v;
            });
            vals_arr_start_idx += sel_var_cols.length;
            eval_cols_vals.forEach((v, i) => {
              row[`c${i + vals_arr_start_idx}`] = {
                type: "eval",
                data: v,
              };
            });

            return row;
          },
        );

        // Smart estimates of col width sizes required
        const colAvgNumChars: Dict<number> = {};
        const colHasLLMResponses: Set<string> = new Set<string>();
        const numRows = rows.length;
        rows.forEach((row) => {
          Object.entries(row).forEach(([cname, val]) => {
            if (val === undefined || cname[0] === "o") return;
            if (!(cname in colAvgNumChars)) colAvgNumChars[cname] = 0;
            const hasLLMResps =
              !(typeof val === "string") && Array.isArray(val);
            if (hasLLMResps && !colHasLLMResponses.has(cname))
              colHasLLMResponses.add(cname);
            // Count the number of chars in the total text that will be displaced in this cell,
            // and add it to the count:
            let numChars = 0;
            if (hasLLMResps) {
              numChars = val
                .map((r) =>
                  (r as LLMResponse).responses
                    .map(llmResponseDataToString)
                    .join(""),
                )
                .join("").length;
            } else if (typeof val === "string" || typeof val === "number") {
              numChars = StringLookup.get(val)?.length ?? 0;
            } else if ("type" in val && val.type === "eval") {
              numChars = (val.data as (string | JSX.Element)[][])
                .map((e) => e[1])
                .join("").length;
            } else if (val !== undefined && "t" in val) {
              numChars = llmResponseDataToString(val).length;
            }
            colAvgNumChars[cname] += (numChars * 1.0) / numRows; // we apply the averaging here for speed
          });
        });

        // Table responses are clamped to a few lines.
        const tableLines = wideFormat ? 6 : 4;
        const cellPadding = (density: string) =>
          density === "xs" ? "3px 4px" : density === "xl" ? "12px" : "6px 8px";
        const numVarCols = var_cols.length + metavar_cols.length;
        // Model columns are marked with the model's color, in place of coloring
        // every response in them.
        const modelColors = colnames.map((c, i) =>
          effectiveTableColVar === "$LLM" &&
          i >= numVarCols &&
          !disableBackgroundColor
            ? getColorForLLMAndSetIfNotFound(c)
            : undefined,
        );

        const columns = colnames.map((c, i) => ({
          accessorKey: `c${i}`,
          accessorFn: (row) => {
            // Get the text for this row. Used when filtering or sorting.
            const val = row[`c${i}`];
            if (
              typeof val === "string" ||
              typeof val === "number" ||
              val === undefined
            )
              return StringLookup.get(val) ?? "";
            else if (typeof val === "object" && "t" in val) {
              // LLMResponseData -- image or doc
              return llmResponseDataToString(val); // doc
            } else if ("type" in val && val.type === "eval") {
              return (val.data as (string | JSX.Element)[][])
                .map((e) => e[1])
                .join("\n");
            } else
              return (val as LLMResponse[])
                .flatMap((r) => r.responses)
                .map(llmResponseDataToString)
                .join("");
          },
          header: c,
          // In the grid layout, a column's size is its minimum width; columns
          // grow from there to fill the table.
          size: colHasLLMResponses.has(`c${i}`)
            ? c === "Response" && eval_res_cols !== undefined
              ? wideFormat
                ? 280
                : 180
              : 150
            : i < numVarCols
              ? wideFormat
                ? Math.min(
                    Math.max(110, Math.ceil(colAvgNumChars[`c${i}`] ?? 50) * 2),
                    150,
                  )
                : 90
              : 80,
          Cell: ({ row }: { row: any }) => {
            const val = row.original[`c${i}`];
            if (typeof val === "string" || typeof val === "number") {
              const text = StringLookup.get(val) ?? "";
              return (
                <div
                  className="cf-table-var"
                  title={text.length > 120 ? text : undefined}
                >
                  {text}
                </div>
              );
            } else if (typeof val === "object" && "t" in val) {
              if (isImageResponseData(val)) {
                // Display the image
                // NOTE: This will async load the image
                return <MediaBox mediaUID={val.d} />;
              } else {
                // For now, we just display the doc ID...
                return <span className="icl">{val.d}</span>;
              }
            } else if ("type" in val && val.type === "eval") {
              // One score per line, for n > 1 responses per prompt.
              return (
                <div className="cf-table-cell">
                  {(
                    val.data as [
                      string | JSX.Element,
                      string,
                      string,
                      EvaluationScore | undefined,
                    ][]
                  ).map((e, j) => (
                    <div key={j}>
                      {e[3] !== undefined ? (
                        <ScoreChips score={e[3]} />
                      ) : (
                        <span className="icl">{e[1]}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            } else
              return (
                <TableResponseCell
                  responses={val as LLMResponse[]}
                  lines={tableLines}
                  hideScores={eval_res_cols !== undefined}
                  onlyShowScores={contains_eval_res && onlyShowScores}
                  showText={showText}
                  renderText={highlightText}
                  onOpen={openResponse}
                  modelColorFor={modelColorFor}
                />
              );
          },
          Header: ({ column }) => (
            // Aligned to the top, not centered: a centered label taller than
            // the box would overflow above it too, where scrolling can't
            // reach, cutting off its first words.
            <div
              key={column.columnDef.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                lineHeight: 1.2,
                maxHeight: 64,
                overflowY: "auto",
                overflowWrap: "anywhere",
              }}
            >
              {modelColors[i] && (
                <span
                  className="cf-model-dot"
                  style={{
                    backgroundColor: modelColors[i],
                    // Centered on the first line (1.2em tall).
                    marginTop: "calc((1.2em - 8px) / 2)",
                  }}
                />
              )}
              {column.columnDef.header}
            </div>
          ),
          mantineTableBodyCellProps: ({ table, column }) => ({
            style: {
              padding: cellPadding(table.getState().density),
              alignItems: "flex-start",
              textAlign: "left",
              fontSize: wideFormat ? 13 : 12,
              lineHeight: 1.4,
              "--cf-lines": tableLines,
            } as React.CSSProperties,
            // Pinned cells get a background of their own, which in dark mode
            // is darker than the other cells', two-toning the table. Match the
            // other cells' (dark[7] lightened 2%, white in light mode); hovered
            // rows still highlight.
            sx: column.getIsPinned()
              ? (theme: MantineTheme) => ({
                  backgroundColor: theme.fn.lighten(
                    theme.colorScheme === "dark"
                      ? theme.colors.dark[7]
                      : theme.white,
                    0.02,
                  ),
                })
              : undefined,
          }),
        })) as MRT_ColumnDef<any>[];

        setTableRows(rows);
        setTableColumns(columns);
        setTableColumnPinning({
          left: wideFormat
            ? colnames.slice(0, Math.min(2, numVarCols)).map((_, j) => `c${j}`)
            : [],
          right: [],
        });

        // setResponseDivs([
        //   <Table
        //     key="table"
        //     fontSize={wideFormat ? "sm" : "xs"}
        //     horizontalSpacing="xs"
        //     verticalSpacing={0}
        //     striped
        //     withColumnBorders={true}
        //   >
        //     <thead>
        //       <tr>
        //         {colnames.map((c) => (
        //           <th key={c}>{c}</th>
        //         ))}
        //       </tr>
        //     </thead>
        //     <tbody style={{ verticalAlign: "top" }}>{rows}</tbody>
        //   </Table>,
        // ]);

        /* HIERARCHY VIEW */
      } else if (viewFormat === "hierarchy") {
        // Now we need to perform groupings by each var in the selected vars list,
        // nesting the groupings (preferrably with custom divs) and sorting within
        // each group by value of that group's var (so all same values are clumped together).
        // :: For instance, for varnames = ['LLM', '$var1', '$var2'] we should get back
        // :: nested divs first grouped by LLM (first level), then by var1, then var2 (deepest level).
        let leaf_id = 0;
        let first_opened = false;
        const groupByVars = (
          resps: LLMResponse[],
          varnames: string[],
          eatenvars: string[],
          header: React.ReactNode,
        ): React.ReactNode => {
          if (resps.length === 0) return [];
          if (varnames.length === 0) {
            // Base case. Display n response(s) to each single prompt, back-to-back:
            let fixed_width = 100;
            const side_by_side_resps = wideFormat;
            if (side_by_side_resps && eatenvars.length > 0) {
              const num_llms = Array.from(
                new Set(resps.map(getLLMName)),
              ).length;
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
              eatenvars[eatenvars.length - 1] === "$LLM";
            first_opened = true;
            leaf_id += 1;
            return (
              <div
                key={"l" + leaf_id}
                className={className}
                style={{
                  backgroundColor: rgroup_color(eatenvars.length),
                  position: "relative",
                }}
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
            group_name === "$LLM"
              ? groupResponsesBy(resps, getLLMName)
              : groupResponsesBy(resps, (r) =>
                  group_name in r.vars
                    ? llmResponseDataToString(r.vars[group_name])
                    : null,
                );
          const get_header =
            group_name === "$LLM"
              ? (key: string, val?: string) => (
                  <div
                    key={val}
                    style={{
                      backgroundColor: val ? color_for_llm(val) : "#eee",
                    }}
                    className="response-llm-header"
                  >
                    {val}
                  </div>
                )
              : (key: string, val?: string) =>
                  getHeaderBadge(key, val, eatenvars.length);

          // Now produce nested divs corresponding to the groups
          const remaining_vars = varnames.slice(1);
          const updated_eatenvars = eatenvars.concat([group_name]);
          const defaultOpened =
            !first_opened ||
            eatenvars.length === 0 ||
            eatenvars[eatenvars.length - 1] === "$LLM";
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
              {Array.isArray(leftover_resps_divs) &&
              leftover_resps_divs.length === 0 ? (
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
        setResponseDivs(divs);
      } else if (showEvalScoreOptions && viewFormat === "vis") {
        // Plot view (only present if eval scores are present)
        const visView = <VisView responses={responses} wideFormat />;
        setResponseDivs(visView);
      }
    });
  };

  // Trigger a redraw of the inspector when any of the below changes:
  useEffect(() => {
    // Trigger redraw, but debounce to avoid too-quick re-renders
    debounce(triggerRedraw, 30)();
  }, [
    multiSelectValue,
    batchedResponses,
    wideFormat,
    viewFormat,
    tableColVar,
    onlyShowScores,
    searchValue,
    caseSensitive,
    filterBySearchValue,
    colorScheme,
    customLLMFieldName,
    disableBackgroundColor,
  ]);

  // When the user clicks an item in the drop-down,
  // we want to autoclose the multiselect drop-down:
  const multiSelectRef = useRef<HTMLInputElement>(null);
  const handleMultiSelectValueChange = (new_val: string[]) => {
    if (multiSelectRef?.current) multiSelectRef.current.blur();
    setMultiSelectValue(new_val);
  };

  const handleSearchValueChange = (
    content: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setSearchValue(content.target.value);
  };

  const sz = useMemo(() => (wideFormat ? "sm" : "xs"), [wideFormat]);

  const searchBar = useMemo(
    () => (
      <Flex gap="6px" align="end" w="100%">
        <TextInput
          id="search_bar"
          label={"Find"}
          autoComplete="off"
          size={sz}
          placeholder={"Search responses"}
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
              // @ts-expect-error Mantine's toggle works here but the types don't match
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
              // @ts-expect-error Mantine's toggle works here but the types don't match
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
      sz,
      toggleCaseSensitivity,
      toggleFilterBySearchValue,
    ],
  );

  // A compact search bar, for the table's toolbar.
  const tableSearchBar = (
    <Flex gap={4} align="center" wrap="nowrap">
      <TextInput
        aria-label="Search responses"
        autoComplete="off"
        size="xs"
        styles={COMPACT_SELECT_STYLES}
        placeholder="Search responses"
        w={wideFormat ? 220 : 120}
        value={searchValue}
        onChange={handleSearchValueChange}
      />
      <Tooltip
        label={`Case sensitivity (${caseSensitive ? "on" : "off"})`}
        withArrow
      >
        <ActionIcon
          variant={caseSensitive ? "filled" : "light"}
          size="sm"
          // @ts-expect-error Mantine's toggle works here but the types don't match
          onClick={toggleCaseSensitivity}
        >
          <IconLetterCaseToggle size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip
        label={`Filter responses by term (${filterBySearchValue ? "on" : "off"})`}
        withArrow
      >
        <ActionIcon
          variant={filterBySearchValue ? "filled" : "light"}
          size="sm"
          // @ts-expect-error Mantine's toggle works here but the types don't match
          onClick={toggleFilterBySearchValue}
        >
          <IconFilter size={14} />
        </ActionIcon>
      </Tooltip>
    </Flex>
  );

  return (
    <div style={{ height: "100%", margin: "0", padding: "0" }}>
      <Tabs
        value={viewFormat}
        onTabChange={(val) => {
          if (viewFormat === val) return;
          setResponseDivs([]);
          setShowLoadingSpinner(true);
          const next = val ?? "hierarchy";
          setViewFormat(next);
          onViewFormatChange?.(next);
        }}
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
          <Tabs.Tab value="grid">
            <IconLayoutGrid
              size="10pt"
              style={{ marginBottom: wideFormat ? "0px" : "-4px" }}
            />
            {wideFormat ? " Grid View" : ""}
          </Tabs.Tab>
          {showEvalScoreOptions && wideFormat ? (
            <Tabs.Tab value="vis">
              <IconChartBar
                size="10pt"
                style={{ marginBottom: wideFormat ? "0px" : "-4px" }}
              />
              {wideFormat ? " Vis View" : ""}
            </Tabs.Tab>
          ) : (
            <></>
          )}
        </Tabs.List>

        <Tabs.Panel value="hierarchy" pt="xs">
          <Flex gap={sz} align="end" w="100%" mb="xs">
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
        <Tabs.Panel value="table" pt="0px">
          <></>
        </Tabs.Panel>
      </Tabs>

      <div
        className="nowheel nodrag"
        // The grid scrolls within the space available, so needs no minimum.
        style={{ minHeight: viewFormat === "grid" ? undefined : "800px" }}
      >
        {/* To get the overlay to operate just inside the div, use style={{position: "relative"}}. However it won't show the spinner in the right place. */}
        <LoadingOverlay
          visible={showLoadingSpinner || (isOpen && !isOpenDelayed)}
          overlayOpacity={0.5}
        />
        {isOpenDelayed ? (
          viewFormat === "table" ? (
            <>
              <MantineReactTable table={table} />
              <ResponseLightbox
                items={tableLightbox?.items ?? []}
                index={tableLightbox?.index ?? null}
                onIndexChange={(index) =>
                  setTableLightbox((prev) =>
                    index === null || prev === null ? null : { ...prev, index },
                  )
                }
                accessors={tableLightboxAccessors}
                modelLabel={customLLMFieldName || "LLM"}
                metrics={tableLightboxMetrics}
              />
            </>
          ) : viewFormat === "grid" ? (
            <Box pt="xs">
              <ResponseGridView
                responses={batchedResponses}
                modelOf={getLLMName}
                modelLabel={customLLMFieldName || "LLM"}
                wideFormat={wideFormat}
                disableModelColors={disableBackgroundColor}
              />
            </Box>
          ) : (
            responseDivs
          )
        ) : (
          <></>
        )}
      </div>
    </div>
  );
};

export default LLMResponseInspector;
