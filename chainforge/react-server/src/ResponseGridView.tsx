/**
 * The response inspector's grid view: responses (text or images) laid out on
 * rows and columns of prompt variables (or the model), optionally repeated per
 * value of a third "split by" axis, with the remaining variables as filters.
 * Scored responses show a badge, and can be tinted by a metric like a heatmap.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNodeId } from "reactflow";
import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Modal,
  NativeSelect,
  Slider,
  Text,
  useMantineTheme,
} from "@mantine/core";
import {
  IconAdjustmentsHorizontal,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Dict, LLMResponse } from "./backend/typing";
import { llmResponseDataToString, reasoningAt } from "./backend/utils";
import {
  axisValues,
  buildGrid,
  collectGridItems,
  formatScore,
  GridAccessors,
  GridAxes,
  GridItem,
  gridAxisOptions,
  HeatScale,
  heatLevel,
  heatScaleFor,
  LayoutOptions,
  metricValue,
  MODEL_AXIS,
  passFail,
  resolveGridAxes,
  scoreMetrics,
  UNSPECIFIED,
} from "./backend/responseGrid";
import { MediaThumbnail } from "./ResponseBoxes";
import { useMediaUrl, useThumbnailUrl } from "./useMediaUrl";
import VirtualResponseGrid from "./VirtualResponseGrid";
import useStore from "./store";

const AXIS_KEYS = ["rows", "cols", "split"] as const;
type AxisKey = (typeof AXIS_KEYS)[number];

// Layout sizes, in px. Text cards have a fixed height (set by the Lines
// slider), so every item fills an identical slot and the grid's layout can be
// computed without measuring anything.
const ITEM_GAP = 4;
const CELL_GAP = 8;
const SECTION_GAP = 16;
const TEXT_LINE_HEIGHT = 17;
const TEXT_CARD_PADDING = 6;
const BADGE_SPACE = 14;

/**
 * Tint for a heat level. Numeric scores shade from pale to strong blue (one
 * hue, so order reads without relying on red/green); pass/fail uses green and
 * red, the convention for outcomes.
 */
function heatColor(
  level: number | undefined,
  scale: HeatScale | undefined,
): string | undefined {
  if (level === undefined || !scale) return undefined;
  if (scale.kind === "passfail")
    return level >= 0.5 ? "rgba(47, 158, 68, 0.3)" : "rgba(224, 49, 49, 0.3)";
  return `rgba(34, 139, 230, ${(0.08 + 0.52 * level).toFixed(3)})`;
}

/**
 * A score badge. Pass/fail scores are green or red, so they can be told apart
 * at a glance whatever the cards are colored by; other scores are dark.
 */
const ScoreBadge: React.FC<{ label?: string; outcome?: boolean }> = ({
  label,
  outcome,
}) =>
  label === undefined ? null : (
    <span
      style={{
        position: "absolute",
        top: 3,
        right: 3,
        maxWidth: "85%",
        padding: "0 4px",
        borderRadius: 3,
        background:
          outcome === true
            ? "rgba(43, 138, 62, 0.9)"
            : outcome === false
              ? "rgba(201, 42, 42, 0.9)"
              : "rgba(0, 0, 0, 0.6)",
        color: "#fff",
        fontSize: 10,
        lineHeight: "15px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        pointerEvents: "none",
      }}
    >
      {label}
    </span>
  );

interface CellItemProps {
  size: number;
  badge?: string;
  /** Whether the badge's score is a pass (true) or fail (false), if either. */
  badgeOutcome?: boolean;
  tint?: string;
  onOpen: () => void;
}

const GridThumbnail: React.FC<
  CellItemProps & { item: Extract<GridItem, { kind: "image" }> }
