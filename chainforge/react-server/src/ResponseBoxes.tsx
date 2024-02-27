import React, { Suspense, useMemo, lazy } from "react";
import { Collapse, Flex } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { truncStr } from "./backend/utils";
import {
  Dict,
  StandardizedLLMResponse,
  TypedDict,
} from "./backend/typing";

// Lazy load the response toolbars
const ResponseRatingToolbar = lazy(() => import("./ResponseRatingToolbar.js"));

/* HELPER FUNCTIONS */
const SUCCESS_EVAL_SCORES = new Set(["true", "yes"]);
const FAILURE_EVAL_SCORES = new Set(["false", "no"]);
const getEvalResultStr = (
  eval_item: string[] | Dict | string | number | boolean,
) => {
  if (Array.isArray(eval_item)) {
    return "scores: " + eval_item.join(", ");
  } else if (typeof eval_item === "object") {
    const strs = Object.keys(eval_item).map((key) => {
      let val = eval_item[key];
      if (typeof val === "number" && val.toString().indexOf(".") > -1)
        val = val.toFixed(4); // truncate floats to 4 decimal places
      return `${key}: ${val}`;
    });
    return strs.join(", ");
  } else {
    const eval_str = eval_item.toString().trim().toLowerCase();
    const color = SUCCESS_EVAL_SCORES.has(eval_str)
      ? "black"
      : FAILURE_EVAL_SCORES.has(eval_str)
        ? "red"
        : "black";
    return (
      <>
        <span style={{ color: "gray" }}>{"score: "}</span>
        <span style={{ color }}>{eval_str}</span>
      </>
    );
  }
};

const countResponsesBy = (
  responses: string[],
  keyFunc: (item: string) => string,
): TypedDict<number> => {
  const counts_by_key = {};
  responses.forEach((item) => {
    const key = keyFunc(item);
    if (key === null) return;
    if (key in counts_by_key) counts_by_key[key] += 1;
    else counts_by_key[key] = 1;
  });
  return counts_by_key;
};

/**
 * A ResponseGroup is used in the Grouped List view to display clickable, collapseable groups of responses.
 * These groups may also be ResponseGroups (nested).
 */
export const ResponseGroup = ({
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
  vars?: TypedDict<string>;
  truncLenForVars?: number;
  llmName?: string;
  boxColor?: string;
  width?: number;
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
      {llmName !== undefined ? (
        children
      ) : (
        <div className="response-item-llm-name-wrapper">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Given a response object, generates the inner divs to put inside a ResponseBox.
 * This is the lowest level display for response texts in ChainForge.
 */
export const genResponseTextsDisplay = (
  res_obj: StandardizedLLMResponse,
  filterFunc?: (txts: string[]) => string[],
  customTextDisplay?: (txt: string) => React.ReactNode,
  onlyShowScores?: boolean,
  llmName?: string,
  wideFormat?:boolean,
): React.ReactNode[] | React.ReactNode => {
  if (!res_obj) return <></>;

  const eval_res_items = res_obj.eval_res ? res_obj.eval_res.items : null;

  // Bucket responses that have the same text, and sort by the
  // number of same responses so that the top div is the most prevalent response.
  let responses = res_obj.responses;

  // Perform any post-processing of responses. For instance,
  // when searching for a response, we mark up the response texts to spans
  // and may filter out some responses, removing them from display.
  if (filterFunc) responses = filterFunc(responses);

  // Collapse responses with the same texts.
  // We need to keep track of the original evaluation result per response str:
  const resp_str_to_eval_res = {};
  if (eval_res_items)
    responses.forEach((r, idx) => {
      resp_str_to_eval_res[r] = eval_res_items[idx];
    });

  const same_resp_text_counts = countResponsesBy(responses, (r) => r);
  const same_resp_keys = Object.keys(same_resp_text_counts).sort(
    (key1, key2) => same_resp_text_counts[key2] - same_resp_text_counts[key1],
  );

  return same_resp_keys.map((r, idx) => {
    const origIdxs = same_resp_text_counts[r];
    const txt = customTextDisplay ? customTextDisplay(r) : r;
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
              onUpdateResponses={undefined}
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
        {same_resp_text_counts[r] > 1 ? (
          <span className="num-same-responses">
            {same_resp_text_counts[r]} times
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
        {onlyShowScores ? (
          <pre>{}</pre>
        ) : (
          <div className="small-response">{txt}</div>
        )}
      </div>
    );
  });
};
