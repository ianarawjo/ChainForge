/**
 * Compact cells for the response inspector's Table View. A cell holds a
 * column's responses to one prompt (e.g. one model's), each in a box tinted
 * with its model's color, as elsewhere in ChainForge. A strip of the model's
 * color along the top holds the response's badges (identical-response count,
 * scores) and its rating buttons, which appear on hover and stay visible once
 * the response is graded or annotated. The text is clamped to a few lines;
 * clicking a response opens it in full.
 */
import React, { Suspense, lazy } from "react";
import { ActionIcon, CopyButton, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import {
  EvaluationScore,
  LLMResponse,
  LLMResponseData,
  isImageResponseData,
} from "./backend/typing";
import { llmResponseDataToString } from "./backend/utils";
import { formatScore, passFail } from "./backend/responseGrid";
import { MediaBox } from "./ResponseBoxes";

const ResponseRatingToolbar = lazy(() => import("./ResponseRatingToolbar"));

const scoreText = (value: unknown): string =>
  Array.isArray(value)
    ? value.join(", ")
    : typeof value === "number" ||
        typeof value === "boolean" ||
        typeof value === "string"
      ? formatScore(value)
      : JSON.stringify(value);

/** A score as a small chip: green for pass, red for fail, gray otherwise. */
export const ScoreChip: React.FC<{ label?: string; value: unknown }> = ({
  label,
  value,
}) => {
  const outcome = passFail(value);
  const full = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <span
      className={
        "cf-score-chip" +
        (outcome === true
          ? " cf-score-pass"
          : outcome === false
            ? " cf-score-fail"
            : "")
      }
      title={label ? `${label}: ${full}` : full}
    >
      {label && <span className="cf-score-chip-label">{label}</span>}
      {scoreText(value)}
    </span>
  );
};

/** Chips for an evaluation score: one per metric for multi-metric scores. */
export const ScoreChips: React.FC<{ score?: EvaluationScore | null }> = ({
  score,
}) => {
  if (score === undefined || score === null) return null;
  if (typeof score === "object" && !Array.isArray(score))
    return (
      <>
        {Object.entries(score).map(([metric, value]) => (
          <ScoreChip key={metric} label={metric} value={value} />
        ))}
      </>
    );
  return <ScoreChip value={score} />;
};

export interface TableResponseCellProps {
  responses: LLMResponse[];
  /** Lines of text to show per response before clamping. */
  lines: number;
  /** Leave scores out, e.g. when they have their own columns. */
  hideScores?: boolean;
  /** Show only the scores, without the response texts. */
  onlyShowScores?: boolean;
  /** Whether to show a text response, e.g. while searching with filtering on. */
  showText?: (text: string) => boolean;
  /** Renders a text response, e.g. with search matches highlighted. */
  renderText?: (text: string) => React.ReactNode;
  /** Opens a response in full; `index` is its position in `response.responses`. */
  onOpen?: (response: LLMResponse, index: number) => void;
  /**
   * The color of a response's model, which is consistent across ChainForge.
   * Undefined for neutral gray, e.g. when a node turns model colors off.
   */
  modelColorFor?: (response: LLMResponse) => string | undefined;
}

/** Copies a text response; sits in the response's bottom-right corner, shown on hover. */
const CopyResponseButton: React.FC<{ text: string }> = ({ text }) => (
  <CopyButton value={text} timeout={1000}>
    {({ copied, copy }) => (
      <Tooltip label={copied ? "Copied!" : "Copy"} withArrow withinPortal>
        <ActionIcon
          className="cf-table-copy"
          size="sm"
          variant="subtle"
          aria-label="Copy response"
          onClick={(e: React.MouseEvent) => {
            // Don't also open the full response.
            e.stopPropagation();
            copy();
          }}
        >
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
        </ActionIcon>
      </Tooltip>
    )}
  </CopyButton>
);

interface TextGroup {
  text: string;
  data: LLMResponseData;
  /** Positions of the identical responses in `response.responses`. */
  indices: number[];
}

/** A response object's responses, with identical ones collapsed, most frequent first. */
function groupIdentical(
  response: LLMResponse,
  showText?: (text: string) => boolean,
): TextGroup[] {
  const groups = new Map<string, TextGroup>();
  response.responses.forEach((data, index) => {
    const text = llmResponseDataToString(data);
    if (showText && typeof data !== "object" && !showText(text)) return;
    const group = groups.get(text);
    if (group) group.indices.push(index);
    else groups.set(text, { text, data, indices: [index] });
  });
  return Array.from(groups.values()).sort(
    (a, b) => b.indices.length - a.indices.length,
  );
}

export const TableResponseCell: React.FC<TableResponseCellProps> = ({
  responses,
  lines,
  hideScores,
  onlyShowScores,
  showText,
  renderText,
  onOpen,
  modelColorFor,
}) => (
  <div
    className="cf-table-cell"
    style={{ "--cf-lines": lines } as React.CSSProperties}
  >
    {responses.flatMap((response) => {
      const modelColor = modelColorFor?.(response);
      return groupIdentical(response, showText).map(
        ({ text, data, indices }) => {
          const score = hideScores
            ? undefined
            : response.eval_res?.items?.[indices[0]];
          const open = () => {
            // Selecting text to copy it shouldn't open the full view.
            if (window.getSelection()?.toString()) return;
            onOpen?.(response, indices[0]);
          };
          return (
            <div
              key={`${response.uid}-${indices[0]}`}
              className="cf-table-resp"
              style={
                modelColor
                  ? ({ "--cf-model-color": modelColor } as React.CSSProperties)
                  : undefined
              }
            >
              <div className="cf-table-resp-band">
                <ScoreChips score={score} />
                {indices.length > 1 && (
                  <span
                    className="cf-table-count"
                    title={`${indices.length} identical responses`}
                  >
                    ×{indices.length}
                  </span>
                )}
                <div className="cf-table-resp-toolbar">
                  <Suspense>
                    <ResponseRatingToolbar
                      uid={response.uid}
                      innerIdxs={indices}
                      responseData={text}
                      revealOnHover
                      hideCopy
                    />
                  </Suspense>
                </div>
              </div>
              {!onlyShowScores &&
                (isImageResponseData(data) ? (
                  <div className="cf-table-resp-image" onClick={open}>
                    <MediaBox mediaUID={data.d} />
                  </div>
                ) : (
                  <div className="cf-table-resp-text" onClick={open}>
                    {renderText ? renderText(text) : text}
                  </div>
                ))}
              {!onlyShowScores && !isImageResponseData(data) && (
                <CopyResponseButton text={text} />
              )}
            </div>
          );
        },
      );
    })}
  </div>
);
