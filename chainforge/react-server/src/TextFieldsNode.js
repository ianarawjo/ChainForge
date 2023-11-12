import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Handle } from 'reactflow';
import { Textarea, Tooltip, Skeleton } from '@mantine/core';
import { IconTextPlus, IconEye, IconEyeOff } from '@tabler/icons-react';
import useStore from './store';
import NodeLabel from './NodeLabelComponent';
import TemplateHooks, { extractBracketedSubstrings } from './TemplateHooksComponent';
import AIPopover from './AIPopover';
import AISuggestionsManager from './backend/aiSuggestionsManager';

// Helper funcs
const union = (setA, setB) => {
  const _union = new Set(setA);
  for (const elem of setB) {
    _union.add(elem);
  }
  return _union;
}
const setsAreEqual = (setA, setB) => {
  if (setA.size !== setB.size) return false;
  let equal = true;
  for (const item of setA) {
    if (!setB.has(item)) {
      equal = false;
      break;
    }
  }
  return equal;
}

const delButtonId = 'del-';
const visibleButtonId = 'eye-';

const TextFieldsNode = ({ data, id }) => {

  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);

  const [textfieldsValues, setTextfieldsValues] = useState(data.fields || {});
  const [fieldVisibility, setFieldVisibility] = useState(data.fields_visibility || {});

  // Whether the text fields should be in a loading state
  const [isLoading, setLoading] = useState(false);

  // Placeholders to show in the textareas
  const [placeholders, setPlaceholders] = useState([]);

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
  }, [textfieldsValues, id, setDataPropsForNode, pingOutputNodes]);

  // Disable/hide a text field temporarily
  const handleDisableField = useCallback((field_id) => {
    let vis = {...fieldVisibility};
    vis[field_id] = fieldVisibility[field_id] === false; // toggles it
    setFieldVisibility(vis);
    setDataPropsForNode(id, { fields_visibility: vis });
    pingOutputNodes(id);
  }, [fieldVisibility, setDataPropsForNode, pingOutputNodes]);

  // Save the state of a textfield when it changes and update hooks
  const handleTextFieldChange = useCallback((field_id, val) => {

    // Update the value of the controlled Textarea component
    let new_fields = {...textfieldsValues};
    new_fields[field_id] = val;
    setTextfieldsValues(new_fields);

    // Update the data for the ReactFlow node
    let new_data = { 'fields': new_fields };

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
      setTemplateVars(new_vars_arr);
    }

    setDataPropsForNode(id, new_data);
    pingOutputNodes(id);

  }, [textfieldsValues, templateVars, id]);

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

  // When the suggestions from the AI Suggestions Manager change, update the placeholders to match
  function onSuggestionsUpdated(suggestions) {
    setPlaceholders(suggestions);
  }

  // Instantiate an instance of the AI Suggestions Manager just once for this node.
  const aiSuggestionsManager = useMemo(
    () => new AISuggestionsManager(onSuggestionsUpdated), []);

  // Notify the suggestions manager when the text fields change
  useEffect(() => {
    aiSuggestionsManager.update(Object.values(textfieldsValues))
  }, [textfieldsValues, aiSuggestionsManager]);

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
    for (const field of fields) {
      const buffer = textfieldsValues;
      const uid = getUID(buffer);
      buffer[uid] = field;
      setTextfieldsValues(buffer);
      setDataPropsForNode(id, { fields: buffer });
      pingOutputNodes(id);
    }
  }

  // Replace the entirety of `textfieldValues` with `newFields`
  function replaceFields(fields) {
    const buffer = {};
      for (const field of fields) {
        const uid = getUID(buffer);
        buffer[uid] = field;
        setTextfieldsValues(buffer);
        setDataPropsForNode(id, { fields: buffer });
        pingOutputNodes(id);
      }
  }

  // Incremented during the rendering of this component to iterate through each empty textarea and give it a unique placeholder from the placeholders.
  let placeholderIndex = 0;

  // TODO: figure out a better way to index the placeholders

  return (
    <div className="text-fields-node cfnode">
      <NodeLabel title={data.title || 'TextFields Node'} 
                 nodeId={id} 
                 icon={<IconTextPlus size="16px" />} 
                 customButtons={[
                  <AIPopover key='ai-popover'
                             values={textfieldsValues}
                             onAddValues={addMultipleFields}
                             onReplaceValues={replaceFields}
                             areValuesLoading={isLoading}
                             setValuesLoading={setLoading} />
                 ]} />
      <Skeleton visible={isLoading}>
        <div ref={setRef}>
          {Object.keys(textfieldsValues).map(i => {
            const value = textfieldsValues[i];
            // If the value is empty, use the next placeholder.
            const placeholder = value === '' ? placeholders[placeholderIndex++] : '';
            return (
              <div className="input-field" key={i}>
                <Textarea id={i} name={i} 
                        className="text-field-fixed nodrag nowheel" 
                        autosize
                        minRows="2"
                        maxRows="8"
                        value={value} 
                        placeholder={placeholder} 
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
              </div>)})}
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
    </div>
  );
};

export default TextFieldsNode;