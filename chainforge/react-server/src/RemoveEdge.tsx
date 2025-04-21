import React, { useState } from "react";
import styled from "styled-components";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@reactflow/core";
import useStore from "./store";
import { Position } from "reactflow";
import { Dict } from "./backend/typing";
import { useMantineColorScheme } from "@mantine/core";

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
  const removeEdge = useStore((state) => state.removeEdge);

  // Color theme
  const { colorScheme } = useMantineColorScheme();

  const onEdgeClick = (
    evt: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    evt.stopPropagation();
    removeEdge(id);
  };

  // Thanks in part to oshanley https://github.com/wbkd/react-flow/issues/1211#issuecomment-1585032930
  return (
    <EdgePathContainer
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
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
            visibility: hovering ? "inherit" : "hidden",
          }}
          className="nodrag nopan"
        >
          <button
            className="remove-edge-btn"
            onClick={(event) => onEdgeClick(event, id)}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </EdgePathContainer>
  );
}