> = ({ item, size, badge, badgeOutcome, tint, onOpen }) => {
  // Only mounted while near the visible region (VirtualResponseGrid), so the
  // thumbnail can load straight away, and is released when scrolled far off.
  const { url, status } = useThumbnailUrl(item.uid);
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open larger view"
      style={{
        position: "relative",
        width: size,
        height: size,
        padding: 0,
        border: tint
          ? `3px solid ${tint}`
          : "1px solid rgba(128, 128, 128, 0.25)",
        borderRadius: 4,
        background: "rgba(128, 128, 128, 0.08)",
        cursor: "pointer",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : status === "error" ? (
        <Text size="xs" color="dimmed">
          Unavailable
        </Text>
      ) : null}
      <ScoreBadge label={badge} outcome={badgeOutcome} />
    </button>
  );
};

const TextCard: React.FC<
  CellItemProps & {
    item: Extract<GridItem, { kind: "text" }>;
    lines: number;
    height: number;
    /** Tints the card with its model's color (see .cf-grid-card-model). */
    modelColor?: string;
  }
> = ({
  item,
  size,
  lines,
  height,
  badge,
  badgeOutcome,
  tint,
  modelColor,
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    title={
      reasoningAt(item.response, item.index)
        ? "Open full response and reasoning"
        : "Open full response"
    }
    className={modelColor ? "cf-grid-card-model" : undefined}
    style={{
      ...(modelColor
        ? ({ "--cf-model-color": modelColor } as React.CSSProperties)
        : {
            border: "1px solid rgba(128, 128, 128, 0.25)",
            background: tint ?? "rgba(128, 128, 128, 0.06)",
          }),
      position: "relative",
      boxSizing: "border-box",
      // Text needs more width than an image thumbnail to be readable.
      width: Math.round(size * 1.6),
      // Fixed, so every card fills the same slot, even for short text.
      height,
      padding: `${TEXT_CARD_PADDING}px 8px`,
      borderRadius: 4,
      color: "inherit",
      font: "inherit",
      textAlign: "left",
      verticalAlign: "top",
      cursor: "pointer",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        marginTop: badge ? BADGE_SPACE : 0,
        fontSize: 12,
        lineHeight: `${TEXT_LINE_HEIGHT}px`,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {item.text}
    </div>
    <ScoreBadge label={badge} outcome={badgeOutcome} />
    {/* Marks a response with reasoning, which opening it shows */}
    {reasoningAt(item.response, item.index) && (
      <span className="cf-grid-reasoning-mark" aria-label="Has reasoning">
        💭
      </span>
    )}
  </button>
);

export interface ResponseLightboxProps {
  items: GridItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  accessors: GridAccessors;
  modelLabel: string;
  metrics: string[];
}

/** A larger view of one response, with its scores, model, variables and prompt. */
export const ResponseLightbox: React.FC<ResponseLightboxProps> = ({
  items,
  index,
  onIndexChange,
  accessors,
  modelLabel,
  metrics,
}) => {
  const item = index !== null ? items[index] : undefined;
  const { url } = useMediaUrl(item?.kind === "image" ? item.uid : undefined);

  const step = useCallback(
    (delta: number) => {
      if (index === null || items.length === 0) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  const response = item?.response;
  const reasoning =
    item && response ? reasoningAt(response, item.index) : undefined;
  // Prompt variables: text as text, images as thumbnails (their value is only
  // a file id). Other media (documents) are left out.
  const vars: [string, React.ReactNode][] = response
    ? Object.entries(response.vars ?? {}).flatMap(
        ([name, raw]): [string, React.ReactNode][] => {
          if (typeof raw !== "object" || raw === null)
            return [[name, accessors.valueOf(response, name) ?? ""]];
          return raw.t === "img"
            ? [
                [
                  name,
                  <MediaThumbnail key={raw.d} mediaUID={raw.d} size={96} />,
                ],
              ]
            : [];
        },
      )
    : [];
  const scores = item
    ? metrics
        .map((metric) => [metric, metricValue(item, metric)] as const)
        .filter(([, value]) => value !== undefined)
    : [];

  return (
    <Modal
      opened={item !== undefined}
      onClose={() => onIndexChange(null)}
      title={index !== null ? `Response ${index + 1} of ${items.length}` : ""}
      size="xl"
      centered
    >
      {item && response && (
        <Flex direction="column" gap="sm">
          <Flex align="center" gap="xs">
            <ActionIcon
              aria-label="Previous response"
              onClick={() => step(-1)}
              disabled={items.length < 2}
            >
              <IconChevronLeft />
            </ActionIcon>
            <Box style={{ flex: 1, minWidth: 0 }}>
              {item.kind === "image" ? (
                <Box
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    minHeight: 240,
                  }}
                >
                  {url && (
                    <img
                      src={url}
                      alt=""
                      style={{
                        maxWidth: "100%",
                        maxHeight: "65vh",
                        objectFit: "contain",
                      }}
                    />
                  )}
                </Box>
              ) : (
                <Box
                  style={{
                    maxHeight: "55vh",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    fontSize: 14,
                    lineHeight: 1.5,
                    padding: "8px 10px",
                    border: "1px solid rgba(128, 128, 128, 0.25)",
                    borderRadius: 4,
                  }}
                >
                  {item.text}
                </Box>
              )}
            </Box>
            <ActionIcon
              aria-label="Next response"
              onClick={() => step(1)}
              disabled={items.length < 2}
            >
              <IconChevronRight />
            </ActionIcon>
          </Flex>
          {reasoning && (
            <details className="cf-lightbox-reasoning">
              <summary>💭 Reasoning</summary>
              <div className="cf-lightbox-reasoning-text">{reasoning}</div>
            </details>
          )}
          {scores.map(([metric, value]) => (
            <Text size="sm" key={"score-" + metric}>
              <b>{metric}:</b>{" "}
              {typeof value === "string"
                ? value
                : value !== undefined && formatScore(value)}
            </Text>
          ))}
          <Text size="sm">
            <b>{modelLabel}:</b> {accessors.modelOf(response)}
          </Text>
          {vars.map(([name, value]) => (
            <Text size="sm" key={name}>
              <b>{name}:</b> {value}
            </Text>
          ))}
          {typeof response.prompt === "string" && response.prompt && (
            <Text size="sm" color="dimmed" style={{ whiteSpace: "pre-wrap" }}>
              {response.prompt.length > 2000
                ? response.prompt.slice(0, 2000) + "…"
                : response.prompt}
            </Text>
          )}
        </Flex>
      )}
    </Modal>
  );
};

/** A small key for the heatmap coloring. */
/** A control with its label beside it, to keep the toolbar to one short row. */
const InlineField: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Flex align="center" gap={6} wrap="nowrap">
    <Text size="xs" color="dimmed" style={{ whiteSpace: "nowrap" }}>
      {label}
    </Text>
    {children}
  </Flex>
);

const HeatLegend: React.FC<{ metric: string; scale: HeatScale }> = ({
  metric,
  scale,
}) => (
  <Flex align="center" gap={6}>
    <Text size="xs" color="dimmed">
      {metric}:
    </Text>
    {scale.kind === "numeric" ? (
      <>
        <Text size="xs">{formatScore(scale.min)}</Text>
        <div
          style={{
            width: 64,
            height: 8,
            borderRadius: 2,
            background: `linear-gradient(to right, ${heatColor(0, scale)}, ${heatColor(1, scale)})`,
          }}
        />
        <Text size="xs">{formatScore(scale.max)}</Text>
      </>
    ) : (
      <>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: heatColor(1, scale),
          }}
        />
        <Text size="xs">pass</Text>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: heatColor(0, scale),
          }}
        />
        <Text size="xs">fail</Text>
      </>
    )}
  </Flex>
);

