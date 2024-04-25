import React, { Suspense, useMemo, lazy } from "react";
import { Collapse, Flex, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { truncStr } from "./backend/utils";
import {
  Dict,
  EvaluationScore,
  LLMResponse,
  LLMResponseData,
} from "./backend/typing";

// Lazy load the response toolbars
const ResponseRatingToolbar = lazy(() => import("./ResponseRatingToolbar"));

/* HELPER FUNCTIONS */
const SUCCESS_EVAL_SCORES = new Set(["true", "yes"]);
const FAILURE_EVAL_SCORES = new Set(["false", "no"]);
export const getEvalResultStr = (
  eval_item: EvaluationScore,
  hide_prefix: boolean,
) => {
  if (Array.isArray(eval_item)) {
    return (hide_prefix ? "" : "scores: ") + eval_item.join(", ");
  } else if (typeof eval_item === "object") {
    const strs = Object.keys(eval_item).map((key, j) => {
      let val = eval_item[key];
      if (typeof val === "number" && val.toString().indexOf(".") > -1)
        val = val.toFixed(4); // truncate floats to 4 decimal places
      return (
        <div key={`${key}-${j}`}>
          <span>{key}: </span>
          <span>{getEvalResultStr(val, true)}</span>
        </div>
      );
    });
    return <Stack spacing={0}>{strs}</Stack>;
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

const countResponsesBy = (
  responses: LLMResponseData[],
  keyFunc: (item: LLMResponseData) => string,
): Dict<number[]> => {
  const d: Dict<number[]> = {};
  responses.forEach((item, idx) => {
    const key = keyFunc(item);
    if (key in d) d[key].push(idx);
    else d[key] = [idx];
  });
  return d;
};

/**
 * A ResponseGroup is used in the Grouped List view to display clickable, collapseable groups of responses.
 * These groups may also be ResponseGroups (nested).
 */
export interface ResponseGroupProps {
  header: React.ReactNode;
  responseBoxes: React.ReactNode[];
  responseBoxesWrapperClass: string;
  displayStyle: string;
  defaultState: boolean;
}

export const ResponseGroup: React.FC<ResponseGroupProps> = ({
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

/**
 * A ResponseBox is the display of an LLM's response(s) for a single prompt.
 * It is the colored boxes that appear in the response inspector when you are inspecting responses.
 * Note that a ResponseBox could list multiple textual responses if num responses per prompt > 1.
 */
interface ResponseBoxProps {
  children: React.ReactNode; // For components, HTML elements, text, etc.
  vars?: Dict<string>;
  truncLenForVars?: number;
  llmName?: string;
  boxColor?: string;
  width?: number | string;
}

export const ResponseBox: React.FC<ResponseBoxProps> = ({
  children,
  boxColor,
  width,
  vars,
  truncLenForVars,
  llmName,
}) => {
  const var_tags = useMemo(() => {
    if (vars === undefined) return [];
    return Object.entries(vars).map(([varname, val]) => {
      const v = truncStr(val.trim(), truncLenForVars ?? 18);
      return (
        <div key={varname} className="response-var-inline">
          <span className="response-var-name">{varname}&nbsp;=&nbsp;</span>
          <span className="response-var-value">{v}</span>
        </div>
      );
    });
  }, [vars, truncLenForVars]);

  return (
    <div
      className="response-box"
      style={{
        backgroundColor: boxColor ?? "white",
        width: width ?? "100%",
      }}
    >
      <div className="response-var-inline-container">{var_tags}</div>
      {llmName === undefined ? (
        children
      ) : (
        <div className="response-item-llm-name-wrapper">{children}</div>
      )}
    </div>
  );
};

/**
 * Given a response object, generates the inner divs to put inside a ResponseBox.
 * This is the lowest level display for response texts in ChainForge.
 */
export const genResponseTextsDisplay = (
  res_obj: LLMResponse,
  filterFunc?: (txts: LLMResponseData[]) => LLMResponseData[],
  customTextDisplay?: (txt: string) => React.ReactNode,
  onlyShowScores?: boolean,
  llmName?: string,
  wideFormat?: boolean,
  hideEvalScores?: boolean,
): React.ReactNode[] | React.ReactNode => {
  if (!res_obj) return <></>;

  const eval_res_items =
    !hideEvalScores && res_obj.eval_res ? res_obj.eval_res.items : null;

  // Bucket responses that have the same text, and sort by the
  // number of same responses so that the top div is the most prevalent response.
  let responses = res_obj.responses;

  // Perform any post-processing of responses. For instance,
  // when searching for a response, we mark up the response texts to spans
  // and may filter out some responses, removing them from display.
  if (filterFunc) responses = filterFunc(responses);

  // Collapse responses with the same texts.
  // We need to keep track of the original evaluation result per response str:
  const resp_str_to_eval_res: Dict<EvaluationScore> = {};
  if (eval_res_items)
    responses.forEach((r, idx) => {
      resp_str_to_eval_res[typeof r === "string" ? r : r.d] =
        eval_res_items[idx];
    });

  const same_resp_text_counts = countResponsesBy(responses, (r) =>
    typeof r === "string" ? r : r.d,
  );
  const resp_special_type_map: Dict<string> = {};
  responses.forEach((r) => {
    const key = typeof r === "string" ? r : r.d;
    if (typeof r === "object") resp_special_type_map[key] = r.t;
  });
  const same_resp_keys = Object.keys(same_resp_text_counts).sort(
    (key1, key2) =>
      same_resp_text_counts[key2].length - same_resp_text_counts[key1].length,
  );

  return same_resp_keys.map((r, idx) => {
    const origIdxs = same_resp_text_counts[r];
    let display: React.ReactNode;
    if (r in resp_special_type_map) {
      // Right now only images are supported as special types.
      // Load and display the image:
      display = (
        <img
          className="lazyload"
          data-src={`data:image/png;base64,${r}`}
          style={{ maxWidth: "100%", width: "auto" }}
        />
      );
    } else {
      display = customTextDisplay ? customTextDisplay(r) : r;
    }
    return (
      <div key={idx}>
        <Flex justify="right" gap="xs" align="center">
          {llmName !== undefined &&
          idx === 0 &&
          same_resp_keys.length > 1 &&
          wideFormat === true ? (
            <h1>{llmName}</h1>
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
          {llmName !== undefined &&
          idx === 0 &&
          (same_resp_keys.length === 1 || !wideFormat) ? (
            <h1>{llmName}</h1>
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
            {getEvalResultStr(resp_str_to_eval_res[r], true)}
          </p>
        ) : (
          <></>
        )}
        {onlyShowScores ? (
          <pre>{}</pre>
        ) : (
          <div className="small-response">{display}</div>
        )}
      </div>
    );
  });
};
