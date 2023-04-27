import React, { useState } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';


const InspectorNode = ({ data, id }) => {

  const [responses, setResponses] = useState([]);
  const [pastInputs, setPastInputs] = useState([]);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);

  const stopDragPropagation = (event) => {
    event.stopPropagation();
  }

  const handleOnConnect = () => {
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);

    console.log("hello");

    // Grab responses associated with those ids:
    const response = fetch('http://localhost:5000/grabResponses', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            'responses': input_node_ids,
        }),
    }).then(function(res) {
        return res.json();
    }).then(function(json) {
        if (json.responses && json.responses.length > 0) {

            // Bucket responses by LLM:
            let responses_by_llm = {};
            json.responses.forEach(item => {
                if (item.llm in responses_by_llm)
                    responses_by_llm[item.llm].push(item);
                else
                    responses_by_llm[item.llm] = [item];
            });

            const vars_to_str = (vars) => {
                const pairs = Object.keys(vars).map(varname => {
                    let s = vars[varname].trim();
                    if (s.length > 12)
                        s = s.substring(0, 12) + '...'
                    return `${varname} = '${s}'`;
                });
                return pairs.join('; ');
            };

            setResponses(Object.keys(responses_by_llm).map(llm => {
                const res_divs = responses_by_llm[llm].map((res_obj, res_idx) => {
                    const ps = res_obj.responses.map((r, idx) => {
                        return (
                            <p className="small-response" key={idx}>{r}</p>
                        );
                    });
                    const vars = vars_to_str(res_obj.vars);
                    return (
                        <div key={"r"+res_idx} className="response-box">
                            <p className="response-tag">{vars}</p>
                            {ps}
                        </div>
                    );
                });                
                return (
                    <div key={llm} className="llm-response-container nowheel" onScrollCapture={stopDragPropagation}>
                        <h1>{llm}</h1>
                        {res_divs}
                    </div>
                );
            }));
        }
    });
  }

  if (data.input) {
    // If there's a change in inputs...
    if (data.input != pastInputs) {
        setPastInputs(data.input);
        handleOnConnect();
    }
  }

  return (
    <div className="inspector-node">
      <div className="node-header">
        Inspector Node
      </div>
      {responses}
      <Handle
        type="target"
        position="left"
        id="input"
        style={{ top: "50%", background: '#555' }}
        onConnect={handleOnConnect}
      />
    </div>
  );
};

export default InspectorNode;