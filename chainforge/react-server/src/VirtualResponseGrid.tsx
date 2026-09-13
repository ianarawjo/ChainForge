/**
 * Renders a response grid, placing only the headers and items near the
 * visible region. Large grids (thousands of text cards, tens of thousands of
 * px wide) otherwise put so many elements on the page that scrolling stutters.
 *
 * Every item has the same slot size, so where everything goes is computed up
 * front (see layoutGrid); nothing needs measuring, and the scroll position
 * never jumps as items come and go.
 *
 * Headers stay readable while scrolling a large grid: section titles and row
 * headers stick to the visible left edge, column headers to the visible top of
 * their section, and each header's label centers on the visible part of its
 * row or column.
 */
import React, {
  RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Grid,
  GridItem,
  GridSection,
  LayoutOptions,
  Rect,
  intersects,
  layoutGrid,
  visibleItemIndices,
} from "./backend/responseGrid";

/** The visible region is tracked in steps of this many px, so a re-render only
 * happens when scrolling changes which items are near, not on every pixel. */
const REGION_STEP = 256;

/** Before the first measurement, render this much, so something shows at once. */
const INITIAL_REGION: Rect = { left: 0, top: 0, right: 2048, bottom: 2048 };

const sameRect = (a: Rect, b: Rect) =>
  a.left === b.left &&
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom;

/** Every ancestor that scrolls or clips an element. */
function scrollingAncestors(el: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (
    let p = el.parentElement;
    p && p !== document.body;
    p = p.parentElement
  ) {
    const style = getComputedStyle(p);
    if (/auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY))
      found.push(p);
  }
  return found;
}

/**
 * The part of an element that's actually on screen, in the element's own
 * (unzoomed) px coordinates: the viewport clipped by every scrolling or
 * clipping ancestor (the inspector modal, the grid's horizontal scroller, a
 * React Flow node). Undefined when nothing of it is visible.
 */
function visibleArea(
  el: HTMLElement,
  clippers: HTMLElement[],
): Rect | undefined {
  let left = 0;
  let top = 0;
  let right = window.innerWidth;
  let bottom = window.innerHeight;
  for (const clipper of clippers) {
    const r = clipper.getBoundingClientRect();
    left = Math.max(left, r.left);
    top = Math.max(top, r.top);
    right = Math.min(right, r.right);
    bottom = Math.min(bottom, r.bottom);
  }
  if (right <= left || bottom <= top) return undefined;

  const box = el.getBoundingClientRect();
  // A zoomed React Flow canvas draws the grid at a different size than its layout.
  const scale =
    el.offsetWidth > 0 && box.width > 0 ? box.width / el.offsetWidth : 1;
  return {
    left: (left - box.left) / scale,
    top: (top - box.top) / scale,
    right: (right - box.left) / scale,
    bottom: (bottom - box.top) / scale,
  };
}

/** Clamps a label's center so the label stays within its row or column. */
const clampCenter = (center: number, halfLabel: number, span: number) =>
  halfLabel * 2 >= span
    ? span / 2
    : Math.min(Math.max(center, halfLabel), span - halfLabel);

/**
 * The visible part of an element plus about a screen's worth of margin on
 * each side, stepped (see REGION_STEP), in the element's own px coordinates.
 */
function useVisibleRegion(ref: RefObject<HTMLElement>): Rect {
  const [region, setRegion] = useState<Rect>(INITIAL_REGION);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clippers = scrollingAncestors(el);

    let frame = 0;
    const update = () => {
      frame = 0;
      const area = visibleArea(el, clippers);
      // Collapsed or hidden (e.g. a closed drawer): keep what's rendered.
      if (!area) return;
      const marginX = Math.max(400, area.right - area.left);
      const marginY = Math.max(400, area.bottom - area.top);
      const step = (v: number, round: (n: number) => number) =>
        round(v / REGION_STEP) * REGION_STEP;
      const next: Rect = {
        left: step(area.left - marginX, Math.floor),
        top: step(area.top - marginY, Math.floor),
        right: step(area.right + marginX, Math.ceil),
        bottom: step(area.bottom + marginY, Math.ceil),
      };
      setRegion((prev) => (sameRect(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    // Capture, to hear scrolls of any ancestor.
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const resizes =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : undefined;
    resizes?.observe(el);
    clippers.forEach((clipper) => resizes?.observe(clipper));

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      resizes?.disconnect();
    };
  }, [ref]);

  return region;
}

/** An element's content width, kept up to date. */
function useWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const resizes = new ResizeObserver(() => setWidth(el.clientWidth));
    resizes.observe(el);
    return () => resizes.disconnect();
  }, [ref]);
  return width;
}

