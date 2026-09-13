/**
 * The response inspector's grid view: responses (text or images) laid out on
 * rows and columns of prompt variables (or the model), optionally repeated per
 * value of a third "split by" axis, with the remaining variables as filters.
 * Scored responses show a badge, and can be tinted by a metric like a heatmap.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { llmResponseDataToString } from "./backend/utils";
import {
  axisValues,
  buildGrid,
  collectGridItems,
  defaultGridAxes,
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
  scoreMetrics,
} from "./backend/responseGrid";
import { useMediaUrl, useThumbnailUrl } from "./useMediaUrl";
import VirtualResponseGrid from "./VirtualResponseGrid";

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

const ScoreBadge: React.FC<{ label?: string }> = ({ label }) =>
  label === undefined ? null : (
    <span
      style={{
        position: "absolute",
        top: 3,
        right: 3,
        maxWidth: "85%",
        padding: "0 4px",
        borderRadius: 3,
        background: "rgba(0, 0, 0, 0.6)",
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
  tint?: string;
  onOpen: () => void;
}

const GridThumbnail: React.FC<
  CellItemProps & { item: Extract<GridItem, { kind: "image" }> }
> = ({ item, size, badge, tint, onOpen }) => {
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
      <ScoreBadge label={badge} />
    </button>
  );
};

const TextCard: React.FC<
  CellItemProps & {
    item: Extract<GridItem, { kind: "text" }>;
    lines: number;
    height: number;
  }
> = ({ item, size, lines, height, badge, tint, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    title="Open full response"
    style={{
      position: "relative",
      boxSizing: "border-box",
      // Text needs more width than an image thumbnail to be readable.
      width: Math.round(size * 1.6),
      // Fixed, so every card fills the same slot, even for short text.
      height,
      padding: `${TEXT_CARD_PADDING}px 8px`,
      border: "1px solid rgba(128, 128, 128, 0.25)",
      borderRadius: 4,
      background: tint ?? "rgba(128, 128, 128, 0.06)",
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
    <ScoreBadge label={badge} />
  </button>
);

interface ResponseLightboxProps {
  items: GridItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  accessors: GridAccessors;
  modelLabel: string;
  metrics: string[];
}

const ResponseLightbox: React.FC<ResponseLightboxProps> = ({
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
  // Prompt variables with text values; media inputs would only show a file id.
  const vars = response
    ? Object.entries(response.vars ?? {})
        .filter(([, raw]) => !(typeof raw === "object" && raw !== null))
        .map(([name]) => [name, accessors.valueOf(response, name) ?? ""])
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
}

const ResponseGridView: React.FC<ResponseGridViewProps> = ({
  responses,
  modelOf,
  modelLabel,
  wideFormat,
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
  const { vars, models } = useMemo(
    () => gridAxisOptions(items, accessors),
    [items, accessors],
  );
  const metrics = useMemo(() => scoreMetrics(items), [items]);
  const hasText = items.some((item) => item.kind === "text");
  const hasImages = items.some((item) => item.kind === "image");

  const [axes, setAxes] = useState<GridAxes>(() =>
    defaultGridAxes(vars, models.length),
  );
  const [userChoseAxes, setUserChoseAxes] = useState(false);
  const [filters, setFilters] = useState<Dict<string>>({});
  const [itemSize, setItemSize] = useState(wideFormat ? 140 : 72);
  const [lines, setLines] = useState(wideFormat ? 4 : 3);
  const [colorBy, setColorBy] = useState(metrics[0] ?? "");
  const [userChoseColor, setUserChoseColor] = useState(false);
  // In narrow inspectors (drawers, Inspect Nodes) the controls would take most
  // of the height, so they start hidden behind a toggle.
  const [showControls, setShowControls] = useState(Boolean(wideFormat));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Follow the defaults as responses change, until the user picks axes; and
  // drop any axis or filter whose variable is no longer present.
  const available = useMemo(() => new Set([...vars, MODEL_AXIS]), [vars]);
  useEffect(() => {
    const stale = AXIS_KEYS.some((k) => {
      const axis = axes[k];
      return axis !== undefined && !available.has(axis);
    });
    if (!userChoseAxes || stale) setAxes(defaultGridAxes(vars, models.length));
    setFilters((prev) => {
      const kept = Object.entries(prev).filter(([axis]) => available.has(axis));
      return kept.length === Object.keys(prev).length
        ? prev
        : Object.fromEntries(kept);
    });
  }, [vars, models.length, available]);

  // Color by the first metric once scores appear, unless the user chose
  // otherwise; and let go of a metric that's no longer present.
  useEffect(() => {
    if (colorBy && !metrics.includes(colorBy)) setColorBy(metrics[0] ?? "");
    else if (!colorBy && !userChoseColor && metrics.length > 0)
      setColorBy(metrics[0]);
  }, [metrics]);

  const setAxis = (key: AxisKey, value: string) => {
    const next: GridAxes = { ...axes, [key]: value || undefined };
    // An axis can only be used once.
    for (const other of AXIS_KEYS)
      if (other !== key && value && next[other] === value)
        next[other] = undefined;
    setAxes(next);
    setUserChoseAxes(true);
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
    { value: MODEL_AXIS, label: modelLabel },
  ];

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

  // Badges show the colored metric, or the first one when not coloring.
  const badgeMetric = colorBy || metrics[0];
  const scale = useMemo(
    () => (colorBy ? heatScaleFor(items, colorBy) : undefined),
    [items, colorBy],
  );
  const decorate = (item: GridItem) => {
    const badgeValue = badgeMetric ? metricValue(item, badgeMetric) : undefined;
    return {
      badge: badgeValue !== undefined ? formatScore(badgeValue) : undefined,
      tint:
        scale && colorBy
          ? heatColor(heatLevel(metricValue(item, colorBy), scale), scale)
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
  const headerStyle: React.CSSProperties = {
    fontSize: wideFormat ? 13 : 11,
    fontWeight: 500,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  // Every item fills the same slot, so VirtualResponseGrid can compute where
  // everything goes and render only what's near the visible region.
  const cardWidth = Math.round(itemSize * 1.6);
  const cardHeight =
    2 * TEXT_CARD_PADDING +
    2 + // border
    (metrics.length > 0 ? BADGE_SPACE : 0) +
    lines * TEXT_LINE_HEIGHT;
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
      rowHeaderWidth: hasRows ? (wideFormat ? 140 : 80) : 0,
      headerHeight: hasCols ? (wideFormat ? 22 : 18) : 0,
      titleHeight: axes.split ? (wideFormat ? 28 : 22) : 0,
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
      {showControls && (
        <Flex gap={sz} wrap="wrap" align="end" mb="sm">
          {AXIS_KEYS.map((key) => (
            <NativeSelect
              key={key}
              label={{ rows: "Rows", cols: "Columns", split: "Split by" }[key]}
              value={axes[key] ?? ""}
              onChange={(e) => setAxis(key, e.currentTarget.value)}
              data={axisChoices}
              size={sz}
              w={wideFormat ? 180 : 110}
            />
          ))}
          {filterAxes.map((axis) => (
            <NativeSelect
              key={"filter-" + axis}
              label={labelOf(axis)}
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
              size={sz}
              w={wideFormat ? 160 : 100}
            />
          ))}
          {metrics.length > 0 && (
            <NativeSelect
              label="Color by"
              value={colorBy}
              onChange={(e) => {
                setColorBy(e.currentTarget.value);
                setUserChoseColor(true);
              }}
              data={[
                { value: "", label: "None" },
                ...metrics.map((m) => ({ value: m, label: m })),
              ]}
              size={sz}
              w={wideFormat ? 160 : 100}
            />
          )}
          <Box w={wideFormat ? 140 : 100} pb={6}>
            <Text size={sz}>Size</Text>
            <Slider
              min={48}
              max={320}
              step={8}
              value={itemSize}
              onChange={setItemSize}
              size="sm"
              label={null}
            />
          </Box>
          {hasText && (
            <Box w={wideFormat ? 140 : 100} pb={6}>
              <Text size={sz}>Lines: {lines}</Text>
              <Slider
                min={1}
                max={20}
                step={1}
                value={lines}
                onChange={setLines}
                size="sm"
                label={null}
              />
            </Box>
          )}
        </Flex>
      )}

      <Flex align="center" gap="md" wrap="wrap" mb="xs">
        {wideFormat && (
          <Text size="xs" color="dimmed">
            {countText}
          </Text>
        )}
        {scale && colorBy && <HeatLegend metric={colorBy} scale={scale} />}
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
              {axes.split ? labelOf(axes.split) : ""} = {section.value}
            </Text>
          )}
          // Centered over the column, which can hold several responses.
          renderColumnHeader={(value) => (
            <div style={{ ...headerStyle, textAlign: "center" }} title={value}>
              {value}
            </div>
          )}
          renderRowHeader={(value) => (
            <div style={headerStyle} title={value}>
              {value}
            </div>
          )}
          renderItem={(item) => {
            const i = indexOf.get(item) ?? 0;
            const open = () => setLightboxIndex(i);
            return item.kind === "image" ? (
              <GridThumbnail
                item={item}
                size={itemSize}
                onOpen={open}
                {...decorate(item)}
              />
            ) : (
              <TextCard
                item={item}
                size={itemSize}
                height={cardHeight}
                lines={lines}
                onOpen={open}
                {...decorate(item)}
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
