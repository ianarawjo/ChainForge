import React, { useMemo } from "react";
import { useMantineColorScheme } from "@mantine/core";
import {
  IconAlignLeft,
  IconCheck,
  IconCircleDashed,
  IconPhoto,
  IconSparkles,
  IconStack2,
} from "@tabler/icons-react";
import { EdgePayloadKind, EdgePreview, EdgeScoreSummary } from "./edgePreview";
import { useThumbnailUrl } from "./useMediaUrl";

/** The look of each payload kind, so the badge and the card agree. */
const KIND_STYLES: Record<
  EdgePayloadKind,
  {
    label: string;
    icon: React.FC<{ size?: number; stroke?: number }>;
    light: string;
    dark: string;
  }
> = {
  text: {
    label: "text item",
    icon: IconAlignLeft,
    light: "#4c7bab",
    dark: "#8fbde8",
  },
  response: {
    label: "response",
    icon: IconSparkles,
    light: "#2f8f77",
    dark: "#6ed5b8",
  },
  image: {
    label: "image",
    icon: IconPhoto,
    light: "#8256bd",
    dark: "#c3a2ee",
  },
  mixed: {
    label: "item",
    icon: IconStack2,
    light: "#a8742a",
    dark: "#e5b96a",
  },
  empty: {
    label: "no data",
    icon: IconCircleDashed,
    light: "#9a9a9a",
    dark: "#888",
  },
};

/** Scored responses get their own glyph, so an evaluator's output is
 * recognizable on the canvas without hovering it. A bare check mark, because
 * the badge renders it at 9px and anything busier turns to mush. */
function iconFor(preview: EdgePreview) {
  if (preview.scored && preview.kind !== "empty") return IconCheck;
  return KIND_STYLES[preview.kind].icon;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n / 1000) + "k";
}

/* ------------------------------------------------------------------ *
 *  Badge: the always-on pill at the middle of an edge
 * ------------------------------------------------------------------ */

export interface EdgePreviewBadgeProps {
  preview: EdgePreview;
  /** Raised look while the edge (or the badge) is hovered. */
  active?: boolean;
}