/**
 * Keeps the placed headers of `contentRef` in view while scrolling: see the
 * data-pin attributes set in VirtualResponseGrid. Moves them with direct
 * style changes, once per frame, so scrolling doesn't re-render the grid.
 */
function usePinnedHeaders(contentRef: RefObject<HTMLElement>, width: number) {
  const pinRef = useRef<() => void>(() => undefined);

  pinRef.current = () => {
    const content = contentRef.current;
    if (!content) return;
    const area = visibleArea(content, scrollingAncestors(content));
    if (!area) return;

    content.querySelectorAll<HTMLElement>("[data-pin]").forEach((box) => {
      const d = box.dataset;
      const x = Number(d.x);
      const y = Number(d.y);
      const w = Number(d.w);
      const h = Number(d.h);
      const label = box.firstElementChild as HTMLElement | null;
      const sectionBottom = Number(d.bottom);
      // Where a header pinned to the left edge starts, and one pinned to the
      // top of a section (starting at `top`, `height` tall) starts.
      const pinnedX = (w: number) =>
        Math.max(0, Math.min(area.left, width - w));
      const pinnedY = (top: number, height: number) =>
        top +
        Math.max(0, Math.min(area.top - top, sectionBottom - top - height));

      if (d.pin === "title") {
        box.style.transform = `translateX(${pinnedX(box.offsetWidth)}px)`;
      } else if (d.pin === "column") {
        box.style.transform = `translateY(${pinnedY(y, h) - y}px)`;
        // Center the label on the part of the column that's visible and not
        // covered by the pinned row headers.
        const rowHeaderWidth = Number(d.cover);
        const from = Math.max(
          x,
          area.left,
          rowHeaderWidth > 0
            ? pinnedX(rowHeaderWidth) + rowHeaderWidth
            : -Infinity,
        );
        const to = Math.min(x + w, area.right);
        if (label && to > from)
          label.style.left = `${clampCenter((from + to) / 2 - x, label.offsetWidth / 2, w)}px`;
      } else if (d.pin === "row") {
        box.style.transform = `translateX(${pinnedX(w) - x}px)`;
        // Center the label on the part of the row that's visible and not
        // covered by the pinned column headers.
        const headerY = Number(d.headerY);
        const headerHeight = Number(d.headerHeight);
        const from = Math.max(
          y,
          area.top,
          headerHeight > 0
            ? pinnedY(headerY, headerHeight) + headerHeight
            : -Infinity,
        );
        const to = Math.min(y + h, area.bottom);
        if (label && to > from)
          label.style.top = `${clampCenter((from + to) / 2 - y, label.offsetHeight / 2, h)}px`;
      }
    });
  };

  // After every render, since headers may have been placed or moved.
  useLayoutEffect(() => pinRef.current());

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          pinRef.current();
        });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);
}

export interface VirtualResponseGridProps {
  grid: Grid;
  /** Layout sizes; the wrap width is measured here. */
  options: Omit<LayoutOptions, "wrapWidth">;
  renderItem: (item: GridItem) => React.ReactNode;
  renderTitle: (section: GridSection) => React.ReactNode;
  renderColumnHeader: (value: string) => React.ReactNode;
  renderRowHeader: (value: string) => React.ReactNode;
  /** Background behind pinned headers, so cards scrolling under them don't show through. */
  pinnedBackground?: string;
}

