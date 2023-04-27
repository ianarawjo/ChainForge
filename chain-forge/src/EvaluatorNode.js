import React, { useState } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';

// CodeMirror text editor
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { okaidia } from '@uiw/codemirror-theme-okaidia'; // dark theme
import { solarizedDark } from '@uiw/codemirror-theme-solarized'; // dark theme; warm
import { noctisLilac } from '@uiw/codemirror-theme-noctis-lilac'; // light theme NOTE: Unfortunately this does not show selected text, no idea why. 
import { materialLight } from '@uiw/codemirror-theme-material'; // light theme, material
import { xcodeDark, xcodeLight } from '@uiw/codemirror-theme-xcode'; // light theme, xcode
import { sublime } from '@uiw/codemirror-theme-sublime';

const EvaluatorNode = ({ data, id }) => {

  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);
  const [codeText, setCodeText] = useState(data.code);
  const [reduceMethod, setReduceMethod] = useState('none');
  const [mapScope, setMapScope] = useState('response');
  const [reduceVars, setReduceVars] = useState([]);

  const handleMouseEnter = () => {
    setHovered(true);
  };
  const handleMouseLeave = () => {
    setHovered(false);
  };
  const handleClick = () => {
    setSelected(!selected);
  };

  const handleInputChange = (code) => {
    setCodeText(code);
  };

  const stopDragPropagation = (event) => {
    // Stop this event from bubbling up to the node
    event.stopPropagation();
  }

  const handleRunClick = (event) => {
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);

    if (input_node_ids.length === 0) {
        console.warn("No inputs for evaluator node.");
        return;
    }

    const response = fetch('http://localhost:5000/execute', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            id: id,
            code: codeText,
            scope: mapScope,
            responses: input_node_ids,
            reduce_vars: reduceVars,
            // write an extra part here that takes in reduce func
        }),
    }).then(function(response) {
        return response.json();
    }).then(function(json) {
        console.log(json);
    });
  };

  const handleOnReduceMethodSelect = (event) => {
    setReduceMethod(event.target.value);
  };

  const handleOnMapScopeSelect = (event) => {
    setMapScope(event.target.value);
  };
  
  const handleReduceVarsChange = (event) => {
    // Split on commas, ignoring commas wrapped in double-quotes 
    const regex_csv = /,(?!(?<=(?:^|,)\s*\x22(?:[^\x22]|\x22\x22|\\\x22)*,)(?:[^\x22]|\x22\x22|\\\x22)*\x22\s*(?:,|$))/g;
    setReduceVars(event.target.value.split(regex_csv).map(s => s.trim()));
  };

  const borderStyle = selected
    ? '2px solid #222'
    : hovered
    ? '1px solid #222'
    : '1px solid #999';

  return (
    <div 
      className="evaluator-node"
      style={{ border: borderStyle }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="node-header">
        Evaluator Node
        <button className="AmitSahoo45-button-3" onClick={handleRunClick}><div className="play-button"></div></button>
      </div>
      <Handle
          type="target"
          position="left"
          id="responseBatch"
          style={{ top: '50%', background: '#555' }}
        />
      <Handle
          type="source"
          position="right"
          id="output"
          style={{ top: '50%', background: '#555' }}
        />
      <div className="core-mirror-field">
        <div className="code-mirror-field-header">Function to map over each &nbsp;
        <select name="mapscope" id="mapscope" onChange={handleOnMapScopeSelect}>
            <option value="response">response</option>
            <option value="batch">batch of responses</option>
        </select>
        :</div>
        
        {/* <span className="code-style">response</span>: */}
        <CodeMirror
          value={data.code}
          height="200px"
          width="400px"
          theme={materialLight}
          style={{cursor: 'text'}}
          onDrag={stopDragPropagation}
          onPointerMove={stopDragPropagation}
          onPointerDown={stopDragPropagation}
          onPointerUp={stopDragPropagation}
          onChange={handleInputChange}
          onMouseDownCapture={stopDragPropagation}
          onClick={stopDragPropagation}
          onMouseMoveCapture={stopDragPropagation}
          onMouseUpCapture={stopDragPropagation}
          extensions={[python()]}
        />
      </div>
      <hr/>
      <div>
        <div className="code-mirror-field-header">Method to reduce across <span className="code-style">responses</span>:</div>
        <select name="method" id="method" onChange={handleOnReduceMethodSelect}>
            <option value="none">None</option>
            <option value="avg">Average across</option>
            <option value="custom">Custom reducer</option>
        </select>
        <span> </span>
        <input type="text" id="method-vars" name="method-vars" onChange={handleReduceVarsChange}  />
        {/* <label for="avg">Average over: </label>
        <select name="avg" id="avg">
            <option value="mod">mod</option>
            <option value="paragraph">paragraph</option>
            <option value="_none">N/A</option>
        </select> */}
      </div>
    </div>
  );
};

export default EvaluatorNode;