export const EdgePreviewBadge: React.FC<EdgePreviewBadgeProps> = ({
  preview,
  active,
}) => {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  const style = KIND_STYLES[preview.kind];
  const Icon = iconFor(preview);
  const color = dark ? style.dark : style.light;
  const isEmpty = preview.kind === "empty";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 5px",
        borderRadius: 7,
        fontSize: 9,
        fontWeight: 600,
        lineHeight: 1.5,
        fontVariantNumeric: "tabular-nums",
        cursor: "default",
        color,
        background: dark ? "#25262b" : "#fff",
        border: `1px ${isEmpty ? "dashed" : "solid"} ${color}${dark ? "" : "66"}`,
        boxShadow: active
          ? `0 1px 5px rgba(0,0,0,${dark ? 0.5 : 0.22})`
          : `0 1px 2px rgba(0,0,0,${dark ? 0.35 : 0.1})`,
        opacity: isEmpty && !active ? 0.65 : 1,
        transition: "box-shadow 0.15s, opacity 0.15s",
      }}
    >
      <Icon size={9} stroke={2.2} />
      {/* No number when only the cache knows it; the card fills it in. */}
      {!preview.countUnknown && (
        <span>{isEmpty ? "–" : formatCount(preview.count)}</span>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 *  Card: what opens when you rest on an edge
 * ------------------------------------------------------------------ */

const Thumb: React.FC<{ uid: string; dark: boolean }> = ({ uid, dark }) => {
  // Media may arrive as a stored uid or as an inline data URL.
  const isDataUrl = uid.startsWith("data:");
  const { url, status } = useThumbnailUrl(isDataUrl ? undefined : uid);
  const src = isDataUrl ? uid : url;
  return (
    <div
      style={{
        // Share the card's width rather than sitting at a fixed size, so a
        // row of one or two images doesn't leave the card half empty.
        flex: 1,
        minWidth: 0,
        height: 62,
        borderRadius: 4,
        overflow: "hidden",
        background: dark ? "#2c2e33" : "#f1f3f5",
        border: `1px solid ${dark ? "#3a3d44" : "#e3e5e8"}`,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: dark ? "#777" : "#aaa",
          }}
        >
          {status === "error" ? "?" : "…"}
        </div>
      )}
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode; dark: boolean }> = ({
  children,
  dark,
}) => (
  <span
    style={{
      display: "inline-block",
      padding: "0px 5px",
      borderRadius: 4,
      fontSize: 9,
      fontWeight: 500,
      background: dark ? "#2c2e33" : "#f1f3f5",
      color: dark ? "#c1c2c5" : "#5c5f66",
      border: `1px solid ${dark ? "#3a3d44" : "#e6e8ea"}`,
    }}
  >
    {children}
  </span>
);

export interface EdgePreviewCardProps {
  preview: EdgePreview;
  /** Read from the response cache when the card opened; null if none. */
  scores?: EdgeScoreSummary | null;
}

export const EdgePreviewCard: React.FC<EdgePreviewCardProps> = ({
  preview,
  scores,
}) => {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  const style = KIND_STYLES[preview.kind];
  const color = dark ? style.dark : style.light;
  const muted = dark ? "#8f9296" : "#868e96";
  const rule = `1px solid ${dark ? "#35373d" : "#eceef0"}`;

  const showsImages = preview.kind === "image" || preview.kind === "mixed";
  const remaining = preview.count - preview.items.length;

  const header = useMemo(
    () => (
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          padding: "7px 10px",
          borderBottom: rule,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {preview.kind === "empty"
            ? "No data yet"
            : preview.countUnknown
              ? "Scored responses"
              : `${formatCount(preview.count)} ${style.label}${preview.count === 1 ? "" : "s"}`}
        </span>
        <span
          style={{
            fontSize: 10,
            color: muted,
            marginLeft: "auto",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 130,
          }}
        >
          {preview.sourceName ?? ""}
        </span>
      </div>
    ),
    [preview, color, muted, rule, style.label],
  );

  const chips = useMemo(() => {
    if (preview.varNames.length === 0 && preview.metavarNames.length === 0)
      return null;
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px",
          borderBottom: rule,
        }}
      >
        {preview.varNames.length > 0 && (
          <span style={{ fontSize: 9, color: muted }}>vars</span>
        )}
        {preview.varNames.slice(0, 5).map((v) => (
          <Chip key={`v-${v}`} dark={dark}>
            {v}
          </Chip>
        ))}
        {preview.metavarNames.length > 0 && (
          <span style={{ fontSize: 9, color: muted, marginLeft: 2 }}>meta</span>
        )}
        {preview.metavarNames.slice(0, 5).map((v) => (
          <Chip key={`m-${v}`} dark={dark}>
            {v}
          </Chip>
        ))}
      </div>
    );
  }, [preview, dark, muted, rule]);

  const body = useMemo(() => {
    if (preview.countUnknown)
      return (
        <div style={{ padding: "8px 10px", fontSize: 10.5, color: muted }}>
          This evaluator passes its results through the response cache, so the
          scores below are all an edge can see. Open the inspector for the
          responses themselves.
        </div>
      );
    if (preview.kind === "empty")
      return (
        <div style={{ padding: "10px", fontSize: 10.5, color: muted }}>
          Nothing is flowing through this edge yet. Run the source node to fill
          it.
        </div>
      );

    return (
      <div style={{ padding: "3px 0" }}>
        {showsImages && (
          <div style={{ display: "flex", gap: 5, padding: "5px 10px" }}>
            {preview.items
              .filter((it) => it.imageUid)
              .map((it, i) => (
                <Thumb key={i} uid={it.imageUid as string} dark={dark} />
              ))}
          </div>
        )}
        {preview.items
          .filter((it) => it.text)
          .map((it, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 6,
                padding: "4px 10px",
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  // Matches the line-height below, so the number and the model
                  // name share a baseline.
                  lineHeight: 1.35,
                  color: muted,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 9,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  minWidth: 0,
                  // Without an explicit size this span inherits the document's
                  // 16px default, and its tall strut drops the 9px model name
                  // onto a baseline well below the index number beside it.
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  fontSize: 10.5,
                  lineHeight: 1.35,
                }}
              >
                {it.llmName && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 9,
                      fontWeight: 600,
                      color,
                    }}
                  >
                    {it.llmName}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10.5,
                    lineHeight: 1.35,
                    color: dark ? "#c1c2c5" : "#3d3f42",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {it.text}
                </span>
              </span>
            </div>
          ))}
      </div>
    );
  }, [preview, dark, muted, color, showsImages]);

  // A plain reading of the scores, no chart: the response inspector and the
  // Vis node are where scores get visualized.
  const scoreRow = useMemo(() => {
    if (!scores) return null;
    const detail =
      scores.criteria !== undefined
        ? `${scores.criteria.length} criteria: ${scores.criteria.slice(0, 4).join(", ")}${scores.criteria.length > 4 ? "…" : ""}`
        : scores.parts.join(" · ");
    return (
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          padding: "5px 10px",
          borderTop: rule,
        }}
      >
        <span style={{ fontSize: 9, color: muted }}>
          {formatCount(scores.n)} scored
          {scores.responses > 0 && scores.responses !== scores.n
            ? ` · ${formatCount(scores.responses)} responses`
            : ""}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color,
            marginLeft: "auto",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {detail}
        </span>
      </div>
    );
  }, [scores, color, muted, rule]);

  const footer = useMemo(() => {
    const parts: React.ReactNode[] = [];
    if (remaining > 0)
      parts.push(
        <span key="more">
          +{formatCount(remaining)} more
          {preview.sampled ? " (tallies sampled)" : ""}
        </span>,
      );
    if (preview.llms.length > 0)
      parts.push(
        <span key="llms" style={{ marginLeft: "auto" }}>
          {preview.llms
            .slice(0, 3)
            .map((l) => `${l.name} ×${l.count}`)
            .join(" · ")}
          {preview.llms.length > 3 ? " …" : ""}
        </span>,
      );
    if (parts.length === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "5px 10px",
          borderTop: rule,
          fontSize: 9,
          color: muted,
        }}
      >
        {parts}
      </div>
    );
  }, [preview, remaining, muted, rule]);

  return (
    <div style={{ width: 310 }}>
      {header}
      {chips}
      {body}
      {scoreRow}
      {footer}
    </div>
  );
};

export default EdgePreviewCard;
