/** 
 * A fullscreen version of the Inspect node that
 * appears in a Mantine modal pop-up which takes up much of the screen.
 */
import React, { forwardRef, useImperativeHandle } from 'react';
import { Modal } from '@mantine/core';
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
    <Modal size='90%' keepMounted opened={opened} onClose={close} closeOnClickOutside={true} style={{position: 'relative', 'left': '-5%'}} title={
      <div><span>Response Inspector</span><button className="custom-button" style={{marginTop: 'auto', marginRight: '14px', float: 'right'}} onClick={() => exportToExcel(props.jsonResponses)}>Export data to Excel</button></div>
    } styles={{ title: {justifyContent: 'space-between', width: '100%'} }} >
      { props.prompt !== undefined ? 
        <p className="inspect-modal-prompt-box"><span className='inspect-modal-prompt-prefix'>Root Prompt:&nbsp;</span> <span className="inspect-modal-prompt-text">{props.prompt}</span></p>
      : <></>}
      <div className="inspect-modal-response-container" style={{padding: '6px', overflow: 'scroll'}}>
        <LLMResponseInspector jsonResponses={props.jsonResponses} wideFormat={true} />
      </div>
    </Modal>
  );
});

export default LLMResponseInspectorModal;