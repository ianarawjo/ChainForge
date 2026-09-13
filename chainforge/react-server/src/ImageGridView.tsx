/**
 * The response inspector's image grid: images laid out on rows and columns of
 * prompt variables (or the model), optionally repeated per value of a third
 * "split by" axis, with the remaining variables as filters.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActionIcon,
  Box,
  Flex,
  Modal,
  NativeSelect,
  Slider,
  Text,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Dict, LLMResponse } from "./backend/typing";
import { llmResponseDataToString } from "./backend/utils";
import {
  buildImageGrid,
  collectImages,
  defaultGridAxes,
  GridAccessors,
  GridAxes,
  GridImage,
  gridAxisOptions,
  axisValues,
  MODEL_AXIS,
} from "./backend/imageGrid";
import { useMediaUrl, useNearViewport, useThumbnailUrl } from "./useMediaUrl";

const AXIS_KEYS = ["rows", "cols", "split"] as const;
type AxisKey = (typeof AXIS_KEYS)[number];

interface GridThumbnailProps {
  image: GridImage;
  size: number;
  onOpen: () => void;
}

const GridThumbnail: React.FC<GridThumbnailProps> = ({
  image,
  size,
  onOpen,
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const near = useNearViewport(ref);
  const { url, status } = useThumbnailUrl(image.uid, near);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      title="Open larger view"
      style={{
        width: size,
        height: size,
        padding: 0,
        border: "1px solid rgba(128,128,128,0.25)",
        borderRadius: 4,
        background: "rgba(128,128,128,0.08)",
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
    </button>
  );
};

interface ImageLightboxProps {
  images: GridImage[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  accessors: GridAccessors;
  modelLabel: string;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  index,
  onIndexChange,
  accessors,
  modelLabel,
}) => {
  const image = index !== null ? images[index] : undefined;
  const { url } = useMediaUrl(image?.uid);

  const step = useCallback(
    (delta: number) => {
      if (index === null || images.length === 0) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
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

  const response = image?.response;
  // Prompt variables with text values; media inputs would only show a file id.
  const vars = response
    ? Object.entries(response.vars ?? {})
        .filter(([, raw]) => !(typeof raw === "object" && raw !== null))
        .map(([name]) => [name, accessors.valueOf(response, name) ?? ""])
    : [];

  return (
    <Modal
      opened={image !== undefined}
      onClose={() => onIndexChange(null)}
      title={index !== null ? `Image ${index + 1} of ${images.length}` : ""}
      size="xl"
      centered
    >
      {response && (
        <Flex direction="column" gap="sm">
          <Flex align="center" gap="xs">
            <ActionIcon
              aria-label="Previous image"
              onClick={() => step(-1)}
              disabled={images.length < 2}
            >
              <IconChevronLeft />
            </ActionIcon>
            <Box
              style={{
                flex: 1,
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
            <ActionIcon
              aria-label="Next image"
              onClick={() => step(1)}
              disabled={images.length < 2}
            >
              <IconChevronRight />
            </ActionIcon>
          </Flex>
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

export interface ImageGridViewProps {
  responses: LLMResponse[];
  modelOf: (response: LLMResponse) => string;
  /** What to call the model axis, e.g. "LLM". */
  modelLabel: string;
  wideFormat?: boolean;
}

const ImageGridView: React.FC<ImageGridViewProps> = ({
  responses,
  modelOf,
  modelLabel,
  wideFormat,
}) => {
  const accessors: GridAccessors = useMemo(
    () => ({
      modelOf,
      valueOf: (r, name) =>
        r.vars && name in r.vars
          ? llmResponseDataToString(r.vars[name])
          : undefined,
    }),
    [modelOf],
  );

  const images = useMemo(() => collectImages(responses), [responses]);
  const { vars, models } = useMemo(
    () => gridAxisOptions(images, accessors),
    [images, accessors],
  );

  const [axes, setAxes] = useState<GridAxes>(() =>
    defaultGridAxes(vars, models.length),
  );
  const [userChoseAxes, setUserChoseAxes] = useState(false);
  const [filters, setFilters] = useState<Dict<string>>({});
  const [thumbSize, setThumbSize] = useState(wideFormat ? 140 : 72);
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
    () => buildImageGrid(images, axes, filters, accessors),
    [images, axes, filters, accessors],
  );
  const indexOf = useMemo(
    () => new Map(grid.ordered.map((img, i) => [img, i])),
    [grid],
  );

  const sz = wideFormat ? "sm" : "xs";
  const hasRows = Boolean(axes.rows);
  const hasCols = Boolean(axes.cols);
  const headerStyle: React.CSSProperties = {
    fontSize: wideFormat ? 13 : 11,
    fontWeight: 500,
    maxWidth: 180,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div>
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
              ...axisValues(images, axis, accessors).map((v) => ({
                value: v,
                label: v,
              })),
            ]}
            size={sz}
            w={wideFormat ? 160 : 100}
          />
        ))}
        <Box w={wideFormat ? 160 : 100} pb={6}>
          <Text size={sz}>Size</Text>
          <Slider
            min={48}
            max={320}
            step={8}
            value={thumbSize}
            onChange={setThumbSize}
            size="sm"
            label={null}
          />
        </Box>
      </Flex>

      <Text size="xs" color="dimmed" mb="xs">
        {grid.ordered.length === images.length
          ? `${images.length} image${images.length === 1 ? "" : "s"}`
          : `${grid.ordered.length} of ${images.length} images`}
      </Text>

      <div style={{ overflowX: "auto" }}>
        {grid.sections.map((section, s) => (
          <div key={"section-" + s} style={{ marginBottom: 16 }}>
            {axes.split && (
              <Text size={sz} weight={500} mb={4}>
                {labelOf(axes.split)} = {section.value}
              </Text>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `${hasRows ? "max-content " : ""}repeat(${grid.colValues.length}, max-content)`,
                gap: 6,
                alignItems: "start",
              }}
            >
              {hasCols && (
                <>
                  {hasRows && <div />}
                  {grid.colValues.map((col) => (
                    <div key={"col-" + col} style={headerStyle} title={col}>
                      {col}
                    </div>
                  ))}
                </>
              )}
              {grid.rowValues.map((row, r) => (
                <React.Fragment key={"row-" + r}>
                  {hasRows && (
                    <div
                      style={{ ...headerStyle, alignSelf: "center" }}
                      title={row}
                    >
                      {row}
                    </div>
                  )}
                  {grid.colValues.map((col, c) => (
                    <div
                      key={"cell-" + r + "-" + c}
                      style={{
                        display: "flex",
                        gap: 4,
                        flexWrap: hasRows || hasCols ? "nowrap" : "wrap",
                        minWidth: thumbSize,
                        minHeight: thumbSize,
                      }}
                    >
                      {section.cells[r][c].map((img) => (
                        <GridThumbnail
                          key={img.uid + "-" + indexOf.get(img)}
                          image={img}
                          size={thumbSize}
                          onOpen={() => setLightboxIndex(indexOf.get(img) ?? 0)}
                        />
                      ))}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ImageLightbox
        images={grid.ordered}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        accessors={accessors}
        modelLabel={modelLabel}
      />
    </div>
  );
};

export default ImageGridView;
