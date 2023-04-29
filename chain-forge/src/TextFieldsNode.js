import React, { useState } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';

const TextFieldsNode = ({ data, id }) => {

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const handleInputChange = (event) => {
    // Update the data for this text fields' id. 
    if (!data.fields)
      data.fields = {}
    data['fields'][event.target.id] = event.target.value;
    let new_data = { fields: {...data.fields} };
    setDataPropsForNode(id, new_data);
  }

  const createInitFields = () => {
    const f = data.fields ? Object.keys(data.fields) : ['f0'];
    return f.map((i, idx) => {
      const val = data.fields ? data.fields[i] : '';
      return (
        <div className="input-field" key={i}>
          <textarea id={i} name={i} className="text-field-fixed nodrag" rows="3" cols="40" defaultValue={val} onChange={handleInputChange} />
        </div>
    )});
  };

  const [fields, setFields] = useState(createInitFields());

  const handleAddField = (event) => {
    const i = fields.length;
    const f = fields.concat((
      <div className="input-field" key={i}>
          <textarea id={"f"+i} name={"f"+i} className="text-field-fixed nodrag" rows="3" cols="40" defaultValue={''} onChange={handleInputChange} />
      </div>
    ));
    setFields(f);
  }

  return (
    <div className="text-fields-node">
      <div className="node-header">
        TextFields Node
      </div>
      {fields}
      <Handle
        type="source"
        position="right"
        id="output"
        style={{ top: "50%", background: '#555' }}
      />
      <div className="add-text-field-btn">
        <button onClick={handleAddField}>+</button>
      </div>
    </div>
  );
};

export default TextFieldsNode;