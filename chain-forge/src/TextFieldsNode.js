import React, { useState } from 'react';
import { Handle } from 'react-flow-renderer';

const TextFieldsNode = ({ data }) => {

  const handleInputChange = (event) => {
    // Update the data for this text fields' id. 
    // :: This treats the fields as comma-separated values. It ignores commas inside quotes, e.g.:
    // :: 1, 2, 3, "4, 5", 6  --> ["1", "2", "3", "4, 5", "6"]
    // const regex_csv = /,(?!(?<=(?:^|,)\s*\x22(?:[^\x22]|\x22\x22|\\\x22)*,)(?:[^\x22]|\x22\x22|\\\x22)*\x22\s*(?:,|$))/g;
    data[event.target.id] = event.target.value; // event.target.value.split(regex_csv);
  }
  const stopDragPropagation = (event) => {
    // Stop this event from bubbling up to the node
    event.stopPropagation();
  }

  const createInitFields = () => {
    const f = [0];
    return f.map((i, idx) => {
      const top = 70 + 57*idx + 'px';
      return (
        <div className="input-field" key={i}>
          <textarea id={"f"+i} name={"f"+i} className="text-field-fixed" rows="3" cols="40" defaultValue={''} onChange={handleInputChange} onMouseDownCapture={stopDragPropagation} />
          <Handle
            type="source"
            position="right"
            id={"f"+i}
            style={{ top: top, background: '#555' }}
          />
        </div>
    )});
  };

  const [fields, setFields] = useState(createInitFields());

  const handleAddField = (event) => {
    const i = fields.length;
    const top = 70 + 57*i + 'px';
    const f = fields.concat((
      <div className="input-field" key={i}>
          <textarea id={"f"+i} name={"f"+i} className="text-field-fixed" rows="3" cols="40" defaultValue={''} onChange={handleInputChange} onMouseDownCapture={stopDragPropagation} />
          <Handle
            type="source"
            position="right"
            id={"f"+i}
            style={{ top: top, background: '#555' }}
          />
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
      <div className="add-text-field-btn">
        <button onClick={handleAddField}>+</button>
      </div>
    </div>
  );
};

export default TextFieldsNode;