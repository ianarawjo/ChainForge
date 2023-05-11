import React, { useState, useEffect } from 'react';
import { Handle } from 'react-flow-renderer';
import { Badge } from '@mantine/core';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import {BASE_URL} from './store';

// Helper funcs
const truncStr = (s, maxLen) => {
    if (s.length > maxLen) // Cut the name short if it's long
        return s.substring(0, maxLen) + '...'
    else
        return s;
}
const vars_to_str = (vars) => {
    const pairs = Object.keys(vars).map(varname => {
        const s = truncStr(vars[varname].trim(), 12);
        return `${varname} = '${s}'`;
    });
    return pairs;
};
const bucketResponsesByLLM = (responses) => {
    let responses_by_llm = {};
    responses.forEach(item => {
        if (item.llm in responses_by_llm)
            responses_by_llm[item.llm].push(item);
        else
            responses_by_llm[item.llm] = [item];
    });
    return responses_by_llm;
};

const InspectorNode = ({ data, id }) => {

  const [responses, setResponses] = useState([]);
  const [varSelects, setVarSelects] = useState([]);
  const [pastInputs, setPastInputs] = useState([]);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const handleVarValueSelect = () => {
  }

  const handleOnConnect = () => {
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);

    console.log(input_node_ids);

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
        console.log(json);
        if (json.responses && json.responses.length > 0) {

            // Bucket responses by LLM:
            const responses_by_llm = bucketResponsesByLLM(json.responses);
            
            // // Get the var names across all responses, as a set
            // let tempvarnames = new Set();
            // json.responses.forEach(r => {
            //     if (!r.vars) return;
            //     Object.keys(r.vars).forEach(tempvarnames.add);
            // });

            // // Create a dict version
            // let tempvars = {};

            const colors = ['#ace1aeb1', '#f1b963b1', '#e46161b1', '#f8f398b1', '#defcf9b1', '#cadefcb1', '#c3bef0b1', '#cca8e9b1'];
            setResponses(Object.keys(responses_by_llm).map((llm, llm_idx) => {
                const res_divs = responses_by_llm[llm].map((res_obj, res_idx) => {
                    const ps = res_obj.responses.map((r, idx) => 
                        (<pre className="small-response" key={idx}>{r}</pre>)
                    );
                    const vars = vars_to_str(res_obj.vars);
                    const var_tags = vars.map((v) => (
                        <Badge key={v} color="blue" size="xs">{v}</Badge>
                    ));
                    return (
                        <div key={"r"+res_idx} className="response-box" style={{ backgroundColor: colors[llm_idx % colors.length] }}>
                            {var_tags}
                            {ps}
                        </div>
                    );
                });                
                return (
                    <div key={llm} className="llm-response-container">
                        <h1>{llm}</h1>
                        {res_divs}
                    </div>
                );
            }));

            // setVarSelects(Object.keys(tempvars).map(v => {
            //     const options = Array.from(tempvars[v]).map((val, idx) => (
            //         <option value={val} key={idx}>{val}</option>
            //     ));
            //     return (
            //         <div key={v}>
            //             <label htmlFor={v}>{v}: </label>
            //             <select name={v} id={v} onChange={handleVarValueSelect}>
            //                 {options}
            //             </select>
            //         </div>
            //     );
            // }));
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

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
        // Recreate the visualization:
        setDataPropsForNode(id, { refresh: false });
        handleOnConnect();
    }
}, [data, id, handleOnConnect, setDataPropsForNode]);

  return (
    <div className="inspector-node cfnode">
    <NodeLabel title={data.title || 'Inspect Node'} 
                nodeId={id}
                icon={'🔍'} />
      {/* <div className="var-select-toolbar">
        {varSelects}
      </div> */}
      <div className="inspect-response-container nowheel nodrag">
      {responses}
      </div>
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