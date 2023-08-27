import React, { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Button, Modal, Popover } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import emojidata from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// react-jsonschema-form
import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/core';

import { ModelSettings, getDefaultModelFormData, postProcessFormData } from './ModelSettingSchemas'

const ModelSettingsModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);

  const [formData, setFormData] = useState(undefined);
  const onSettingsSubmit = props.onSettingsSubmit;

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
            setSchema({'type': 'object', 'description': `Did not find settings schema for base model ${props.model.base_model}. Maybe you are missing importing a custom provider script?`});
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

  const saveFormState = useCallback((fdata) => {

    // For some reason react-json-form-schema returns 'undefined' on empty strings.
    // We need to (1) detect undefined values for keys in formData and (2) if they are of type string, replace with "",
    // if that property is marked with a special "allow_empty_str" property.
    let patched_fdata = {};
    Object.entries(fdata).forEach(([key, val]) => {
      if (val === undefined && key in schema.properties && schema.properties[key].allow_empty_str === true)
        patched_fdata[key] = "";
      else
        patched_fdata[key] = val;
    });

    setFormData(patched_fdata);

    if (onSettingsSubmit) {
        props.model.emoji = modelEmoji;
        onSettingsSubmit(props.model, patched_fdata, postprocess(patched_fdata));
    }
  }, [props, modelEmoji, schema, setFormData, onSettingsSubmit, postprocess]);

  const onSubmit = useCallback((submitInfo) => {
    saveFormState(submitInfo.formData);
  }, [saveFormState]);

  const onFormDataChange = (state) => {
    if (state && state.formData)
      setFormData(state.formData);
  };

  const onClickSubmit = useCallback(() => {
    if (formData)
        saveFormState(formData);
    close();
  }, [formData, close, saveFormState]);

  const onEmojiSelect = useCallback((selection) => {
    const emoji = selection.native;
    setModelEmoji(emoji);
    setEmojiPickerOpen(false);
    console.log('picked', emoji);
  }, [setModelEmoji, setEmojiPickerOpen]);

  // This gives the parent access to triggering the modal
  const trigger = useCallback(() => {
    open();
  }, [schema, uiSchema, modelName, open]);
  useImperativeHandle(ref, () => ({
    trigger,
  }));

return (
    <Modal size='lg' opened={opened} onClose={onClickSubmit} title={
        <div>
            <Popover width={200} position="bottom" withArrow shadow="md" withinPortal className="nowheel nodrag" opened={emojiPickerOpen} onChange={setEmojiPickerOpen}>
                <Popover.Target>
                    <Button variant='subtle' compact style={{fontSize: '16pt'}} onClick={() => {setEmojiPickerOpen((o) => !o);}}>{modelEmoji}</Button>
                </Popover.Target>
                <Popover.Dropdown>
                    <Picker data={emojidata} onEmojiSelect={onEmojiSelect} theme="light" />
                </Popover.Dropdown>
            </Popover><span>{`Model Settings: ${modelName}`}</span>
        </div>
    } closeOnClickOutside={false} style={{position: 'relative', 'left': '-5%'}}>
        
        <Form schema={schema} uiSchema={uiSchema} formData={formData} validator={validator} onChange={onFormDataChange} onSubmit={onSubmit} style={{width: '100%'}}>
            <Button title='Submit' onClick={onClickSubmit} style={{float: 'right', marginRight: '30px'}}>Submit</Button>
            <div style={{height: '50px'}}></div>
        </Form>
    </Modal>
  );
});

export default ModelSettingsModal;