export interface ResponseGridViewProps {
  responses: LLMResponse[];
  modelOf: (response: LLMResponse) => string;
  /** What to call the model axis, e.g. "LLM". */
  modelLabel: string;
  wideFormat?: boolean;
  /** Don't color text responses by model, e.g. in nodes that turn it off. */
  disableModelColors?: boolean;
}

/** "Color by" value for coloring text responses by their model. */
const MODEL_COLORS = "$model";

/** Which color each model's responses have, as dots with names. */
const ModelLegend: React.FC<{ models: string[]; colors: Dict<string> }> = ({
  models,
  colors,
}) => (
  <Flex align="center" gap={10} wrap="wrap">
    {models.map((model) => (
      <Flex key={model} align="center" gap={0}>
        <span
          className="cf-model-dot"
          style={{ backgroundColor: colors[model] ?? "gray" }}
        />
        <Text size="xs" color="dimmed">
          {model}
        </Text>
      </Flex>
    ))}
  </Flex>
);

interface FormatSettings {
  itemSize?: number;
  lines?: number;
  showControls?: boolean;
}

/** Grid View settings, saved in the node's data as `grid_settings`. */
interface GridSettings {
  /** Axes the user chose; unset to follow the defaults. */
  axes?: GridAxes;
  filters?: Dict<string>;
  /**
   * MODEL_COLORS, a metric (heatmap), or "" for no coloring. Unset to color by
   * model, or by the first metric where model colors are off.
   */
  colorBy?: string;
  // Sizes differ between the wide inspector modal and narrow drawers and nodes.
  wide?: FormatSettings;
  narrow?: FormatSettings;
}

