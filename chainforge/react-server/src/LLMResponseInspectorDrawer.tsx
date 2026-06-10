import React, { useRef } from "react";
import LLMResponseInspector from "./LLMResponseInspector";
import { LLMResponse } from "./backend/typing";
import ResizeHandle from "./ResizeHandle";

export interface LLMResponseInspectorDrawerProps {
  jsonResponses: LLMResponse[];
  showDrawer: boolean;
}

export default function LLMResponseInspectorDrawer({
  jsonResponses,
  showDrawer,
}: LLMResponseInspectorDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="inspect-responses-drawer"
      style={{ display: showDrawer ? "initial" : "none" }}
    >
      <div
        ref={containerRef}
        className="inspect-response-container nowheel nodrag"
        style={{ margin: "0px 10px 10px 12px" }}
      >
        <LLMResponseInspector
          jsonResponses={jsonResponses}
          isOpen={showDrawer}
          wideFormat={false}
        />
        <ResizeHandle targetRef={containerRef} minWidth={150} minHeight={270} />
      </div>
    </div>
  );
}
