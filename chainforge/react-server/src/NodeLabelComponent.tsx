import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Tooltip } from "@mantine/core";
import { EditText, onSaveProps } from "react-edit-text";
import "react-edit-text/dist/index.css";
import useStore from "./store";
import StatusIndicator, { Status } from "./StatusIndicatorComponent";
import AreYouSureModal, { AreYouSureModalRef } from "./AreYouSureModal";

export interface NodeLabelProps {
  title: string;
  nodeId: string;
  icon: string | JSX.Element;
  onEdit?: () => void;
  onSave?: () => void;
  editable?: boolean;
  status?: Status;
  statusMessage?: string;
  isRunning?: boolean;
  customButtons?: React.ReactNode[];
  handleRunClick?: () => void;
  handleStopClick?: (nodeId: string) => void;
  handleRunHover?: () => void;
  runButtonTooltip?: string;
}

interface DeleteConfirmProps {
  title: string;
  message: string;
  onConfirm: undefined | (() => void);
}

export const NodeLabel: React.FC<NodeLabelProps> = ({
  title,
  nodeId,
  icon,
  onEdit,
  onSave,
  editable,
  status,
  statusMessage,
  isRunning,
  customButtons,
  handleRunClick,
  handleStopClick,
  handleRunHover,
  runButtonTooltip,
}) => {
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const [statusIndicator, setStatusIndicator] = useState(<></>);
  const [runButton, setRunButton] = useState(<></>);
  const removeNode = useStore((state) => state.removeNode);

  // For 'delete node' confirmation popup
  const deleteConfirmModal = useRef<AreYouSureModalRef>(null);
  const [deleteConfirmProps, setDeleteConfirmProps] =
    useState<DeleteConfirmProps>({
      title: "Delete node",
      message: "Are you sure?",
      onConfirm: undefined,
    });
  const stopButton = useMemo(
    () => (
      <button
        className="AmitSahoo45-button-3 nodrag"
        style={{ padding: "0px 10px 0px 9px" }}
        onClick={() => {
          if (handleStopClick) handleStopClick(nodeId);
        }}
      >
        &#9724;
      </button>
    ),
    [handleStopClick, nodeId],
  );

  const handleNodeLabelChange = (evt: onSaveProps) => {
    const { value } = evt;
    title = value;
    setDataPropsForNode(nodeId, { title: value });
    if (onSave) onSave();
  };
  const handleEnterEditMode = () => {
    if (onEdit) onEdit();
  };

  useEffect(() => {
    if (status !== undefined) {
      setStatusIndicator(
        <StatusIndicator status={status} message={statusMessage} />,
      );
    } else {
      setStatusIndicator(<></>);
    }
  }, [status, statusMessage]);

  useEffect(() => {
    if (handleRunClick !== undefined) {
      const run_btn = (
        <button
          className="AmitSahoo45-button-3 nodrag"
          onClick={handleRunClick}
          onPointerEnter={handleRunHover}
        >
          &#9654;
        </button>
      );
      if (runButtonTooltip)
        setRunButton(
          <Tooltip
            label={runButtonTooltip}
            withArrow
            arrowSize={6}
            arrowRadius={2}
            zIndex={1001}
            withinPortal={true}
          >
            {run_btn}
          </Tooltip>,
        );
      else setRunButton(run_btn);
    } else {
      setRunButton(<></>);
    }
  }, [handleRunClick, runButtonTooltip]);

  const handleCloseButtonClick = useCallback(() => {
    setDeleteConfirmProps({
      title: "Delete node",
      message:
        "Are you sure you want to delete this node? This action is irreversible.",
      onConfirm: () => removeNode(nodeId),
    });

    // Open the 'are you sure' modal:
    if (deleteConfirmModal && deleteConfirmModal.current)
      deleteConfirmModal.current?.trigger();
  }, [deleteConfirmModal]);

  return (
    <>
      <div className="node-header drag-handle">
        {icon ? <>{icon}&nbsp;</> : <></>}
        <AreYouSureModal
          ref={deleteConfirmModal}
          title={deleteConfirmProps.title}
          message={deleteConfirmProps.message}
          onConfirm={deleteConfirmProps.onConfirm}
        />
        <EditText
          className="nodrag"
          name={nodeId ? nodeId + "-label" : "node-label"}
          defaultValue={title || "Node"}
          style={{
            width: "60%",
            margin: "0px",
            padding: "0px",
            minHeight: "18px",
          }}
          onEditMode={handleEnterEditMode}
          onSave={handleNodeLabelChange}
          inline={true}
          readonly={editable !== undefined ? !editable : false}
        />
        {statusIndicator}
        <div className="node-header-btns-container">
          {customButtons ?? <></>}
          {isRunning ? stopButton : runButton}
          <button
            className="close-button nodrag"
            onClick={handleCloseButtonClick}
          >
            &#x2715;
          </button>
          <br />
        </div>
      </div>
    </>
  );
};

export default NodeLabel;
