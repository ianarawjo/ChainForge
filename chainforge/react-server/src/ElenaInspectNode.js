import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import {BASE_URL} from './store';

const ElenaInspectNode = ({ data, id }) => {

  let is_fetching = false;

  const [visualization, setVisualization] = useState([]);
  const [jsonResponses, setJSONResponses] = useState(null);

  const [pastInputs, setPastInputs] = useState([]);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  // Update the visualization whenever 'jsonResponses' changes:
  useEffect(() => {
    if (!jsonResponses || (Array.isArray(jsonResponses) && jsonResponses.length === 0))
        return;

    // === Construct a visualization using jsonResponses here ===
    // ....
    console.log(jsonResponses);
    // ==========================================================

    // Set the HTML / React element
    const my_vis_component = (<div>Hello! The response JSON I received is:
                                <p style={{fontSize: '9pt'}}>{JSON.stringify(jsonResponses)}</p>
                             </div>);  // replace with your own
    setVisualization(my_vis_component);

  }, [jsonResponses]);

  // Grab the LLM(s) response data from the back-end server.
  // Called upon connect to another node, or upon a 'refresh' triggered upstream.
  const grabResponses = () => {
    // For some reason, 'on connect' is called twice upon connection.
    // We detect when an inspector node is already fetching, and disable the second call:
    if (is_fetching) return; 

    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);

    is_fetching = true;

    // Grab responses associated with those ids:
    fetch(BASE_URL + 'app/grabResponses', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            'responses': input_node_ids,
        }),
    }).then(function(res) {
        return res.json();
    }).then(function(json) {
        if (json.responses && json.responses.length > 0) {
            setJSONResponses(json.responses);
        }
        is_fetching = false;
    }).catch(() => {
        is_fetching = false; 
    });
  };

  /** Effects to refresh the visualization if anything changes: */
  if (data.input) {
    // If there's a change in inputs to this node, refresh the visualization:
    if (data.input != pastInputs) {
        setPastInputs(data.input);
        grabResponses();
    }
  }

  // Re-grab the responses and recreate the visualization if some other part of the code triggers a 'refresh';
  // for instance, after a prompt node finishes running:
  useEffect(() => {
    if (data.refresh && data.refresh === true) {
        setDataPropsForNode(id, { refresh: false });
        grabResponses();
    }
  }, [data, id, grabResponses, setDataPropsForNode]);

  // The React HTML component to display:
  return (
    <div className="inspector-node cfnode">
    <NodeLabel title={data.title || 'Elena\'s Inspect Node'} 
                nodeId={id}
                icon={'🔍'} />
      <div className="inspect-response-container nowheel nodrag">
        {visualization}
      </div>
      <Handle
        type="target"
        position="left"
        id="input"
        style={{ top: "50%", background: '#555' }}
        onConnect={grabResponses}
      />
    </div>
  );
};

export default ElenaInspectNode;