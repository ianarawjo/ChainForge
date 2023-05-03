import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import { IconTextPlus } from '@tabler/icons-react'
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import TemplateHooks from './TemplateHooksComponent';

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

  // Handle a change in a text fields' input.
  const handleInputChange = useCallback((event) => {
    // Update the data for this text fields' id.
    let new_data = { 'fields': {...data.fields} };
    new_data.fields[event.target.id] = event.target.value;

    // TODO: Optimize this check.
    let all_found_vars = new Set();
    const braces_regex = /(?<!\\){(.*?)(?<!\\)}/g;  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}
    Object.keys(new_data['fields']).forEach((fieldId) => {
      let found_vars = new_data['fields'][fieldId].match(braces_regex);
      if (found_vars && found_vars.length > 0) {
        found_vars = found_vars.map(name => name.substring(1, name.length-1));  // remove brackets {}
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
  }, [data, id, setDataPropsForNode, templateVars]);

  // Initialize fields (run once at init)
  const [fields, setFields] = useState([]);
  useEffect(() => {
    if (!data.fields)
      setDataPropsForNode(id, { fields: {f0: ''}} );
  }, []);

  // Whenever 'data' changes, update the input fields to reflect the current state.
  useEffect(() => {
    const f = data.fields ? Object.keys(data.fields) : ['f0'];
    setFields(f.map((i) => {
      const val = data.fields ? data.fields[i] : '';
      return (
        <div className="input-field" key={i}>
          <textarea id={i} name={i} className="text-field-fixed nodrag" rows="2" cols="40" defaultValue={val} onChange={handleInputChange} />
        </div>
    )}));
  }, [data.fields, handleInputChange]);

  // Add a field
  const handleAddField = useCallback(() => {
    // Update the data for this text fields' id.
    const num_fields = data.fields ? Object.keys(data.fields).length : 0;
    let new_data = { 'fields': {...data.fields} };
    new_data.fields['f'+num_fields.toString()] = "";
    setDataPropsForNode(id, new_data);
  }, [data, id, setDataPropsForNode]);

  // Dynamically update the y-position of the template hook <Handle>s
  const ref = useRef(null);
  const [hooksY, setHooksY] = useState(120);
  useEffect(() => {
    const node_height = ref.current.clientHeight;
    setHooksY(node_height + 70);
  }, [fields]);

  return (
    <div className="text-fields-node">
      <div className="node-header">
        <NodeLabel title={data.title || 'TextFields Node'} nodeId={id} icon={<IconTextPlus size="16px" />} />
      </div>
      <div ref={ref}>
        {fields}
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