const VirtualResponseGrid: React.FC<VirtualResponseGridProps> = ({
  grid,
  options,
  renderItem,
  renderTitle,
  renderColumnHeader,
  renderRowHeader,
  pinnedBackground,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollerWidth = useWidth(scrollerRef);
  const region = useVisibleRegion(contentRef);

  const layoutOptions: LayoutOptions = useMemo(
    () => ({
      ...options,
      wrapWidth: Math.max(options.slotWidth, scrollerWidth),
    }),
    [options, scrollerWidth],
  );
  const layout = useMemo(
    () => layoutGrid(grid, layoutOptions),
    [grid, layoutOptions],
  );
  usePinnedHeaders(contentRef, layout.width);

  const placed: React.ReactNode[] = [];
  const pitchX = layoutOptions.slotWidth + layoutOptions.itemGap;
  const pitchY = layoutOptions.slotHeight + layoutOptions.itemGap;
  const { headerHeight, rowHeaderWidth, titleHeight } = layoutOptions;

  layout.sections.forEach((sec, s) => {
    const section = grid.sections[s];
    const lastRow = sec.rowY.length - 1;
    const sectionBottom =
      lastRow >= 0
        ? sec.rowY[lastRow] + sec.rowHeight[lastRow]
        : sec.headerY + headerHeight;

    // Pinned headers are placed by their rows' vertical position or their
    // columns' horizontal one alone, since pinning moves them along the other
    // axis to wherever the user has scrolled.
    if (
      sec.titleY !== undefined &&
      intersects(region, region.left, sec.titleY, 1, titleHeight)
    )
      placed.push(
        <div
          key={`title-${s}`}
          data-pin="title"
          style={{
            position: "absolute",
            left: 0,
            top: sec.titleY,
            height: titleHeight,
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            paddingRight: 8,
            background: pinnedBackground,
            zIndex: 3,
          }}
        >
          {renderTitle(section)}
        </div>,
      );

    if (headerHeight > 0)
      grid.colValues.forEach((value, c) => {
        const x = sec.colX[c];
        const w = sec.colWidth[c];
        if (!intersects(region, x, sec.headerY, w, sectionBottom - sec.headerY))
          return;
        placed.push(
          <div
            key={`col-${s}-${c}`}
            data-pin="column"
            data-x={x}
            data-y={sec.headerY}
            data-w={w}
            data-h={headerHeight}
            data-bottom={sectionBottom}
            data-cover={rowHeaderWidth}
            style={{
              position: "absolute",
              left: x,
              top: sec.headerY,
              width: w,
              height: headerHeight,
              overflow: "hidden",
              background: pinnedBackground,
              zIndex: 1,
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 2,
                left: w / 2,
                transform: "translateX(-50%)",
                maxWidth: w,
                whiteSpace: "nowrap",
              }}
            >
              {renderColumnHeader(value)}
            </div>
          </div>,
        );
      });

    if (rowHeaderWidth > 0)
      grid.rowValues.forEach((value, r) => {
        const y = sec.rowY[r];
        const h = sec.rowHeight[r];
        if (!intersects(region, region.left, y, 1, h)) return;
        placed.push(
          <div
            key={`row-${s}-${r}`}
            data-pin="row"
            data-x={0}
            data-y={y}
            data-w={rowHeaderWidth}
            data-h={h}
            data-bottom={sectionBottom}
            data-header-y={sec.headerY}
            data-header-height={headerHeight}
            style={{
              position: "absolute",
              left: 0,
              top: y,
              width: rowHeaderWidth,
              height: h,
              overflow: "hidden",
              background: pinnedBackground,
              // Above the column headers, which slide under them.
              zIndex: 2,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: h / 2,
                transform: "translateY(-50%)",
                width: rowHeaderWidth - 6,
              }}
            >
              {renderRowHeader(value)}
            </div>
          </div>,
        );
      });

    for (const cell of sec.cells) {
      const items = section.cells[cell.row][cell.col];
      for (const i of visibleItemIndices(cell, layoutOptions, region)) {
        const item = items[i];
        placed.push(
          <div
            key={`item-${item.response.uid}-${item.index}`}
            style={{
              position: "absolute",
              left: cell.x + (i % cell.perRow) * pitchX,
              top: cell.y + Math.floor(i / cell.perRow) * pitchY,
            }}
          >
            {renderItem(item)}
          </div>,
        );
      }
    }
  });

  return (
    <div ref={scrollerRef} style={{ overflowX: "auto" }}>
      <div
        ref={contentRef}
        style={{
          position: "relative",
          width: layout.width,
          height: layout.height,
        }}
      >
        {placed}
      </div>
    </div>
  );
};

export default VirtualResponseGrid;
