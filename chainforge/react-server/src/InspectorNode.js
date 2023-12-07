import React, { useState, useEffect } from 'react';
import { Handle } from 'reactflow';
import useStore from './store';
import BaseNode from './BaseNode';
import NodeLabel from './NodeLabelComponent';
import LLMResponseInspector, { exportToExcel } from './LLMResponseInspector';
import fetch_from_backend from './fetch_from_backend';

const InspectorNode = ({ data, id }) => {

  let is_fetching = false;

  const [jsonResponses, setJSONResponses] = useState(null);

  const [pastInputs, setPastInputs] = useState([]);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const handleOnConnect = () => {
    // For some reason, 'on connect' is called twice upon connection.
    // We detect when an inspector node is already fetching, and disable the second call:
    if (is_fetching) return; 

    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);

    is_fetching = true;

    // Grab responses associated with those ids:
    fetch_from_backend('grabResponses', {
      'responses': input_node_ids
    }).then(function(json) {
        if (json.responses && json.responses.length > 0) {
            setJSONResponses(json.responses);
        }
        is_fetching = false;
    }).catch(() => {
        is_fetching = false; 
    });
  }

  if (data.input) {
    // If there's a change in inputs...
    if (data.input != pastInputs) {
        setPastInputs(data.input);
        handleOnConnect();
    }
  }

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
        // Recreate the visualization:
        setDataPropsForNode(id, { refresh: false });
        handleOnConnect();
    }
  }, [data, id, handleOnConnect, setDataPropsForNode]);

  return (
    <BaseNode classNames="inspector-node" nodeId={id}>
    <NodeLabel title={data.title || 'Inspect Node'} 
                nodeId={id}
                icon={'🔍'}
                customButtons={[
                    <button className="custom-button" key="export-data" onClick={() => exportToExcel(jsonResponses)}>Export data</button>
                ]} />
      <div className='inspect-response-container nowheel nodrag' style={{marginTop: '-8pt'}}>
        <LLMResponseInspector jsonResponses={jsonResponses} />
      </div>
      <Handle
        type="target"
        position="left"
        id="input"
        className="grouped-handle"
        style={{ top: "50%" }}
        onConnect={handleOnConnect}
      />
    </BaseNode>
  );
};

export default InspectorNode;