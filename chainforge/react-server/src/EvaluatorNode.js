import React, { useState, useRef } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import { IconTerminal } from '@tabler/icons-react'
import {BASE_URL} from './store';

// Ace code editor
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-xcode";
import "ace-builds/src-noconflict/ext-language_tools";

const EvaluatorNode = ({ data, id }) => {

  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const outputEdgesForNode = useStore((state) => state.outputEdgesForNode);
  const getNode = useStore((state) => state.getNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const [status, setStatus] = useState('none');
  const nodes = useStore((state) => state.nodes);

  // For displaying error messages to user
  const alertModal = useRef(null);

  const [codeText, setCodeText] = useState(data.code);
  const [codeTextOnLastRun, setCodeTextOnLastRun] = useState(false);
  const [mapScope, setMapScope] = useState('response');

  const handleCodeChange = (code) => {
    if (codeTextOnLastRun !== false) {
      const code_changed = code !== codeTextOnLastRun;
      if (code_changed && status !== 'warning')
        setStatus('warning');
      else if (!code_changed && status === 'warning')
        setStatus('ready');
    }
    setCodeText(code);
    setDataPropsForNode(id, {code: code});
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
      alertModal.current.trigger(err_msg);
      return;
    }

    setStatus('loading');

    const rejected = (err_msg) => {
      setStatus('error');
      alertModal.current.trigger(err_msg);
    };

    // Get all the script nodes, and get all the folder paths
    const script_nodes = nodes.filter(n => n.type === 'script');
    const script_paths = script_nodes.map(n => Object.values(n.data.scriptFiles).filter(f => f !== '')).flat();

    // Run evaluator in backend
    const codeTextOnRun = codeText + '';
    fetch(BASE_URL + 'app/execute', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            id: id,
            code: codeTextOnRun,
            scope: mapScope,
            responses: input_node_ids,
            reduce_vars: [], // reduceMethod === 'avg' ? reduceVars : [],
            script_paths: script_paths,
            // write an extra part here that takes in reduce func
        }),
    }, rejected).then(function(response) {
        return response.json();
    }, rejected).then(function(json) {
        // Check if there's an error; if so, bubble it up to user and exit:
        if (!json || json.error) {
          setStatus('error');
          alertModal.current.trigger(json ? json.error : 'Unknown error encountered when requesting evaluations: empty response returned.');
          return;
        }
        
        // Ping any vis nodes attached to this node to refresh their contents:
        const output_nodes = outputEdgesForNode(id).map(e => e.target);
        output_nodes.forEach(n => {
            const node = getNode(n);
            if (node && node.type === 'vis') {
                setDataPropsForNode(node.id, { refresh: true });
            }
        });

        setCodeTextOnLastRun(codeTextOnRun);
        setStatus('ready');
    }, rejected);
  };

  const handleOnMapScopeSelect = (event) => {
    setMapScope(event.target.value);
  };

  const hideStatusIndicator = () => {
    if (status !== 'none') { setStatus('none'); }
  };

  return (
    <div className="evaluator-node cfnode">
      <NodeLabel title={data.title || 'Python Evaluator Node'} 
                  nodeId={id} 
                  onEdit={hideStatusIndicator}
                  icon={<IconTerminal size="16px" />} 
                  status={status}
                  alertModal={alertModal}
                  handleRunClick={handleRunClick}
                  runButtonTooltip="Run evaluator over inputs"
                  />
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
        <div className="ace-editor-container nodrag">
          <AceEditor
            mode="python"
            theme="xcode"
            onChange={handleCodeChange}
            value={data.code}
            name={"aceeditor_"+id}
            editorProps={{ $blockScrolling: true }}
            width='100%'
            height='100px'
            style={{minWidth:'310px'}}
            tabSize={2}
            onLoad={editorInstance => {  // Make Ace Editor div resizeable. 
              editorInstance.container.style.resize = "both";
              document.addEventListener("mouseup", e => (
                editorInstance.resize()
              ));
            }}
          />
        </div>
      </div>
      {/* <hr/>
      <div>
        <div className="code-mirror-field-header">Method to reduce across <span className="code-style">responses</span>:</div>
        <select name="method" id="method" onChange={handleOnReduceMethodSelect} className="nodrag">
            <option value="none">None</option>
            <option value="avg">Average across</option>
        </select>
        <span> </span>
        <input type="text" id="method-vars" name="method-vars" onChange={handleReduceVarsChange} disabled={reduceMethod === 'none'} className="nodrag" />
      </div> */}
    </div>
  );
};

export default EvaluatorNode;