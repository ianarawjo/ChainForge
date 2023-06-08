import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import { IconTextPlus } from '@tabler/icons-react'
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import TemplateHooks, { extractBracketedSubstrings } from './TemplateHooksComponent';

/**
 *  The way React handles text areas is annoying: it resets the cursor position upon every edit 
 *  (See https://stackoverflow.com/questions/46000544/react-controlled-input-cursor-jumps). 
 *  We can try to fix this (see commented out code below), but if we do, we
 *  still run into race conditions around rendering. The simplest solution that 
 *  already works is to not use "value", but rather store the value of a textarea within the <></>. 
 *  This, however, spits out an error (even though it works just fine). We surpress this error 
 *  with the following:
 * 
 *  TODO: Make this more proper in the future!
 */
const originalWarn = console.error.bind(console.error);
console.error = (msg) => 
    !msg.toString().includes('Use the `defaultValue` or `value` props instead of setting children on <textarea>') && originalWarn(msg);

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

const TextFieldsNode = ({ data, id }) => {

  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const delButtonId = 'del-';

  const getUID = useCallback(() => {
    if (data.fields) {
      return 'f' + (1 + Object.keys(data.fields).reduce((acc, key) => (
        Math.max(acc, parseInt(key.slice(1)))
      ), 0)).toString();
    } else {
      return 'f0';
    }
  }, [data.fields]);

  // const [cursor, setCursor] = useState(null);
  // const handleFocusField = useCallback((target) => {
  //   if (!cursor || !target) return;

  //   const [last_focused_id, last_cursor_pos] = cursor;
  //   console.log(last_focused_id, target.id);
  //   if (target.id === last_focused_id) {
  //     target.setSelectionRange(last_cursor_pos, last_cursor_pos);
  //     setCursor(null);
  //     console.log('reset cursor pos');
  //   }
  // }, [cursor]);

  // Handle a change in a text fields' input.
  const handleInputChange = useCallback((event) => {

    // Update the data for this text fields' id.
    let new_data = { 'fields': {...data.fields} };
    new_data.fields[event.target.id] = event.target.value;

    // Save the cursor pos, since React won't keep track of this
    // setCursor([event.target.id, event.target.selectionStart]);

    // TODO: Optimize this check.
    let all_found_vars = new Set();
    const new_field_ids = Object.keys(new_data.fields);
    new_field_ids.forEach((fieldId) => {
      let found_vars = extractBracketedSubstrings(new_data['fields'][fieldId]);
      if (found_vars && found_vars.length > 0) {
        all_found_vars = union(all_found_vars, new Set(found_vars));
      }
    });

    // Update template var fields + handles, if there's a change in sets
    const past_vars = new Set(templateVars);
    if (!setsAreEqual(all_found_vars, past_vars)) {
      console.log('set vars');
      const new_vars_arr = Array.from(all_found_vars);
      new_data.vars = new_vars_arr;
      setTemplateVars(new_vars_arr);
    }

    setDataPropsForNode(id, new_data);
  }, [data.fields, id, templateVars]);

  // Handle delete text field.
  const handleDelete = useCallback((event) => {
    // Update the data for this text field's id.
    let new_data = { 'fields': { ...data.fields } };
    var item_id = event.target.id.substring(delButtonId.length);
    delete new_data.fields[item_id];
    // if the new_data is empty, initialize it with one empty field
    if (Object.keys(new_data.fields).length === 0) {
      new_data.fields[getUID()] = '';
    }
    setDataPropsForNode(id, new_data);
  }, [data, id, setDataPropsForNode]);

  // Initialize fields (run once at init)
  useEffect(() => {
    if (!data.fields)
      setDataPropsForNode(id, { fields: {[getUID()]: ''}} );
  }, []);

  // Add a field
  const handleAddField = useCallback(() => {
    // Update the data for this text fields' id.
    let new_data = { 'fields': {...data.fields} };
    new_data.fields[getUID()] = "";
    setDataPropsForNode(id, new_data);
  }, [data, id, setDataPropsForNode]);

  const [textFields, setTextFields] = useState([]);

  // Dynamically update the y-position of the template hook <Handle>s
  const ref = useRef(null);
  const [hooksY, setHooksY] = useState(120);
  useEffect(() => {
    const node_height = ref.current.clientHeight;
    setHooksY(node_height + 75);

    if (data.fields) {
      setTextFields(
        Object.keys(data.fields).map(i => (
          <div className="input-field" key={i}>
            <textarea id={i} name={i} className="text-field-fixed nodrag" rows="2" cols="40" onChange={handleInputChange}>{data.fields[i]}</textarea>
            {Object.keys(data.fields).length > 1 ? (<button id={delButtonId + i} className="remove-text-field-btn nodrag" onClick={handleDelete}>X</button>) : <></>}
          </div>
      )));
    }

  }, [data.fields, handleInputChange]);

  const setRef = useCallback((elem) => {
    // To listen for resize events of the textarea, we need to use a ResizeObserver.
    // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div wrapping textfields.
    // NOTE: This won't work on older browsers, but there's no alternative solution.
    if (!ref.current && window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        if (!ref || !ref.current) return;
        const new_hooks_y = ref.current.clientHeight + 75;
        if (hooksY !== new_hooks_y)
          setHooksY(new_hooks_y);
      });

      observer.observe(elem);
    }
    ref.current = elem;
  }, [ref, hooksY]);

  return (
    <div className="text-fields-node cfnode">
      <NodeLabel title={data.title || 'TextFields Node'} nodeId={id} icon={<IconTextPlus size="16px" />} />
      <div ref={setRef}>
        {textFields}
      </div>
      <Handle
        type="source"
        position="right"
        id="output"
        style={{ top: "50%", background: '#555' }}
      />
      <TemplateHooks vars={templateVars} nodeId={id} startY={hooksY} />
      <div className="add-text-field-btn">
        <button onClick={handleAddField}>+</button>
      </div>
    </div>
  );
};

export default TextFieldsNode;