import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useStore as useReactFlowStore,
} from "@reactflow/core";
import useStore from "./store";
import { Position } from "reactflow";
import { Dict } from "./backend/typing";
import { Popover, useMantineColorScheme } from "@mantine/core";
import { useEdgePreview, useEdgeScores } from "./useEdgePreview";
import { EdgePreviewBadge, EdgePreviewCard } from "./EdgePreviewCard";

// How long the pointer must rest on an edge before the preview card opens,
// so that cards don't flash open while panning across the canvas.
const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 140;
// Below this zoom the badges would be unreadable clutter, so they're hidden.
const MIN_BADGE_ZOOM = 0.55;

const EdgePathContainer = styled.g`
  path {
    stroke: #999;
    transition: stroke 0.2s;
    pointer-events: all;
    &:hover {
      stroke: #000;
    }
  }
`;

export interface CustomEdgeProps {
  id: string;
  source: string;
  target: string;
  sourceHandleId?: string | null;
  targetHandleId?: string | null;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  style: Dict;
  markerEnd?: string;
}

export default function CustomEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: CustomEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [hovering, setHovering] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const removeEdge = useStore((state) => state.removeEdge);

  // Color theme
  const { colorScheme } = useMantineColorScheme();

  // What this edge is carrying. Selecting only the boolean keeps edges from
  // re-rendering on every pan and on zooms that don't cross the threshold.
  const preview = useEdgePreview(source, sourceHandleId);
  const badgeVisible = useReactFlowStore(
    (s) => s.transform[2] >= MIN_BADGE_ZOOM,
  );
  // Read only while the card is open, so a re-run's scores are picked up the
  // next time someone looks rather than needing the edge to re-render.
  const scores = useEdgeScores(source, cardOpen && (preview?.scored ?? false));

  // Open the card on a deliberate hover, and keep it open while the pointer
  // travels from the edge onto the card itself.
  //
  // NOTE: These run more than once per pointer event. They sit on both the
  // path and the label, and the label is a React child of the path's <g>
  // (through EdgeLabelRenderer's portal), so React reports the same enter or
  // leave to both. Every entry point therefore clears both timers before
  // arming its own, and opening re-checks that the pointer is still here:
  // a timer left over from a duplicate call used to open the card after the
  // pointer had already left, with no leave left to close it again.
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const isHovering = useRef(false);
  const clearTimers = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);
  const onPointerEnter = useCallback(() => {
    clearTimers();
    isHovering.current = true;
    setHovering(true);
    openTimer.current = setTimeout(() => {
      if (isHovering.current) setCardOpen(true);
    }, OPEN_DELAY_MS);
  }, [clearTimers]);
  const onPointerLeave = useCallback(() => {
    clearTimers();
    isHovering.current = false;
    closeTimer.current = setTimeout(() => {
      setHovering(false);
      setCardOpen(false);
    }, CLOSE_DELAY_MS);
  }, [clearTimers]);
  useEffect(() => clearTimers, [clearTimers]);

  const onEdgeClick = (
    evt: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    evt.stopPropagation();
    removeEdge(id);
  };

  // Thicker edges carry more data. Log-scaled, as counts fan out fast.
  const strokeWidth = useMemo(() => {
    if (style.strokeWidth !== undefined) return style.strokeWidth;
    const n = preview?.count ?? 0;
    if (n === 0) return 1.2;
    return Math.min(1.2 + 0.55 * Math.log10(n), 3.4);
  }, [style.strokeWidth, preview?.count]);

  const hoverPointerProps = { onPointerEnter, onPointerLeave };
  const showBadge = preview !== null && badgeVisible;

  // Thanks in part to oshanley https://github.com/wbkd/react-flow/issues/1211#issuecomment-1585032930
  return (
    <EdgePathContainer {...hoverPointerProps}>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth,
          // An edge with nothing in it fades back, reading as provisional
          // rather than broken. (Not a dash: React Flow already dashes the
          // edges ChainForge marks as animated.)
          strokeOpacity: preview?.kind === "empty" ? 0.4 : undefined,
          stroke: hovering
            ? colorScheme === "light"
              ? "#000"
              : "#eee"
            : "#999",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
          {...hoverPointerProps}
        >
          {showBadge && (
            <Popover
              opened={cardOpen}
              position="top"
              offset={8}
              radius="md"
              shadow="md"
              withinPortal
              withArrow
              transitionProps={{ duration: 100 }}
            >
              <Popover.Target>
                <div>
                  <EdgePreviewBadge preview={preview} active={hovering} />
                </div>
              </Popover.Target>
              <Popover.Dropdown
                p={0}
                className="nodrag nowheel"
                {...hoverPointerProps}
              >
                <EdgePreviewCard preview={preview} scores={scores} />
              </Popover.Dropdown>
            </Popover>
          )}
          <button
            className="remove-edge-btn"
            onClick={(event) => onEdgeClick(event, id)}
            style={{
              // Sits beside the badge, so showing it doesn't shift the badge
              // off the middle of the edge.
              ...(showBadge
                ? {
                    position: "absolute",
                    left: "100%",
                    top: "50%",
                    transform: "translate(4px, -50%)",
                  }
                : {}),
              visibility: hovering ? "visible" : "hidden",
            }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </EdgePathContainer>
  );
}
