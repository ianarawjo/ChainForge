/**
 * Renders a response grid, placing only the headers and items near the
 * visible region. Large grids (thousands of text cards, tens of thousands of
 * px wide) otherwise put so many elements on the page that scrolling stutters.
 *
 * Every item has the same slot size, so where everything goes is computed up
 * front (see layoutGrid); nothing needs measuring, and the scroll position
 * never jumps as items come and go.
 *
 * The grid scrolls in both directions inside its own box, which fills the
 * space left in its scrolling container (the inspector modal or node). That
 * lets headers use CSS sticky positioning: section titles and row headers
 * stick to the left edge, column headers to the top, and the browser moves
 * them in step with scrolling. (Moving them from JS lags behind, since the
 * browser scrolls on another thread.)
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

/** The grid's box is never shorter than this, even in a small container. */
const MIN_HEIGHT = 240;

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
 * The visible part of an element plus about a screen's worth of margin on
 * each side, stepped (see REGION_STEP), in the element's own px coordinates.
 * Visible means within the viewport and every scrolling or clipping ancestor,
 * corrected for a zoomed React Flow canvas.
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
      // Collapsed or hidden (e.g. a closed drawer): keep what's rendered.
      if (right <= left || bottom <= top) return;

      const box = el.getBoundingClientRect();
      const scale =
        el.offsetWidth > 0 && box.width > 0 ? box.width / el.offsetWidth : 1;
      const marginX = Math.max(400, (right - left) / scale);
      const marginY = Math.max(400, (bottom - top) / scale);
      const step = (v: number, round: (n: number) => number) =>
        round(v / REGION_STEP) * REGION_STEP;
      const next: Rect = {
        left: step((left - box.left) / scale - marginX, Math.floor),
        top: step((top - box.top) / scale - marginY, Math.floor),
        right: step((right - box.left) / scale + marginX, Math.ceil),
        bottom: step((bottom - box.top) / scale + marginY, Math.ceil),
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

/** The nearest ancestor that scrolls vertically within a bounded height. */
function boundedScrollParent(el: HTMLElement): HTMLElement | undefined {
  for (
    let p = el.parentElement;
    p && p !== document.body;
    p = p.parentElement
  ) {
    const style = getComputedStyle(p);
    if (
      /auto|scroll/.test(style.overflowY) &&
      (style.maxHeight !== "none" || p.scrollHeight > p.clientHeight + 1)
    )
      return p;
  }
  return undefined;
}

/**
 * The tallest an element can be while its bottom stays within its scrolling
 * container's visible height (with the container scrolled to the top), so
 * the container doesn't need scrolling to reach the element's own scrollbar.
 */
function useFitHeight(ref: RefObject<HTMLElement>): number | undefined {
  const [height, setHeight] = useState<number>();
  const measureRef = useRef<() => void>(() => undefined);

  measureRef.current = () => {
    const el = ref.current;
    if (!el) return;
    const outer = boundedScrollParent(el);
    if (!outer) return;
    const outerBox = outer.getBoundingClientRect();
    // Hidden (e.g. a closed drawer).
    if (outerBox.height === 0 || outer.offsetHeight === 0) return;
    const scale = outerBox.height / outer.offsetHeight;
    // Where the element starts within the container's scrolled content.
    const top =
      (el.getBoundingClientRect().top - outerBox.top) / scale +
      outer.scrollTop -
      outer.clientTop;
    // Space taken below the element by the bottom padding, borders and
    // horizontal scrollbars of the boxes around it.
    let below = 0;
    for (let p = el.parentElement; p; p = p.parentElement) {
      below += parseFloat(getComputedStyle(p).paddingBottom) || 0;
      if (p === outer) break;
      if (p.clientHeight > 0)
        below += p.offsetHeight - p.clientHeight - p.clientTop;
    }
    const next = Math.max(
      MIN_HEIGHT,
      Math.floor(outer.clientHeight - top - below),
    );
    setHeight((prev) => (prev === next ? prev : next));
  };

  // After every render, since controls above may have grown or shrunk.
  useLayoutEffect(() => measureRef.current());

  useEffect(() => {
    const el = ref.current;
    const outer = el && boundedScrollParent(el);
    const measure = () => measureRef.current();
    window.addEventListener("resize", measure);
    const resizes =
      outer && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : undefined;
    if (outer) resizes?.observe(outer);
    return () => {
      window.removeEventListener("resize", measure);
      resizes?.disconnect();
    };
  }, [ref]);

  return height;
}

export interface VirtualResponseGridProps {
  grid: Grid;
  /** Layout sizes; the wrap width is measured here. */
  options: Omit<LayoutOptions, "wrapWidth">;
  renderItem: (item: GridItem) => React.ReactNode;
  renderTitle: (section: GridSection) => React.ReactNode;
  renderColumnHeader: (value: string) => React.ReactNode;
  /**
   * A row's label. `maxHeight` is the room the row gives it, so a long label
   * (e.g. a query) can show several lines and scroll for the rest.
   */
  renderRowHeader: (value: string, maxHeight: number) => React.ReactNode;
  /** Background behind sticky headers, so cards scrolling under them don't show through. */
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
  const maxHeight = useFitHeight(scrollerRef);
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

  const placed: React.ReactNode[] = [];
  const pitchX = layoutOptions.slotWidth + layoutOptions.itemGap;
  const pitchY = layoutOptions.slotHeight + layoutOptions.itemGap;
  const { headerHeight, rowHeaderWidth, titleHeight } = layoutOptions;

  // Sticky headers sit in tracks spanning the whole grid width (or a whole
  // section's height), which bound how far they can stick. Tracks let clicks
  // through to the cards beneath; only the headers themselves take them.
  const track = (
    top: number,
    height: number,
    zIndex: number,
  ): React.CSSProperties => ({
    position: "absolute",
    left: 0,
    top,
    width: layout.width,
    height,
    zIndex,
    pointerEvents: "none",
  });

  layout.sections.forEach((sec, s) => {
    const section = grid.sections[s];
    const lastRow = sec.rowY.length - 1;
    const sectionBottom =
      lastRow >= 0
        ? sec.rowY[lastRow] + sec.rowHeight[lastRow]
        : sec.headerY + headerHeight;

    if (
      sec.titleY !== undefined &&
      intersects(region, region.left, sec.titleY, 1, titleHeight)
    )
      placed.push(
        <div key={`title-${s}`} style={track(sec.titleY, titleHeight, 3)}>
          <div
            style={{
              position: "sticky",
              left: 0,
              width: "max-content",
              height: titleHeight,
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              paddingRight: 8,
              background: pinnedBackground,
              pointerEvents: "auto",
            }}
          >
            {renderTitle(section)}
          </div>
        </div>,
      );

    // Above the row headers, which slide under it.
    if (
      headerHeight > 0 &&
      intersects(
        region,
        region.left,
        sec.headerY,
        1,
        sectionBottom - sec.headerY,
      )
    )
      placed.push(
        <div
          key={`cols-${s}`}
          style={track(sec.headerY, sectionBottom - sec.headerY, 3)}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              height: headerHeight,
              background: pinnedBackground,
              pointerEvents: "auto",
            }}
          >
            {rowHeaderWidth > 0 && (
              // Covers column headers where they pass under the row headers.
              <div
                style={{
                  position: "sticky",
                  left: 0,
                  width: rowHeaderWidth,
                  height: headerHeight,
                  background: pinnedBackground,
                  zIndex: 1,
                }}
              />
            )}
            {grid.colValues.map((value, c) => {
              const x = sec.colX[c];
              const w = sec.colWidth[c];
              if (!intersects(region, x, region.top, w, 1)) return null;
              return (
                <div
                  key={c}
                  style={{
                    position: "absolute",
                    left: x,
                    top: 0,
                    width: w,
                    height: headerHeight,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  {/* Centered over the column, but kept in view while any of it
                      is. Long values wrap (the header row is as tall as the
                      longest needs, up to a few lines). */}
                  <div
                    style={{
                      position: "sticky",
                      left: rowHeaderWidth,
                      right: 0,
                      maxWidth: Math.max(0, w - 8),
                      paddingBottom: 2,
                    }}
                  >
                    {renderColumnHeader(value)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
      );

    if (rowHeaderWidth > 0)
      grid.rowValues.forEach((value, r) => {
        const y = sec.rowY[r];
        const h = sec.rowHeight[r];
        if (!intersects(region, region.left, y, 1, h)) return;
        placed.push(
          <div key={`row-${s}-${r}`} style={track(y, h, 2)}>
            <div
              style={{
                position: "sticky",
                left: 0,
                width: rowHeaderWidth,
                height: h,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: pinnedBackground,
                pointerEvents: "auto",
              }}
            >
              {/* Centered in the row, but kept in view (below the column
                  headers) while any of the row is. */}
              <div
                style={{
                  position: "sticky",
                  top: headerHeight,
                  bottom: 0,
                  width: rowHeaderWidth - 6,
                }}
              >
                {renderRowHeader(value, Math.max(20, h - 8))}
              </div>
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
    <div ref={scrollerRef} style={{ overflow: "auto", maxHeight }}>
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