/** A little shorter than Mantine's smallest ("xs", 30px) select. */
export const COMPACT_SELECT_STYLES = {
  input: {
    height: 26,
    minHeight: 26,
    lineHeight: "24px",
    fontSize: 12,
    paddingLeft: 8,
  },
};

const ResponseGridView: React.FC<ResponseGridViewProps> = ({
  responses,
  modelOf,
  modelLabel,
  wideFormat,
  disableModelColors,
}) => {
  const theme = useMantineTheme();
  const accessors: GridAccessors = useMemo(
    () => ({
      modelOf,
      valueOf: (r, name) =>
        r.vars && name in r.vars
          ? llmResponseDataToString(r.vars[name])
          : undefined,
      textOf: llmResponseDataToString,
    }),
    [modelOf],
  );

  const items = useMemo(
    () => collectGridItems(responses, accessors),
    [responses, accessors],
  );
  const { vars, mediaVars, models } = useMemo(
    () => gridAxisOptions(items, accessors),
    [items, accessors],
  );
  const metrics = useMemo(() => scoreMetrics(items), [items]);
  const hasText = items.some((item) => item.kind === "text");
  const hasImages = items.some((item) => item.kind === "image");

  // Settings are saved in the node's data, so they survive closing the
  // inspector, switching tabs, re-running the node and reloading the flow.
  // They're read once, when the grid appears.
  const nodeId = useNodeId();
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const readSaved = (): GridSettings =>
    (nodeId
      ? (useStore.getState().getNode(nodeId)?.data?.grid_settings as
          | GridSettings
          | undefined)
      : undefined) ?? {};
  const formatKey = wideFormat ? "wide" : "narrow";
  const [saved] = useState(readSaved);
  const savedFormat = saved[formatKey] ?? {};

  // What the user chose is kept even while a variable or metric is missing,
  // e.g. mid-run, when the previous responses are briefly cleared.
  const [chosenAxes, setChosenAxes] = useState<GridAxes | undefined>(
    saved.axes,
  );
  const [chosenFilters, setFilters] = useState<Dict<string>>(
    saved.filters ?? {},
  );
  const [chosenColor, setChosenColor] = useState<string | undefined>(
    saved.colorBy,
  );
  const [itemSize, setItemSize] = useState(
    savedFormat.itemSize ?? (wideFormat ? 140 : 72),
  );
  const [lines, setLines] = useState(savedFormat.lines ?? (wideFormat ? 4 : 3));
  // In narrow inspectors (drawers, Inspect Nodes) the controls would take most
  // of the height, so they start hidden behind a toggle.
  const [showControls, setShowControls] = useState(
    savedFormat.showControls ?? Boolean(wideFormat),
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // The defaults until the user picks axes, then the chosen axes whose
  // variables are present (see resolveGridAxes).
  const available = useMemo(
    () => new Set([...vars, ...mediaVars, MODEL_AXIS]),
    [vars, mediaVars],
  );
  const axes = useMemo(
    () => resolveGridAxes(chosenAxes, vars, models.length, mediaVars),
    [chosenAxes, vars, models.length, mediaVars],
  );
  const filters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(chosenFilters).filter(([axis]) => available.has(axis)),
      ),
    [chosenFilters, available],
  );
  // Text responses are colored by model, as elsewhere in ChainForge, unless
  // the user picks a metric (a heatmap) or none (""). Images aren't colored
  // by model, which would distract from them.
  const modelColorsOn = !disableModelColors && hasText;
  const colorBy =
    chosenColor === "" ||
    (chosenColor === MODEL_COLORS && modelColorsOn) ||
    (chosenColor !== undefined && metrics.includes(chosenColor))
      ? chosenColor
      : modelColorsOn
        ? MODEL_COLORS
        : metrics[0] ?? "";
  const heatMetric = colorBy === MODEL_COLORS ? "" : colorBy;

  // Models' colors, shared across ChainForge. A model without one is given
  // one after rendering, since that changes the store.
  const llmColors = useStore((state) => state.llmColors);
  const getColorForLLMAndSetIfNotFound = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );
  useEffect(() => {
    if (!disableModelColors)
      models.forEach((model) => getColorForLLMAndSetIfNotFound(model));
  }, [models, disableModelColors]);

  // Save changes once they settle, since sliders change many times a second;
  // or straight away if the grid closes first.
  const settingsKey = JSON.stringify([
    chosenAxes,
    chosenFilters,
    chosenColor,
    itemSize,
    lines,
    showControls,
  ]);
  const savedKey = useRef(settingsKey);
  const pendingSave = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!nodeId || settingsKey === savedKey.current) return;
    const save = () => {
      pendingSave.current = null;
      savedKey.current = settingsKey;
      const current = readSaved();
      const next: GridSettings = {
        ...current,
        axes: chosenAxes,
        filters: chosenFilters,
        colorBy: chosenColor,
        [formatKey]: { ...current[formatKey], itemSize, lines, showControls },
      };
      // Round-trip through JSON to drop unset fields.
      setDataPropsForNode(nodeId, {
        grid_settings: JSON.parse(JSON.stringify(next)),
      });
    };
    pendingSave.current = save;
    const timer = setTimeout(save, 400);
    return () => clearTimeout(timer);
  }, [settingsKey]);
  useEffect(() => () => pendingSave.current?.(), []);

  const setAxis = (key: AxisKey, value: string) => {
    const next: GridAxes = { ...axes, [key]: value || undefined };
    // An axis can only be used once.
    for (const other of AXIS_KEYS)
      if (other !== key && value && next[other] === value)
        next[other] = undefined;
    setChosenAxes(next);
    // A variable on an axis can't also be a filter.
    if (value)
      setFilters((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([a]) => a !== value)),
      );
  };

  const labelOf = (axis: string) => (axis === MODEL_AXIS ? modelLabel : axis);
  const axisChoices = [
    { value: "", label: "None" },
    ...vars.map((v) => ({ value: v, label: v })),
    ...mediaVars.map((v) => ({ value: v, label: v })),
    { value: MODEL_AXIS, label: modelLabel },
  ];
  // Headers for an image variable show the image, since its value is a file
  // id. (Image variables aren't offered as filters, for the same reason.)
  const isMediaAxis = (axis?: string) =>
    axis !== undefined && mediaVars.includes(axis);
  const rowsAreImages = isMediaAxis(axes.rows);
  const colsAreImages = isMediaAxis(axes.cols);
  const splitIsImages = isMediaAxis(axes.split);
  const headerThumbSize = wideFormat ? 96 : 48;
  const titleThumbSize = wideFormat ? 48 : 28;

  // Variables not on an axis can narrow the grid to one value.
  const onAxes = new Set(AXIS_KEYS.map((k) => axes[k]).filter(Boolean));
  const filterAxes = [
    ...vars,
    ...(models.length > 1 ? [MODEL_AXIS] : []),
  ].filter((a) => !onAxes.has(a));

  const grid = useMemo(
    () => buildGrid(items, axes, filters, accessors),
    [items, axes, filters, accessors],
  );
  const indexOf = useMemo(
    () => new Map(grid.ordered.map((item, i) => [item, i])),
    [grid],
  );

  // Badges show the heatmap's metric, or the first one otherwise.
  const badgeMetric = heatMetric || metrics[0];
  const scale = useMemo(
    () => (heatMetric ? heatScaleFor(items, heatMetric) : undefined),
    [items, heatMetric],
  );
  const decorate = (item: GridItem) => {
    const badgeValue = badgeMetric ? metricValue(item, badgeMetric) : undefined;
    return {
      badge: badgeValue !== undefined ? formatScore(badgeValue) : undefined,
      badgeOutcome: passFail(badgeValue),
      tint:
        scale && heatMetric
          ? heatColor(heatLevel(metricValue(item, heatMetric), scale), scale)
          : undefined,
      modelColor:
        colorBy === MODEL_COLORS
          ? llmColors[accessors.modelOf(item.response)]
          : undefined,
    };
  };

  const noun = hasImages && !hasText ? "image" : "response";
  const countText =
    grid.ordered.length === items.length
      ? `${items.length} ${noun}${items.length === 1 ? "" : "s"}`
      : `${grid.ordered.length} of ${items.length} ${noun}s`;

  // Shown beside the collapsed controls, so the layout is readable without
  // opening them.
  const numFilters = Object.values(filters).filter(Boolean).length;
  const layoutSummary = [
    [axes.rows, axes.cols]
      .filter((a): a is string => Boolean(a))
      .map(labelOf)
      .join(" × ") || "No axes",
    axes.split ? `split by ${labelOf(axes.split)}` : "",
    numFilters ? `${numFilters} filter${numFilters === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const sz = wideFormat ? "sm" : "xs";
  const hasRows = Boolean(axes.rows);
  const hasCols = Boolean(axes.cols);

  // Every item fills the same slot, so VirtualResponseGrid can compute where
  // everything goes and render only what's near the visible region.
  const cardWidth = Math.round(itemSize * 1.6);
  const cardHeight =
    2 * TEXT_CARD_PADDING +
    2 + // border
    (metrics.length > 0 ? BADGE_SPACE : 0) +
    lines * TEXT_LINE_HEIGHT;
  // Column headers wrap onto up to 3 lines. The header row is as tall as the
  // longest value needs, estimated from its length, since every column is at
  // least one slot wide.
  const colHeaderLineHeight = wideFormat ? 17 : 14;

  // Row labels are as wide as the longest needs (estimated from its length),
  // up to a cap past which long values (e.g. queries) wrap.
  const rowLabelWidth = useMemo(() => {
    if (!hasRows) return 0;
    if (rowsAreImages) return headerThumbSize + 14;
    const longest = Math.max(0, ...grid.rowValues.map((v) => v.length));
    const [charWidth, min, max] = wideFormat ? [7.5, 48, 220] : [6.5, 40, 110];
    return Math.min(max, Math.max(min, Math.ceil(longest * charWidth) + 14));
  }, [hasRows, rowsAreImages, headerThumbSize, grid, wideFormat]);
  const headerLines = useMemo(() => {
    if (!hasCols) return 0;
    const slotWidth = hasText
      ? Math.max(cardWidth, hasImages ? itemSize : 0)
      : itemSize;
    const charsPerLine = Math.max(
      6,
      Math.floor((slotWidth - 8) / (wideFormat ? 7 : 6)),
    );
    const longest = Math.max(0, ...grid.colValues.map((v) => v.length));
    return Math.min(3, Math.max(1, Math.ceil(longest / charsPerLine)));
  }, [hasCols, hasText, hasImages, cardWidth, itemSize, wideFormat, grid]);

  const layoutOptions: Omit<LayoutOptions, "wrapWidth"> = useMemo(
    () => ({
      slotWidth: hasText
        ? Math.max(cardWidth, hasImages ? itemSize : 0)
        : itemSize,
      slotHeight: hasText
        ? Math.max(cardHeight, hasImages ? itemSize : 0)
        : itemSize,
      itemGap: ITEM_GAP,
      cellGap: CELL_GAP,
      rowHeaderWidth: rowLabelWidth,
      headerHeight: hasCols
        ? (colsAreImages
            ? headerThumbSize
            : headerLines * colHeaderLineHeight) + 6
        : 0,
      titleHeight: axes.split
        ? splitIsImages
          ? titleThumbSize + 8
          : wideFormat
            ? 28
            : 22
        : 0,
      sectionGap: SECTION_GAP,
      wrap: !hasRows && !hasCols,
    }),
    [
      hasText,
      hasImages,
      cardWidth,
      cardHeight,
      itemSize,
      hasRows,
      hasCols,
      wideFormat,
      axes.split,
      headerLines,
      colHeaderLineHeight,
      rowLabelWidth,
      colsAreImages,
      splitIsImages,
      headerThumbSize,
      titleThumbSize,
    ],
  );

  return (
    <div>
      {!wideFormat && (
        <Flex align="center" gap={6} mb={6} wrap="nowrap">
          <Button
            compact
            size="xs"
            variant={showControls ? "light" : "subtle"}
            leftIcon={<IconAdjustmentsHorizontal size={12} />}
            onClick={() => setShowControls((shown) => !shown)}
            aria-expanded={showControls}
          >
            Layout
          </Button>
          <Text
            size="xs"
            color="dimmed"
            truncate
            title={`${layoutSummary} · ${countText}`}
          >
            {layoutSummary} · {countText}
          </Text>
        </Flex>
      )}
      {/* One compact toolbar, since space above the grid is scarce. */}
      <Flex
        align="center"
        columnGap="sm"
        rowGap={6}
        wrap="wrap"
        mb={wideFormat ? "xs" : 6}
      >
        {showControls && (
          <>
            {AXIS_KEYS.map((key) => (
              <InlineField
                key={key}
                label={
                  { rows: "Rows", cols: "Columns", split: "Split by" }[key]
                }
              >
                <NativeSelect
                  aria-label={
                    { rows: "Rows", cols: "Columns", split: "Split by" }[key]
                  }
                  value={axes[key] ?? ""}
                  onChange={(e) => setAxis(key, e.currentTarget.value)}
                  data={axisChoices}
                  size="xs"
                  styles={COMPACT_SELECT_STYLES}
                  w={wideFormat ? 120 : 100}
                />
              </InlineField>
            ))}
            {filterAxes.map((axis) => (
              <InlineField key={"filter-" + axis} label={labelOf(axis)}>
                <NativeSelect
                  aria-label={labelOf(axis)}
                  value={filters[axis] ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setFilters((prev) => ({ ...prev, [axis]: value }));
                  }}
                  data={[
                    { value: "", label: "All" },
                    ...axisValues(items, axis, accessors).map((v) => ({
                      value: v,
                      label: v,
                    })),
                  ]}
                  size="xs"
                  styles={COMPACT_SELECT_STYLES}
                  w={wideFormat ? 120 : 90}
                />
              </InlineField>
            ))}
            {(metrics.length > 0 || modelColorsOn) && (
              <InlineField label="Color by">
                <NativeSelect
                  aria-label="Color by"
                  value={colorBy}
                  onChange={(e) => setChosenColor(e.currentTarget.value)}
                  // Model colors, or a metric as a heatmap.
                  data={[
                    ...(modelColorsOn
                      ? [{ value: MODEL_COLORS, label: modelLabel }]
                      : []),
                    { value: "", label: "None" },
                    ...metrics.map((m) => ({ value: m, label: m })),
                  ]}
                  size="xs"
                  styles={COMPACT_SELECT_STYLES}
                  w={wideFormat ? 120 : 90}
                />
              </InlineField>
            )}
            <InlineField label="Size">
              <Slider
                aria-label="Size"
                min={48}
                max={320}
                step={8}
                value={itemSize}
                onChange={setItemSize}
                size="xs"
                label={null}
                w={wideFormat ? 100 : 80}
              />
            </InlineField>
            {hasText && (
              <InlineField label={`Lines: ${lines}`}>
                <Slider
                  aria-label="Lines"
                  min={1}
                  max={20}
                  step={1}
                  value={lines}
                  onChange={setLines}
                  size="xs"
                  label={null}
                  w={wideFormat ? 100 : 80}
                />
              </InlineField>
            )}
          </>
        )}
        {wideFormat && (
          <Text size="xs" color="dimmed">
            {countText}
          </Text>
        )}
        {scale && heatMetric && (
          <HeatLegend metric={heatMetric} scale={scale} />
        )}
        {colorBy === MODEL_COLORS && models.length > 1 && (
          <ModelLegend models={models} colors={llmColors} />
        )}
      </Flex>

      {items.length === 0 ? (
        <Text size="xs" color="dimmed">
          No responses to show.
        </Text>
      ) : (
        <VirtualResponseGrid
          grid={grid}
          options={layoutOptions}
          pinnedBackground={
            theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white
          }
          renderTitle={(section) => (
            <Text size={sz} weight={500}>
              {axes.split ? labelOf(axes.split) : ""} ={" "}
              {splitIsImages &&
              section.value !== undefined &&
              section.value !== UNSPECIFIED ? (
                <MediaThumbnail
                  mediaUID={section.value}
                  size={titleThumbSize}
                />
              ) : (
                section.value
              )}
            </Text>
          )}
          // Centered over the column, which can hold several responses, and
          // wrapped onto up to 3 lines (full value on hover).
          renderColumnHeader={(value) =>
            colsAreImages && value !== UNSPECIFIED ? (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <MediaThumbnail mediaUID={value} size={headerThumbSize} />
              </div>
            ) : (
              <div
                title={value}
                style={{
                  fontSize: wideFormat ? 13 : 11,
                  fontWeight: 500,
                  lineHeight: `${colHeaderLineHeight}px`,
                  textAlign: "center",
                  overflowWrap: "anywhere",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 3,
                  overflow: "hidden",
                }}
              >
                {value}
              </div>
            )
          }
          // Wraps onto as many lines as the row has room for, and scrolls for
          // the rest, so long values (e.g. queries) can be read and compared.
          renderRowHeader={(value, maxHeight) =>
            rowsAreImages && value !== UNSPECIFIED ? (
              <MediaThumbnail
                mediaUID={value}
                size={Math.min(headerThumbSize, maxHeight)}
              />
            ) : (
              <div
                className="nowheel"
                title={value}
                style={{
                  fontSize: wideFormat ? 13 : 11,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  maxHeight,
                  overflowY: "auto",
                }}
              >
                {value}
              </div>
            )
          }
          renderItem={(item) => {
            const i = indexOf.get(item) ?? 0;
            const open = () => setLightboxIndex(i);
            const { badge, badgeOutcome, tint, modelColor } = decorate(item);
            return item.kind === "image" ? (
              <GridThumbnail
                item={item}
                size={itemSize}
                onOpen={open}
                badge={badge}
                badgeOutcome={badgeOutcome}
                tint={tint}
              />
            ) : (
              <TextCard
                item={item}
                size={itemSize}
                height={cardHeight}
                lines={lines}
                onOpen={open}
                badge={badge}
                badgeOutcome={badgeOutcome}
                tint={tint}
                modelColor={modelColor}
              />
            );
          }}
        />
      )}

      <ResponseLightbox
        items={grid.ordered}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        accessors={accessors}
        modelLabel={modelLabel}
        metrics={metrics}
      />
    </div>
  );
};

export default ResponseGridView;
