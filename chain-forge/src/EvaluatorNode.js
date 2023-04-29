import React, { useState, useEffect } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import StatusIndicator from './StatusIndicatorComponent'

// Mantine modal
import { useDisclosure } from '@mantine/hooks';
import { Modal } from '@mantine/core';

// CodeMirror text editor
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
// import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate} from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { okaidia } from '@uiw/codemirror-theme-okaidia'; // dark theme
import { solarizedDark } from '@uiw/codemirror-theme-solarized'; // dark theme; warm
import { noctisLilac } from '@uiw/codemirror-theme-noctis-lilac'; // light theme NOTE: Unfortunately this does not show selected text, no idea why. 
import { materialLight } from '@uiw/codemirror-theme-material'; // light theme, material
import { xcodeDark, xcodeLight } from '@uiw/codemirror-theme-xcode'; // light theme, xcode
import { sublime } from '@uiw/codemirror-theme-sublime';

// Experimenting with making the 'def evaluator' line read-only
// import readOnlyRangesExtension from 'codemirror-readonly-ranges'
// const getReadOnlyRanges = (editorState) => {
//   return [{
//     from: editorState.doc.line(2).from, //same as: editorState.doc.line(0).from or 0
//     to: editorState.doc.line(2).to
//   }]
// }
// // Add readOnlyRangesExtension(getReadOnlyRanges) to extensions prop of CodeMirror component

const EvaluatorNode = ({ data, id }) => {

  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const outputEdgesForNode = useStore((state) => state.outputEdgesForNode);
  const getNode = useStore((state) => state.getNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const [status, setStatus] = useState('none');

  // Mantine modal popover for alerts
  const [opened, { open, close }] = useDisclosure(false);
  const [alertMsg, setAlertMsg] = useState('');

  const [hovered, setHovered] = useState(false);
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
  const stopDragPropagation = (event) => {
    // Stop this event from bubbling up to the node
    event.stopPropagation();
  }

  const handleCodeChange = (code) => {
    setCodeText(code);
    setDataPropsForNode(id, {code: code});
  };

  // Trigger an alert modal popover with Mantine:
  const triggerErrorAlert = (msg) => {
    console.error(msg);
    setAlertMsg(msg);
    open();
  };

  const handleRunClick = (event) => {
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);
    if (input_node_ids.length === 0) {
        console.warn("No inputs for evaluator node.");
        return;
    }

    // Double-check that the code includes an 'evaluate' function:
    const indiv_resps = mapScope === 'response';
    if (codeText.search(/def\s+evaluate\s*(.*):/) === -1) {
      const err_msg = `Could not find required function 'evaluate'. Make sure you have defined an 'evaluate' function.`;
      setStatus('error');
      triggerErrorAlert(err_msg);
      return;
    }

    setStatus('loading');

    const rejected = (err_msg) => {
      setStatus('error');
      triggerErrorAlert(err_msg);
    };

    // Run evaluator in backend
    fetch('http://localhost:5000/execute', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            id: id,
            code: codeText,
            scope: mapScope,
            responses: input_node_ids,
            reduce_vars: reduceMethod === 'avg' ? reduceVars : [],
            // write an extra part here that takes in reduce func
        }),
    }, rejected).then(function(response) {
        return response.json();
    }, rejected).then(function(json) {
        console.log(json);

        // Check if there's an error; if so, bubble it up to user and exit:
        if (json.error) {
          setStatus('error');
          triggerErrorAlert(json.error);
          return;
        }

        // Ping any vis nodes attached to this node to refresh their contents:
        const output_nodes = outputEdgesForNode(id).map(e => e.target);
        output_nodes.forEach(n => {
            const node = getNode(n);
            if (node.type === 'vis') {
                setDataPropsForNode(node.id, { refresh: true });
            }
        });

        setStatus('ready');
    }, rejected);
  };

  const handleOnReduceMethodSelect = (event) => {
    const method = event.target.value;
    if (method === 'none') {
      setReduceVars([]);
    }
    setReduceMethod(method);
  };

  const handleOnMapScopeSelect = (event) => {
    setMapScope(event.target.value);
  };
  
  const handleReduceVarsChange = (event) => {
    // Split on commas, ignoring commas wrapped in double-quotes 
    const regex_csv = /,(?!(?<=(?:^|,)\s*\x22(?:[^\x22]|\x22\x22|\\\x22)*,)(?:[^\x22]|\x22\x22|\\\x22)*\x22\s*(?:,|$))/g;
    setReduceVars(event.target.value.split(regex_csv).map(s => s.trim()));
  };

  // To get CM editor state every render, use this and add ref={cmRef} to CodeMirror component
  // const cmRef = React.useRef({});
  // useEffect(() => {
  //   if (cmRef.current?.view) console.log('EditorView:', cmRef.current?.view);
  //   if (cmRef.current?.state) console.log('EditorState:', cmRef.current?.state);
  //   if (cmRef.current?.editor) {
  //     console.log('HTMLDivElement:', cmRef.current?.editor);
  //   }
  // }, [cmRef.current]);

  // const initEditor = (view, state) => {
  //   console.log(view, state);
  // }

  const borderStyle = hovered
    ? '1px solid #222'
    : '1px solid #999';

  return (
    <div 
      className="evaluator-node"
      style={{ border: borderStyle }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="node-header">
        Evaluator Node
        <StatusIndicator status={status} />
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
      <Modal opened={opened} onClose={close} title="Error" styles={{header: {backgroundColor: '#E52A2A', color: 'white'}}}>
        <p>{alertMsg}</p>
      </Modal>
      <div className="core-mirror-field">
        <div className="code-mirror-field-header">Function to map over each &nbsp;
        <select name="mapscope" id="mapscope" onChange={handleOnMapScopeSelect}>
            <option value="response">response</option>
            <option value="batch">batch of responses</option>
        </select>
        :</div>
        
        {/* <span className="code-style">response</span>: */}
        <CodeMirror
          // onCreateEditor={initEditor}
          value={data.code}
          height="200px"
          width="400px"
          theme={materialLight}
          style={{cursor: 'text'}}
          onDrag={stopDragPropagation}
          onPointerMove={stopDragPropagation}
          onPointerDown={stopDragPropagation}
          onPointerUp={stopDragPropagation}
          onChange={handleCodeChange}
          onMouseDownCapture={stopDragPropagation}
          onClick={stopDragPropagation}
          onMouseMoveCapture={stopDragPropagation}
          onMouseUpCapture={stopDragPropagation}
          extensions={[python(), indentUnit.of("  ")]}
        />
      </div>
      <hr/>
      <div>
        <div className="code-mirror-field-header">Method to reduce across <span className="code-style">responses</span>:</div>
        <select name="method" id="method" onChange={handleOnReduceMethodSelect}>
            <option value="none">None</option>
            <option value="avg">Average across</option>
            {/* <option value="custom">Custom reducer</option> */}
        </select>
        <span> </span>
        <input type="text" id="method-vars" name="method-vars" onChange={handleReduceVarsChange} disabled={reduceMethod === 'none'} />
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