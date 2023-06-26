import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Handle } from 'react-flow-renderer';
import { Button, Code } from '@mantine/core';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import { IconTerminal, IconSearch } from '@tabler/icons-react'
import LLMResponseInspectorModal from './LLMResponseInspectorModal';

// Ace code editor
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-xcode";
import "ace-builds/src-noconflict/ext-language_tools";
import fetch_from_backend from './fetch_from_backend';

const EvaluatorNode = ({ data, id }) => {

  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const outputEdgesForNode = useStore((state) => state.outputEdgesForNode);
  const getNode = useStore((state) => state.getNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const [status, setStatus] = useState('none');
  const nodes = useStore((state) => state.nodes);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef(null);

  const [codeText, setCodeText] = useState(data.code);
  const [codeTextOnLastRun, setCodeTextOnLastRun] = useState(false);
  const [lastRunLogs, setLastRunLogs] = useState("");
  const [lastResponses, setLastResponses] = useState([]);
  const [lastRunSuccess, setLastRunSuccess] = useState(true);
  const [mapScope, setMapScope] = useState('response');

  // On initialization
  useEffect(() => {
    // Attempt to grab cache'd responses
    fetch_from_backend('grabResponses', {
      responses: [id],
    }).then(function(json) {
      if (json.responses && json.responses.length > 0) {
          // Store responses and set status to green checkmark
          setLastResponses(json.responses);
          setStatus('ready');
      }
    });
  }, []);

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
    if (codeText.search(/def\s+evaluate\s*(.*):/) === -1) {
      const err_msg = `Could not find required function 'evaluate'. Make sure you have defined an 'evaluate' function.`;
      setStatus('error');
      alertModal.current.trigger(err_msg);
      return;
    }

    setStatus('loading');
    setLastRunLogs("");
    setLastResponses([]);

    const rejected = (err_msg) => {
      setStatus('error');
      alertModal.current.trigger(err_msg);
    };

    // Get all the script nodes, and get all the folder paths
    const script_nodes = nodes.filter(n => n.type === 'script');
    const script_paths = script_nodes.map(n => Object.values(n.data.scriptFiles).filter(f => f !== '')).flat();

    // Run evaluator in backend
    const codeTextOnRun = codeText + '';
    fetch_from_backend('execute', {
      id: id,
      code: codeTextOnRun,
      scope: mapScope,
      responses: input_node_ids,
      reduce_vars: [],
      script_paths: script_paths,
      // write an extra part here that takes in reduce func
    }, rejected).then(function(response) {
        return response.json();
    }, rejected).then(function(json) {
        // Store any Python print output
        if (json?.logs) {
          let logs = json.logs;
          if (json.error)
            logs.push(json.error);
          setLastRunLogs(logs.join('\n   > '));
        }
    
        // Check if there's an error; if so, bubble it up to user and exit:
        if (!json || json.error) {
          setStatus('error');
          setLastRunSuccess(false);
          alertModal.current.trigger(json ? json.error : 'Unknown error encountered when requesting evaluations: empty response returned.');
          return;
        }
        
        // Ping any vis + inspect nodes attached to this node to refresh their contents:
        const output_nodes = outputEdgesForNode(id).map(e => e.target);
        output_nodes.forEach(n => {
            const node = getNode(n);
            if (node && (node.type === 'vis' || node.type === 'inspect')) {
                setDataPropsForNode(node.id, { refresh: true });
            }
        });

        console.log(json.responses);
        setLastResponses(json.responses);
        setCodeTextOnLastRun(codeTextOnRun);
        setLastRunSuccess(true);
        setStatus('ready');
    }, rejected);
  };

  const handleOnMapScopeSelect = (event) => {
    setMapScope(event.target.value);
  };

  const hideStatusIndicator = () => {
    if (status !== 'none') { setStatus('none'); }
  };

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses)
        inspectModal.current.trigger();
  }, [inspectModal, lastResponses]);

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
      <LLMResponseInspectorModal ref={inspectModal} jsonResponses={lastResponses} />
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
        <div className="code-mirror-field-header">Define an <Code>evaluate</Code> func to map over each response:
        {/* &nbsp;<select name="mapscope" id="mapscope" onChange={handleOnMapScopeSelect}>
            <option value="response">response</option>
            <option value="batch">batch of responses</option>
        </select> */}
        </div>
        
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

      {(lastRunLogs && lastRunLogs.length > 0) ? 
        (<div className="eval-output-footer nowheel" style={{backgroundColor: (lastRunSuccess ? '#eee' : '#f19e9eb1')}}>
          <p style={{color: (lastRunSuccess ? '#999' : '#a10f0f')}}><strong>out:</strong> {lastRunLogs}</p>
        </div>)
        : (<></>)
      }

      { lastRunSuccess && lastResponses && lastResponses.length > 0 ? 
        (<div className="eval-inspect-response-footer nodrag" onClick={showResponseInspector} style={{display: 'flex', justifyContent:'center'}}>
          <Button color='blue' variant='subtle' w='100%' >Inspect results&nbsp;<IconSearch size='12pt'/></Button>
        </div>) : <></>}
        
    </div>
  );
};

export default EvaluatorNode;