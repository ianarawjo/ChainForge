import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { TextInput, Checkbox, Button, Group, Box, Modal, Popover } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import emojidata from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// react-jsonschema-form
import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/core';

import { ModelSettings, getDefaultModelFormData, postProcessFormData } from './ModelSettingSchemas'
import useStore from './store';

const ModelSettingsModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);
  const form = useRef(null);
  const [formData, setFormData] = useState(undefined);
  const onSettingsSubmit = props.onSettingsSubmit;
  const selectedModelKey = props.model ? props.model.key : null;

  const [schema, setSchema] = useState({'type': 'object', 'description': 'No model info object was passed to settings modal.'});
  const [uiSchema, setUISchema] = useState({});
  const [modelName, setModelName] = useState("(unknown)");

  // Totally necessary emoji picker 
  const [modelEmoji, setModelEmoji] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (props.model && props.model.base_model) {
        setModelEmoji(props.model.emoji);
        if (!(props.model.base_model in ModelSettings)) {
            setSchema({'type': 'object', 'description': `Did not find settings schema for base model ${props.model.base_model}.`});
            setUISchema({});
            setModelName(props.model.base_model);
            return;
        }
        const settingsSpec = ModelSettings[props.model.base_model];
        const schema = settingsSpec.schema;
        setSchema(schema);
        setUISchema(settingsSpec.uiSchema);
        setModelName(settingsSpec.fullName);
        if (props.model.formData) {
            setFormData(props.model.formData);
        } else {
            // Create settings from schema 
            let default_settings = {};
            Object.keys(schema.properties).forEach(key => {
                default_settings[key] = 'default' in schema.properties[key] ? schema.properties[key]['default'] : undefined;
            });
            setFormData(getDefaultModelFormData(settingsSpec));
        }
    }
  }, [props.model]);

  // Postprocess the form data into the format expected by the backend (kwargs passed to Python API calls)
  const postprocess = useCallback((fdata) => {
    return postProcessFormData(ModelSettings[props.model.base_model], fdata);
  }, [props.model]);

  const saveFormState = useCallback(() => {
    if (form && form.current)
        form.current.submit();
  }, [form]);

  const onSubmit = useCallback((submitInfo) => {
    setFormData(submitInfo.formData);

    if (onSettingsSubmit) {
        props.model.emoji = modelEmoji;
        onSettingsSubmit(props.model, submitInfo.formData, postprocess(submitInfo.formData));
    }

  }, [close, setFormData, modelEmoji, onSettingsSubmit, selectedModelKey]);

  const onClickSubmit = useCallback(() => {
    if (form && form.current)
        form.current.submit();
    close();
  }, [form]);

  const onEmojiSelect = (selection) => {
    setModelEmoji(selection.native);
    setEmojiPickerOpen(false);
  };

  // This gives the parent access to triggering the modal
  const trigger = useCallback(() => {
    open();
  }, [schema, uiSchema, modelName]);
  useImperativeHandle(ref, () => ({
    trigger,
  }));

return (
    <Modal size='lg' opened={opened} onClose={onClickSubmit} title={
        <div>
            <Popover width={200} position="bottom" withArrow shadow="md" withinPortal className="nowheel nodrag" opened={emojiPickerOpen} onChange={setEmojiPickerOpen}>
                <Popover.Target>
                    <Button variant='subtle' compact style={{fontSize: '16pt'}} onClick={() => {setEmojiPickerOpen((o) => !o); saveFormState();}}>{modelEmoji}</Button>
                </Popover.Target>
                <Popover.Dropdown>
                    <Picker data={emojidata} onEmojiSelect={onEmojiSelect} theme="light" />
                </Popover.Dropdown>
            </Popover><span>{`Model Settings: ${modelName}`}</span>
        </div>
    } closeOnClickOutside={false} style={{position: 'relative', 'left': '-100px'}}>
        
        <Form ref={form} schema={schema} uiSchema={uiSchema} formData={formData} validator={validator} onSubmit={onSubmit} style={{width: '100%'}}>
            <Button title='Submit' onClick={onClickSubmit} style={{float: 'right', marginRight: '30px'}}>Submit</Button>
            <div style={{height: '50px'}}></div>
        </Form>
    </Modal>
  );
});

export default ModelSettingsModal;