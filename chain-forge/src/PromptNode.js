import React, { useState } from 'react';
import { Handle } from 'react-flow-renderer';
// import { shallow } from 'zustand/shallow';
import useStore from './store';
import { render } from '@testing-library/react';

const PromptNode = ({ data, id }) => {

  // Get state from the Zustand store:
  const edges = useStore((state) => state.edges);

  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);
  const [templateHooks, setTemplateHooks] = useState([]);
  const [templateVars, setTemplateVars] = useState([]);
  
  const handleMouseEnter = () => {
    setHovered(true);
  };
  
  const handleMouseLeave = () => {
    setHovered(false);
  };
  
  const handleClick = () => {
    setSelected(!selected);
  };

  const genTemplateHooks = (temp_var_names, names_to_blink) => {
    return temp_var_names.map(
        (name, idx) => {
            const className = (names_to_blink.includes(name)) ? 'text-blink' : '';
            const pos = (idx * 35) + 140 + 'px';
            const style = { top: pos,  background: '#555' };
            return (
                <div key={name} className={className} >
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
    );
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
        setTemplateVars(temp_var_names);
        setTemplateHooks(
            genTemplateHooks(temp_var_names, [])
        );
    } else {
        setTemplateHooks([]);
    }
  };

  const handleRunClick = (event) => {
    // Go through all template hooks (if any) and check they're connected:
    const is_fully_connected = templateHooks.every(hook => {
        // Check that some edge has, as its target, this node and its template hook:
        return edges.some(e => (e.target == id && e.targetHandle == hook.key));
    });

    console.log(templateHooks);

    if (is_fully_connected) {
        console.log('Connected!');
    } else {
        console.log('Not connected! :(');
        const names_to_blink = templateVars.filter(name => {
            return !edges.some(e => (e.target == id && e.targetHandle == name));
        });
        setTemplateHooks(
            genTemplateHooks(templateVars, names_to_blink)
        );

        // Set timeout to turn off blinking:
        setTimeout(() => {
            setTemplateHooks(
                genTemplateHooks(templateVars, [])
            );
        }, 750*2);
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
        <button className="AmitSahoo45-button-3" onClick={handleRunClick}><div className="play-button"></div></button>
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