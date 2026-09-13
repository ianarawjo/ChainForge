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
  Dict,
  EvaluationScore,
  LLMResponse,
  LLMResponseData,
  isImageResponseData,
} from "./backend/typing";
import { llmResponseDataToString, truncStr } from "./backend/utils";
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

/**
 * A text color that reads on a strip of `color` (e.g. "#f1b933"): dark on
 * light colors like amber, white on darker ones. White for colors it can't
 * parse.
 */
export function readableTextOn(color: string): string {
  const hex = color.trim().match(/^#([0-9a-f]{6})/i)?.[1];
  if (!hex) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // Perceived brightness (ITU-R BT.601), 0-255.
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness > 170 ? "#1a1b1e" : "#fff";
}

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
  /** Lines of text to show per response before clamping, or "none" for all. */
  lines: number | "none";
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
  /** A model name to show in the strip, where the view doesn't already show it. */
  modelNameFor?: (response: LLMResponse) => string | undefined;
  /** Prompt variables to list under the strip, e.g. those not grouped on. */
  varsFor?: (response: LLMResponse) => Dict<string> | undefined;
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
  modelNameFor,
  varsFor,
}) => (
  <div
    className="cf-table-cell"
    style={{ "--cf-lines": lines } as React.CSSProperties}
  >
    {responses.flatMap((response) => {
      const modelColor = modelColorFor?.(response);
      const modelName = modelNameFor?.(response);
      const vars = varsFor?.(response);
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
                  ? ({
                      "--cf-model-color": modelColor,
                      "--cf-band-text": readableTextOn(modelColor),
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <div className="cf-table-resp-band">
                {modelName && (
                  <span className="cf-table-resp-model">{modelName}</span>
                )}
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
              {vars && Object.keys(vars).length > 0 && (
                <div className="cf-table-resp-vars">
                  {Object.entries(vars).map(([name, value]) => (
                    <span key={name}>
                      <b>{name}</b> = {value}
                    </span>
                  ))}
                </div>
              )}
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

export interface TextResponseCardProps {
  text: string;
  /**
   * Shown in the strip along the top: a model's name (in its color, when
   * `modelColor` is given) or another label, such as a prompt variant's.
   */
  modelName?: string;
  modelColor?: string;
  /** Prompt variables that produced the text, listed under the strip. */
  vars?: Dict<unknown>;
  /** Longest a variable's value is shown before being cut short. */
  varMaxLength?: number;
}

/**
 * The same card as a response's, for text that isn't a stored response, such
 * as Split and Join node previews: no ratings, copying, or opening in full.
 */
export const TextResponseCard: React.FC<TextResponseCardProps> = ({
  text,
  modelName,
  modelColor,
  vars,
  varMaxLength = 72,
}) => {
  const varEntries = Object.entries(vars ?? {}).map(
    ([name, value]) =>
      [
        name,
        truncStr(
          llmResponseDataToString(value as LLMResponseData).trim(),
          varMaxLength,
        ) ?? "",
      ] as const,
  );
  return (
    <div
      className="cf-table-cell"
      style={
        {
          "--cf-lines": "none",
          fontSize: 12,
          lineHeight: 1.4,
        } as React.CSSProperties
      }
    >
      <div
        className="cf-table-resp"
        style={
          modelColor
            ? ({
                "--cf-model-color": modelColor,
                "--cf-band-text": readableTextOn(modelColor),
              } as React.CSSProperties)
            : undefined
        }
      >
        {modelName && (
          <div className="cf-table-resp-band">
            <span className="cf-table-resp-model">{modelName}</span>
          </div>
        )}
        {varEntries.length > 0 && (
          <div className="cf-table-resp-vars">
            {varEntries.map(([name, value]) => (
              <span key={name}>
                <b>{name}</b> = {value}
              </span>
            ))}
          </div>
        )}
        <div className="cf-table-resp-text cf-table-resp-static">{text}</div>
      </div>
    </div>
  );
};
