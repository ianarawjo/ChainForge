/** 
 * A fullscreen version of the Inspect node that
 * appears in a Mantine modal pop-up which takes up much of the screen.
 */
import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Modal, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import LLMResponseInspector, { exportToExcel } from './LLMResponseInspector';

const LLMResponseInspectorModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);

  // This gives the parent access to triggering the modal
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal size='80%' opened={opened} onClose={close} closeOnClickOutside={true} style={{position: 'relative', 'left': '-100px'}} title={
      <div><span>Response Inspector</span><button className="custom-button" style={{marginTop: 'auto', marginRight: '14px', float: 'right'}} onClick={exportToExcel}>Export data to Excel</button></div>
    } styles={{ title: {justifyContent: 'space-between', width: '100%'} }} >
      <p className="inspect-modal-prompt-box"><span className='inspect-modal-prompt-prefix'>Root Prompt:&nbsp;</span> <span className="inspect-modal-prompt-text">{props.prompt}</span></p>
      <div style={{padding: '6px'}}>
        <LLMResponseInspector jsonResponses={props.jsonResponses} />
      </div>
    </Modal>
  );
});

export default LLMResponseInspectorModal;