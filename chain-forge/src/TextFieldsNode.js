import React from 'react';
import { Handle } from 'react-flow-renderer';

const TextFieldsNode = ({ data }) => {
  return (
    <div className="text-fields-node">
      <div className="node-header">
        TextFields Node
      </div>
      <div className="input-field">
        <label htmlFor="n">n:</label>
        <input type="text" id="n" name="n" defaultValue={data.n} />
        <Handle
          type="source"
          position="right"
          id="n"
          style={{ top: '50%', background: '#555' }}
        />
      </div>
      <div className="input-field">
        <label htmlFor="paragraph">Paragraph:</label>
        <input type="text" id="paragraph" name="paragraph" defaultValue={data.paragraph} />
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