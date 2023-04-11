import React, { useState } from 'react';
import { Handle } from 'react-flow-renderer';

const PromptNode = ({ data }) => {

  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);
  const [templateHooks, setTemplateHooks] = useState([]);
  
  const handleMouseEnter = () => {
    setHovered(true);
  };
  
  const handleMouseLeave = () => {
    setHovered(false);
  };
  
  const handleClick = () => {
    setSelected(!selected);
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    const braces_regex = /(?<!\\){(.*?)(?<!\\)}/g;  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}
    const found_template_vars = value.match(braces_regex);
    if (found_template_vars && found_template_vars.length > 0) {
        const temp_var_names = found_template_vars.map(
            name => name.substring(1, name.length-1)
        )
        console.log(temp_var_names);
        setTemplateHooks(temp_var_names.map(
            (name, idx) => {
                const pos = (idx * 35) + 140 + 'px';
                const style = { top: pos,  background: '#555' };
                return (
                    <div key={name}>
                    <p>{name}</p>
                    <Handle
                        type="target"
                        position="left"
                        id={name}
                        style={style}
                    />
                    </div>
                )
            }
        ));
    } else {
        setTemplateHooks([]);
    }
  };
  
  const borderStyle = selected
    ? '2px solid #222'
    : hovered
    ? '1px solid #222'
    : '1px solid #999';

  return (
    <div 
      className="prompt-node"
      style={{ border: borderStyle }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="node-header">
        Prompt Node
      </div>
      <div className="input-field">
        <textarea
          rows="4"
          cols="40"
          defaultValue={data.prompt}
          onChange={handleInputChange}
        />
        <Handle
          type="source"
          position="right"
          id="prompt"
          style={{ top: '50%', background: '#555' }}
        />
      </div>
      <div className="template-hooks"> 
        {templateHooks}
      </div>
    </div>
  );
};

export default PromptNode;