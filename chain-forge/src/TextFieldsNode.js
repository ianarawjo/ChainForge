import React from 'react';
import { Handle } from 'react-flow-renderer';

const TextFieldsNode = ({ data }) => {

  const handleInputChange = (event) => {
    // Update the data for this text fields' id. 
    // :: This treats the fields as comma-separated values. It ignores commas inside quotes, e.g.:
    // :: 1, 2, 3, "4, 5", 6  --> ["1", "2", "3", "4, 5", "6"]
    const regex_csv = /,(?!(?<=(?:^|,)\s*\x22(?:[^\x22]|\x22\x22|\\\x22)*,)(?:[^\x22]|\x22\x22|\\\x22)*\x22\s*(?:,|$))/g;
    data[event.target.id] = event.target.value.split(regex_csv);
  }

  return (
    <div className="text-fields-node">
      <div className="node-header">
        TextFields Node
      </div>
      <div className="input-field">
        {/* <label htmlFor="n">n:</label> */}
        <label htmlFor="n">n:</label>
        <input type="text" id="n" name="n" defaultValue={data.n} onChange={handleInputChange} />
        <Handle
          type="source"
          position="right"
          id="n"
          style={{ top: '50%', background: '#555' }}
        />
      </div>
      <div className="input-field">
        <label htmlFor="paragraph">Paragraph:</label>
        <input type="text" id="paragraph" name="paragraph" defaultValue={data.paragraph} onChange={handleInputChange} />
        <Handle
          type="source"
          position="right"
          id="paragraph"
          style={{ top: '70%', background: '#555' }}
        />
      </div>
    </div>
  );
};

export default TextFieldsNode;