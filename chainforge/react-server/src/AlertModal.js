/** An alert popup for displaying errors */
import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { Modal } from '@mantine/core';

const AlertModal = forwardRef((props, ref) => {
  // Mantine modal popover for alerts
  const [opened, { open, close }] = useDisclosure(false);
  const [alertMsg, setAlertMsg] = useState('');

  // This gives the parent access to triggering the modal alert
  const trigger = (msg) => {
    if (!msg) msg = "Unknown error.";
    console.error(msg);
    setAlertMsg(msg);
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal opened={opened} onClose={close} title="Error" styles={{header: {backgroundColor: '#E52A2A', color: 'white'}, root: {position: 'relative', left: '-5%'}}}>
      <p style={{whiteSpace: 'pre-line'}}>{alertMsg}</p>
    </Modal>
  );
});

export default AlertModal;