import React, { useState } from 'react';
import styled from 'styled-components';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@reactflow/core';
import useStore from './store';  

const EdgePathContainer = styled.g`
  path:nth-child(2) {
    pointer-events: all; 
    &:hover {
        & + .edgebutton {
            // Make add node button visible
            visibility: visible;
        }
    }
}`;

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
}) {

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

  const onEdgeClick = (evt, id) => {
    evt.stopPropagation();
    removeEdge(id);
  };

  // Thanks in part to oshanley https://github.com/wbkd/react-flow/issues/1211#issuecomment-1585032930
  return (
    <EdgePathContainer onPointerEnter={()=>setHovering(true)} onPointerLeave={()=>setHovering(false)}>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{...style, stroke: (hovering ? '#000' : '#999')}} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
            visibility: hovering ? 'inherit' : 'hidden',
          }}
          className="nodrag nopan"
        >
          <button className="remove-edge-btn" onClick={(event) => onEdgeClick(event, id)}>
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </EdgePathContainer>
  );
}