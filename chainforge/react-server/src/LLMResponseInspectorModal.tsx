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
  useState,
} from "react";
import { LoadingOverlay, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { exportToExcel } from "./LLMResponseInspector";
import { LLMResponse } from "./backend/typing";
import { AlertModalContext } from "./AlertModal";

// Lazy load the inspector view
const LLMResponseInspector = lazy(() => import("./LLMResponseInspector"));

export interface LLMResponseInspectorModalRef {
  /** Opens the modal, on the given tab if one is named (e.g. "judges"). */
  trigger: (viewFormat?: string) => void;
}

export interface LLMResponseInspectorModalProps {
  jsonResponses: LLMResponse[];
  customLLMFieldName?: string;
  disableBackgroundColor?: boolean;
  treatLLMFieldAsUnique?: boolean;
  ignoreAndHideLLMField?: boolean; // If true, LLM field will not be shown in the table view
  ignoreAndHideEvalResField?: boolean; // If true, "Eval Res" column option will not be shown in the table view
  defaultTableColVar?: string;
  /** Content for a "Judges" tab; see LLMResponseInspector. */
  judgesPanel?: React.ReactNode;
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
  const [requestedView, setRequestedView] = useState<string | undefined>(
    undefined,
  );
  const trigger = (viewFormat?: string) => {
    if (viewFormat) setRequestedView(viewFormat);
    open();
    // if (inspectorRef.current) inspectorRef.current.triggerRedraw();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal
      size="100%"
      keepMounted
      opened={opened}
      onClose={close}
      closeOnClickOutside={true}
      title={
        <div>
          <button
            className="custom-button"
            style={{
              marginTop: "auto",
              marginRight: "14px",
              float: "right",
              pointerEvents: "all",
            }}
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
      styles={{
        // A fixed height, the modal's maximum, rather than fitting the
        // content: the Grid View fills the space it's given, so it can't also
        // set the height.
        content: { height: "calc(100dvh - (5dvh * 2))" },
        title: {
          justifyContent: "space-between",
          width: "100%",
          padding: "0px",
        },
        header: {
          paddingBottom: "0px",
          paddingTop: "12px",
          marginBottom: "-24px",
          backgroundColor: "transparent",
          pointerEvents: "none",
        },
        close: { pointerEvents: "all" },
      }}
    >
      <div
        className="inspect-modal-response-container"
        style={{ padding: "0px", overflow: "scroll" }}
      >
        <Suspense fallback={<LoadingOverlay visible={true} />}>
          <LLMResponseInspector
            jsonResponses={props.jsonResponses}
            isOpen={opened}
            wideFormat={true}
            customLLMFieldName={props.customLLMFieldName}
            disableBackgroundColor={props.disableBackgroundColor}
            treatLLMFieldAsUnique={props.treatLLMFieldAsUnique}
            ignoreAndHideLLMField={props.ignoreAndHideLLMField}
            ignoreAndHideEvalResField={props.ignoreAndHideEvalResField}
            defaultTableColVar={props.defaultTableColVar}
            judgesPanel={props.judgesPanel}
            viewFormat={requestedView}
            onViewFormatChange={
              requestedView !== undefined ? setRequestedView : undefined
            }
          />
        </Suspense>
      </div>
    </Modal>
  );
});

export default LLMResponseInspectorModal;
