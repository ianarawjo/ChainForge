/**
 * A fullscreen version of the Inspect node that
 * appears in a Mantine modal pop-up which takes up much of the screen.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  lazy,
  Suspense,
  useContext,
} from "react";
import { LoadingOverlay, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { exportToExcel } from "./LLMResponseInspector";
import { LLMResponse } from "./backend/typing";
import { AlertModalContext } from "./AlertModal";

// Lazy load the inspector view
const LLMResponseInspector = lazy(() => import("./LLMResponseInspector"));

export interface LLMResponseInspectorModalRef {
  trigger: () => void;
}

export interface LLMResponseInspectorModalProps {
  jsonResponses: LLMResponse[];
}

const LLMResponseInspectorModal = forwardRef<
  LLMResponseInspectorModalRef,
  LLMResponseInspectorModalProps
>(function LLMResponseInspectorModal(props, ref) {
  // const inspectorRef = useRef(null);
  const [opened, { open, close }] = useDisclosure(false);
  const showAlert = useContext(AlertModalContext);
  // const [openedOnce, setOpenedOnce] = useState(false);

  // This gives the parent access to triggering the modal
  const trigger = () => {
    open();
    // if (inspectorRef.current) inspectorRef.current.triggerRedraw();
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
            onClick={() => {
              try {
                exportToExcel(props.jsonResponses);
              } catch (e) {
                close();
                showAlert && showAlert(e as Error);
              }
            }}
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
        <Suspense fallback={<LoadingOverlay visible={true} />}>
          <LLMResponseInspector
            jsonResponses={props.jsonResponses}
            wideFormat={true}
          />
        </Suspense>
      </div>
    </Modal>
  );
});

export default LLMResponseInspectorModal;
