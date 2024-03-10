/**
 * A fullscreen version of the Inspect node that
 * appears in a Mantine modal pop-up which takes up much of the screen.
 */
import React, { forwardRef, useImperativeHandle } from "react";
import { Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import LLMResponseInspector, { exportToExcel } from "./LLMResponseInspector";
import { StandardizedLLMResponse } from "./backend/typing";

export interface LLMResponseInspectorModalRef {
  trigger: () => void;
}

export interface LLMResponseInspectorModalProps {
  jsonResponses: StandardizedLLMResponse[];
}

const LLMResponseInspectorModal = forwardRef<
  LLMResponseInspectorModalRef,
  LLMResponseInspectorModalProps
>(function LLMResponseInspectorModal({ jsonResponses }, ref) {
  const [opened, { open, close }] = useDisclosure(false);

  // This gives the parent access to triggering the modal
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal
      size="90%"
      keepMounted
      opened={opened}
      onClose={close}
      closeOnClickOutside={true}
      style={{ position: "relative", left: "-5%" }}
      title={
        <div>
          <span>Response Inspector</span>
          <button
            className="custom-button"
            style={{ marginTop: "auto", marginRight: "14px", float: "right" }}
            onClick={() => exportToExcel(jsonResponses)}
          >
            Export data to Excel
          </button>
        </div>
      }
      styles={{ title: { justifyContent: "space-between", width: "100%" } }}
    >
      <div
        className="inspect-modal-response-container"
        style={{ padding: "6px", overflow: "scroll" }}
      >
        <LLMResponseInspector jsonResponses={jsonResponses} wideFormat={true} />
      </div>
    </Modal>
  );
});

export default LLMResponseInspectorModal;
