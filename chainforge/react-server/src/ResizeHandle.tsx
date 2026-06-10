/**
 * A custom resize handle for use inside ReactFlow nodes.
 *
 * Safari does not support CSS `resize: both` on elements inside CSS
 * `transform`-ed parents (which is how ReactFlow positions nodes).
 * This component replaces that native handle with a JS-driven one.
 *
 * Usage:
 *   <div ref={containerRef} style={{ position: "relative", overflow: "auto", width: 300, height: 200 }}>
 *     ...content...
 *     <ResizeHandle targetRef={containerRef} />
 *   </div>
 */
import React, { useCallback, useRef } from "react";

interface ResizeHandleProps {
  targetRef: React.RefObject<HTMLElement>;
  minWidth?: number;
  minHeight?: number;
  /** Called once when the drag ends. */
  onResizeEnd?: () => void;
}

export default function ResizeHandle({
  targetRef,
  minWidth = 100,
  minHeight = 80,
  onResizeEnd,
}: ResizeHandleProps) {
  const startPos = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const el = targetRef.current;
      if (!el) return;
      startPos.current = {
        x: e.clientX,
        y: e.clientY,
        w: el.offsetWidth,
        h: el.offsetHeight,
      };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [targetRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!startPos.current) return;
      e.stopPropagation();
      const el = targetRef.current;
      if (!el) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      el.style.width = `${Math.max(minWidth, startPos.current.w + dx)}px`;
      el.style.height = `${Math.max(minHeight, startPos.current.h + dy)}px`;
    },
    [targetRef, minWidth, minHeight],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      startPos.current = null;
      if (onResizeEnd) onResizeEnd();
    },
    [onResizeEnd],
  );

  return (
    <div
      title="Drag to resize"
      style={{
        position: "absolute",
        bottom: 0,
        right: 0,
        width: "16px",
        height: "16px",
        cursor: "nwse-resize",
        zIndex: 10,
        // Render a subtle triangular grip (matches native resize handle look)
        background:
          "linear-gradient(135deg, transparent 50%, rgba(120,120,120,0.35) 50%)",
        borderBottomRightRadius: "4px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
