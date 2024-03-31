import React from "react";
import LLMResponseInspector from "./LLMResponseInspector";
import { LLMResponse } from "./backend/typing";

export interface LLMResponseInspectorDrawerProps {
  jsonResponses: LLMResponse[];
  showDrawer: boolean;
}

export default function LLMResponseInspectorDrawer({
  jsonResponses,
  showDrawer,
}: LLMResponseInspectorDrawerProps) {
  return (
    <div
      className="inspect-responses-drawer"
      style={{ display: showDrawer ? "initial" : "none" }}
    >
      <div
        className="inspect-response-container nowheel nodrag"
        style={{ margin: "0px 10px 10px 12px" }}
      >
        <LLMResponseInspector
          jsonResponses={jsonResponses}
          wideFormat={false}
        />
      </div>
    </div>
  );
}
