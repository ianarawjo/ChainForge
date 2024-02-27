/** An alert popup for displaying errors */
import React, { useState, forwardRef, useImperativeHandle } from "react";
import { useDisclosure } from "@mantine/hooks";
import { Modal, ModalBaseStylesNames, Styles } from "@mantine/core";

const ALERT_MODAL_STYLE = {
  header: { backgroundColor: "#E52A2A", color: "white" },
  root: { position: "relative", left: "-5%" },
} as Styles<ModalBaseStylesNames>;

interface AlertModalHandles {
  trigger: (msg?: string) => void;
}

const AlertModal = forwardRef<AlertModalHandles>(function AlertModal(props, ref) {
  // Mantine modal popover for alerts
  const [opened, { open, close }] = useDisclosure(false);
  const [alertMsg, setAlertMsg] = useState("");

  // This gives the parent access to triggering the modal alert
  const trigger = (msg?: string) => {
    if (!msg) msg = "Unknown error.";
    console.error(msg);
    setAlertMsg(msg);
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal
      opened={opened}
      onClose={close}
      title="Error"
      styles={ALERT_MODAL_STYLE}
    >
      <p style={{ whiteSpace: "pre-line" }}>{alertMsg}</p>
    </Modal>
  );
});

export default AlertModal;
