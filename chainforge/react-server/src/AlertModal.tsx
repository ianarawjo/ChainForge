/** An alert popup for displaying errors */
import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  createContext,
  useRef,
  useMemo,
} from "react";
import { useDisclosure } from "@mantine/hooks";
import { Modal, ModalBaseStylesNames, Styles } from "@mantine/core";

const ALERT_MODAL_STYLE = {
  header: { backgroundColor: "#E52A2A", color: "white" },
  root: { position: "relative", left: "-5%" },
} as Styles<ModalBaseStylesNames>;

export interface AlertModalRef {
  trigger: (msg?: string | Error) => void;
}

/**
 * The Alert Modal displays error messages to the user in a pop-up dialog.
 */
export const AlertModal = forwardRef<AlertModalRef>(
  function AlertModal(props, ref) {
    // Mantine modal popover for alerts
    const [opened, { open, close }] = useDisclosure(false);
    const [alertMsg, setAlertMsg] = useState("");

    // This gives the parent access to triggering the modal alert
    const trigger = (msg?: string | Error) => {
      if (!msg) msg = "Unknown error.";
      else if (typeof msg !== "string") msg = msg.message;
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
  },
);
export default AlertModal;

export const AlertModalContext = createContext<
  ((msg?: string | Error) => void) | undefined
>(undefined);

/**
 * Wraps children components to provide the same AlertModal to everywhere in the component tree.
 * Saves space and reduces duplicate declarations.
 */
export const AlertModalProvider = ({
  children,
}: {
  children: React.ReactNode[];
}) => {
  // Create one AlertModal for the entire application
  const alertModal = useRef<AlertModalRef>(null);

  // We have to wrap trigger() in a memoized function, as passing it down directly will trigger re-renders every frame.
  const showAlert = useMemo(() => {
    return (msg?: string | Error) => alertModal?.current?.trigger(msg);
  }, [alertModal]);

  return (
    <AlertModalContext.Provider value={showAlert}>
      <AlertModal ref={alertModal} />
      {children}
    </AlertModalContext.Provider>
  );
};
