import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { TextInput, Checkbox, Button, Group, Box, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

// react-jsonschema-form
import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/core';

import { ChatGPTSettings } from './ModelSettingSchemas'
import useStore from './store';

const ModelSettingsModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);

  const onSubmit = (formData) => {
    //
    // Save stuff here...
    //
    close();
  };

  // This gives the parent access to triggering the modal
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

return (
    <Modal size='lg' opened={opened} onClose={close} title="Model Settings: GPT3.5 (ChatGPT)" closeOnClickOutside={false} style={{position: 'relative', 'left': '-100px'}}>
            <Form schema={ChatGPTSettings.schema} uiSchema={ChatGPTSettings.uiSchema} validator={validator} onSubmit={onSubmit} style={{width: '100%'}}></Form>
    </Modal>
  );
});

export default ModelSettingsModal;