import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { TextInput, Checkbox, Button, Group, Box, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

// react-jsonschema-form
import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/core';

import { ModelSettings } from './ModelSettingSchemas'
import useStore from './store';

const ModelSettingsModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);
  const form = useRef(null);

  const schema = props.model && props.model in ModelSettings ? ModelSettings[props.model].schema : {'type': 'object', 'description': `Did not find settings schema for model ${props.model}.`};
  const uiSchema = props.model && props.model in ModelSettings ? ModelSettings[props.model].uiSchema : {};

  const onSubmit = (formData) => {
    //
    // Save stuff here...
    //
    console.log(formData);
    close();
  };
  const onClickSubmit = useCallback(() => {
    if (form && form.current)
        form.current.submit();
  }, [form]);

  // This gives the parent access to triggering the modal
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

return (
    <Modal size='lg' opened={opened} onClose={close} title="Model Settings: GPT3.5 (ChatGPT)" closeOnClickOutside={false} style={{position: 'relative', 'left': '-100px'}}>
            <Form ref={form} schema={schema} uiSchema={uiSchema} validator={validator} onSubmit={onSubmit} style={{width: '100%'}}>
                <Button title='Submit' onClick={onClickSubmit} style={{float: 'right', marginRight: '30px'}}>Submit</Button>
                <div style={{height: '50px'}}></div>
            </Form>
    </Modal>
  );
});

export default ModelSettingsModal;