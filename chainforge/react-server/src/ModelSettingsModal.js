import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
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
  const [formData, setFormData] = useState(undefined);
  const onSettingsSubmit = props.onSettingsSubmit;
  const selectedModelKey = props.model ? props.model.key : null;

  const [schema, setSchema] = useState({'type': 'object', 'description': 'No model info object was passed to settings modal.'});
  const [uiSchema, setUISchema] = useState({});
  const [modelName, setModelName] = useState("(unknown)");

  useEffect(() => {
    if (props.model && props.model.base_model) {
        if (!(props.model.base_model in ModelSettings)) {
            setSchema({'type': 'object', 'description': `Did not find settings schema for base model ${props.model.base_model}.`});
            setUISchema({});
            setModelName(props.model.base_model);
            return;
        }
        const schema = ModelSettings[props.model.base_model].schema;
        setSchema(schema);
        setUISchema(ModelSettings[props.model.base_model].uiSchema);
        setModelName(ModelSettings[props.model.base_model].fullName);
        if (props.model.formData) {
            setFormData(props.model.formData);
        } else {
            // Create settings from schema 
            let default_settings = {};
            Object.keys(schema.properties).forEach(key => {
                default_settings[key] = 'default' in schema.properties[key] ? schema.properties[key]['default'] : undefined;
            });
            setFormData(default_settings);
        }
    }
  }, [props.model]);

  // Postprocess the form data into the format expected by the backend (kwargs passed to Python API calls)
  const postprocess = useCallback((fdata) => {
    // Strip all 'model' and 'shortname' props in the submitted form, as these are passed elsewhere or unecessary for the backend
    const skip_keys = {'model': true, 'shortname': true};

    let new_data = {};
    let postprocessors = {};
    if (props.model?.base_model && props.model.base_model in ModelSettings && ModelSettings[props.model.base_model].postprocessors)
        postprocessors = ModelSettings[props.model.base_model].postprocessors;

    Object.keys(fdata).forEach(key => {
        if (key in skip_keys) return;
        if (key in postprocessors)
            new_data[key] = postprocessors[key](fdata[key]);
        else
            new_data[key] = fdata[key];
    });
    
    return new_data;
  }, [props.model]);

  const onSubmit = useCallback((submitInfo) => {
    console.log("Submitted data:", submitInfo.formData);
    setFormData(submitInfo.formData);
    close();

    if (onSettingsSubmit)
        onSettingsSubmit(selectedModelKey, submitInfo.formData, postprocess(submitInfo.formData));

  }, [close, setFormData, onSettingsSubmit, selectedModelKey]);

  const onClickSubmit = useCallback(() => {
    if (form && form.current)
        form.current.submit();
  }, [form]);

  // This gives the parent access to triggering the modal
  const trigger = useCallback(() => {
    open();
  }, [schema, uiSchema, modelName]);
  useImperativeHandle(ref, () => ({
    trigger,
  }));

return (
    <Modal size='lg' opened={opened} onClose={close} title={`Model Settings: ${modelName}`} closeOnClickOutside={false} style={{position: 'relative', 'left': '-100px'}}>
            <Form ref={form} schema={schema} uiSchema={uiSchema} formData={formData} validator={validator} onSubmit={onSubmit} style={{width: '100%'}}>
                <Button title='Submit' onClick={onClickSubmit} style={{float: 'right', marginRight: '30px'}}>Submit</Button>
                <div style={{height: '50px'}}></div>
            </Form>
    </Modal>
  );
});

export default ModelSettingsModal;