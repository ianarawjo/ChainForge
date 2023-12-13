import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Handle } from 'reactflow';
import { Textarea, Tooltip, Skeleton } from '@mantine/core';
import { IconTextPlus, IconEye, IconEyeOff } from '@tabler/icons-react';
import useStore from './store';
import NodeLabel from './NodeLabelComponent';
import TemplateHooks, { extractBracketedSubstrings } from './TemplateHooksComponent';
import BaseNode from './BaseNode';
import { setsAreEqual } from './backend/utils';
import AIPopover from './AiPopover';
import AISuggestionsManager from './backend/aiSuggestionsManager';
import DefaultDict from './backend/defaultdict';

// Helper funcs
const union = (setA, setB) => {
  const _union = new Set(setA);
  for (const elem of setB) {
    _union.add(elem);
  }
  return _union;
}

const delButtonId = 'del-';
const visibleButtonId = 'eye-';

const TextFieldsNode = ({ data, id }) => {

  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const apiKeys = useStore((state) => state.apiKeys);
  const flags = useStore((state) => state.flags);

  const [textfieldsValues, setTextfieldsValues] = useState(data.fields || {});
  const [fieldVisibility, setFieldVisibility] = useState(data.fields_visibility || {});

  // Whether the text fields should be in a loading state
  const [isLoading, setIsLoading] = useState(false);

  const [aiSuggestionsManager] = useState(new AISuggestionsManager(
    // Do nothing when suggestions are simply updated because we are managing the placeholder state manually here.
    undefined,
    // When suggestions are refreshed, throw out existing placeholders.
    () => setPlaceholders({}),
    () => apiKeys,
  ));

  // Placeholders to show in the textareas. Object keyed by textarea index.
  let [placeholders, setPlaceholders] = useState({});

  const getUID = useCallback((textFields) => {
    if (textFields) {
      return 'f' + (1 + Object.keys(textFields).reduce((acc, key) => (
        Math.max(acc, parseInt(key.slice(1)))
      ), 0)).toString();
    } else {
      return 'f0';
    }
  }, []);

  // Handle delete text field.
  const handleDelete = useCallback((event) => {
    // Update the data for this text field's id.
    let new_fields = { ...textfieldsValues };
    let new_vis = { ...fieldVisibility };
    var item_id = event.target.id.substring(delButtonId.length);
    delete new_fields[item_id];
    delete new_vis[item_id];
    // if the new_data is empty, initialize it with one empty field
    if (Object.keys(new_fields).length === 0) {
      new_fields[getUID(textfieldsValues)] = "";
    }
    setTextfieldsValues(new_fields);
    setFieldVisibility(new_vis);
    setDataPropsForNode(id, {fields: new_fields, fields_visibility: new_vis});
    pingOutputNodes(id);
  }, [textfieldsValues, fieldVisibility, id, delButtonId, setDataPropsForNode, pingOutputNodes]);

  // Initialize fields (run once at init)
  useEffect(() => {
    if (!textfieldsValues || Object.keys(textfieldsValues).length === 0) {
      let init_fields = {};
      init_fields[getUID(textfieldsValues)] = "";
      setTextfieldsValues(init_fields);
      setDataPropsForNode(id, { fields: init_fields });
    }
  }, []);

  // Add a text field
  const handleAddField = useCallback(() => {
    let new_fields = {...textfieldsValues};
    new_fields[getUID(textfieldsValues)] = "";
    setTextfieldsValues(new_fields);
    setDataPropsForNode(id, { fields: new_fields });
    pingOutputNodes(id);

    // Cycle suggestions when new field is created
    //aiSuggestionsManager.cycleSuggestions();

    // Ping AI suggestions to generate autocomplete options
    if (flags["aiAutocomplete"])
      aiSuggestionsManager.update(Object.values(textfieldsValues));
  }, [textfieldsValues, id, flags, setDataPropsForNode, pingOutputNodes]);

  // Disable/hide a text field temporarily
  const handleDisableField = useCallback((field_id) => {
    let vis = {...fieldVisibility};
    vis[field_id] = fieldVisibility[field_id] === false; // toggles it
    setFieldVisibility(vis);
    setDataPropsForNode(id, { fields_visibility: vis });
    pingOutputNodes(id);
  }, [fieldVisibility, setDataPropsForNode, pingOutputNodes]);

  const updateTemplateVars = useCallback((new_data) => {
    // TODO: Optimize this check.
    let all_found_vars = new Set();
    const new_field_ids = Object.keys(new_data.fields);
    new_field_ids.forEach((fid) => {
      let found_vars = extractBracketedSubstrings(new_data['fields'][fid]);
      if (found_vars && found_vars.length > 0) {
        all_found_vars = union(all_found_vars, new Set(found_vars));
      }
    });

    // Update template var fields + handles, if there's a change in sets
    const past_vars = new Set(templateVars);
    if (!setsAreEqual(all_found_vars, past_vars)) {
      const new_vars_arr = Array.from(all_found_vars);
      new_data.vars = new_vars_arr;
    }

    return new_data;
  }, [templateVars]);

  // Save the state of a textfield when it changes and update hooks
  const handleTextFieldChange = useCallback((field_id, val) => {
    // Update the value of the controlled Textarea component
    let new_fields = {...textfieldsValues};
    new_fields[field_id] = val;
    setTextfieldsValues(new_fields);

    // Update the data for the ReactFlow node
    let new_data = updateTemplateVars({ 'fields': new_fields });
    if (new_data.vars) setTemplateVars(new_data.vars);
    setDataPropsForNode(id, new_data);
    pingOutputNodes(id);

  }, [textfieldsValues, templateVars, updateTemplateVars, id]);

  // Dynamically update the textareas and position of the template hooks
  const ref = useRef(null);
  const [hooksY, setHooksY] = useState(120);
  useEffect(() => {
    const node_height = ref.current.clientHeight;
    setHooksY(node_height + 68);
  }, [textfieldsValues, handleTextFieldChange]);

  const setRef = useCallback((elem) => {
    // To listen for resize events of the textarea, we need to use a ResizeObserver.
    // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div wrapping textfields.
    // NOTE: This won't work on older browsers, but there's no alternative solution.
    if (!ref.current && elem && window.ResizeObserver) {
      let past_hooks_y = 120;
      const observer = new ResizeObserver(() => {
        if (!ref || !ref.current) return;
        const new_hooks_y = ref.current.clientHeight + 68;
        if (past_hooks_y !== new_hooks_y) {
          setHooksY(new_hooks_y);
          past_hooks_y = new_hooks_y;
        }
      });

      observer.observe(elem);
      ref.current = elem;
    }
  }, [ref]);

  // Pass upstream changes down to later nodes in the chain
  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      pingOutputNodes(id);
    }
  }, [data, id, pingOutputNodes]);

  // Handle keydown events for the text fields
  function handleTextAreaKeyDown(event, placeholder, textareaIndex) {
    // Insert the AI suggested text if:
    // (1) the user presses the Tab key
    // (2) the user has not typed anything in the textarea
    // (3) the suggestions are loaded
    if (
      event.key === 'Tab' &&
      textfieldsValues[textareaIndex] === '' &&
      !aiSuggestionsManager.areSuggestionsLoading()
    ) {
      event.preventDefault();
      // Insert the suggestion corresponding to the text field that was tabbed into by index.
      aiSuggestionsManager.removeSuggestion(placeholder);
      handleTextFieldChange(textareaIndex, placeholder);
    }
  };

  // Add the entire list of `fields` to `textfieldsValues`
  function addMultipleFields(fields) {
    // Unpack the object to force a re-render
    const buffer = {...textfieldsValues};
    for (const field of fields) {
      const uid = getUID(buffer);
      buffer[uid] = field;
    }
    setTextfieldsValues(buffer);
    setDataPropsForNode(id, { fields: buffer });
    pingOutputNodes(id);
  }

  // Replace the entirety of `textfieldValues` with `newFields`
  function replaceFields(fields) {
    const buffer = {};
    for (const field of fields) {
      const uid = getUID(buffer);
      buffer[uid] = field;
    }
    setTextfieldsValues(buffer);
    let new_data = updateTemplateVars({ 'fields': buffer });
    if (new_data.vars) setTemplateVars(new_data.vars);
    setDataPropsForNode(id, { fields: buffer });
    pingOutputNodes(id);
  }

  // Whether a placeholder is needed for the text field with id `i`.
  function placeholderNeeded(i) {
    return !textfieldsValues[i] && !placeholders[i] && flags["aiAutocomplete"];
  }

  // Load a placeholder into placeholders for the text field with id `i` if needed.
  function loadPlaceholderIfNeeded(i) {
    if (placeholderNeeded(i) && !aiSuggestionsManager.areSuggestionsLoading()) {
      placeholders[i] = aiSuggestionsManager.popSuggestion();
    }
  }

  // Cache the rendering of the text fields.
  const textFields = useMemo(() =>
    Object.keys(textfieldsValues).map(i => {
      loadPlaceholderIfNeeded(i);
      const placeholder = placeholders[i];
      return (
        <div className="input-field" key={i}>
          <Textarea id={i} name={i} 
                  className="text-field-fixed nodrag nowheel" 
                  autosize
                  minRows="2"
                  maxRows="8"
                  value={textfieldsValues[i]} 
                  placeholder={flags["aiAutocomplete"] ? placeholder : undefined} 
                  disabled={fieldVisibility[i] === false}
                  onChange={(event) => handleTextFieldChange(i, event.currentTarget.value)}
                  onKeyDown={(event) => handleTextAreaKeyDown(event, placeholder, i)} />
          {Object.keys(textfieldsValues).length > 1 ? (
            <div style={{display: 'flex', flexDirection: 'column'}}>
              <Tooltip label='remove field' position='right' withArrow arrowSize={10} withinPortal>
                <button id={delButtonId + i} className="remove-text-field-btn nodrag" onClick={handleDelete} style={{flex: 1}}>X</button>
              </Tooltip>
              <Tooltip label={(fieldVisibility[i] === false ? 'enable' : 'disable') + ' field'} position='right' withArrow arrowSize={10} withinPortal>
                <button id={visibleButtonId + i} className="remove-text-field-btn nodrag" onClick={() => handleDisableField(i)} style={{flex: 1}}>
                  {fieldVisibility[i] === false ? 
                      <IconEyeOff size='14pt' pointerEvents='none' />
                    : <IconEye size='14pt' pointerEvents='none' />
                  }
                </button>
              </Tooltip>
            </div>
          ) : <></>}
        </div>)}),
      // Update the text fields only when their values or their placeholders change.
      [textfieldsValues, placeholders]);

  return (
    <BaseNode classNames="text-fields-node" nodeId={id}>
      <NodeLabel title={data.title || 'TextFields Node'} 
                 nodeId={id} 
                 icon={<IconTextPlus size="16px" />} 
                 customButtons={
                  (flags["aiSupport"] ? 
                    [<AIPopover key='ai-popover'
                              values={textfieldsValues}
                              onAddValues={addMultipleFields}
                              onReplaceValues={replaceFields}
                              areValuesLoading={isLoading}
                              setValuesLoading={setIsLoading}
                              apiKeys={apiKeys} />]
                   : [])
                 } />
      <Skeleton visible={isLoading}>
        <div ref={setRef}>
          {textFields}
        </div>
      </Skeleton>
      <Handle
        type="source"
        position="right"
        id="output"
        className="grouped-handle"
        style={{ top: "50%" }}
      />
      <TemplateHooks vars={templateVars} nodeId={id} startY={hooksY} />
      <div className="add-text-field-btn">
        <button onClick={handleAddField}>+</button>
      </div>
    </BaseNode>
  );
};

export default TextFieldsNode;