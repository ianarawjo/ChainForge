import React, { useState, useEffect, useRef } from 'react';
import { Handle } from 'react-flow-renderer';
import { Badge, MultiSelect } from '@mantine/core';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import {BASE_URL} from './store';

// Helper funcs
const truncStr = (s, maxLen) => {
    if (s.length > maxLen) // Cut the name short if it's long
        return s.substring(0, maxLen) + '...'
    else
        return s;
};
const filterDict = (dict, keyFilterFunc) => {
    return Object.keys(dict).reduce((acc, key) => {
        if (keyFilterFunc(key) === true)
            acc[key] = dict[key];
        return acc;
    }, {});
};
const vars_to_str = (vars) => {
    const pairs = Object.keys(vars).map(varname => {
        const s = truncStr(vars[varname].trim(), 12);
        return `${varname} = '${s}'`;
    });
    return pairs;
};
const groupResponsesBy = (responses, keyFunc) => {
    let responses_by_key = {};
    let unspecified_group = [];
    responses.forEach(item => {
        const key = keyFunc(item);
        const d = key !== null ? responses_by_key : unspecified_group;
        if (key in d)
            d[key].push(item);
        else
            d[key] = [item];
    });
    return [responses_by_key, unspecified_group];
};

const InspectorNode = ({ data, id }) => {

  const [responses, setResponses] = useState([]);
  const [jsonResponses, setJSONResponses] = useState(null);
  const [pastInputs, setPastInputs] = useState([]);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  // The MultiSelect so people can dynamically set what vars they care about
  const [multiSelectVars, setMultiSelectVars] = useState(data.vars || []);
  const [multiSelectValue, setMultiSelectValue] = useState(data.selected_vars || []);

  // Update the visualization when the MultiSelect values change:
  useEffect(() => {
    if (!jsonResponses || (Array.isArray(jsonResponses) && jsonResponses.length === 0))
        return;

    const responses = jsonResponses;
    const selected_vars = multiSelectValue;

    // Find all LLMs in responses and store as array
    let found_llms = new Set();
    responses.forEach(res_obj => 
        found_llms.add(res_obj.llm));
    found_llms = Array.from(found_llms);

    // Assign a color to each LLM in responses
    const llm_colors = ['#ace1aeb1', '#f1b963b1', '#e46161b1', '#f8f398b1', '#defcf9b1', '#cadefcb1', '#c3bef0b1', '#cca8e9b1'];
    const color_for_llm = (llm) => llm_colors[found_llms.indexOf(llm) % llm_colors.length];
    const response_box_colors = ['#ddd', '#eee', '#ddd', '#eee'];
    const rgroup_color = (depth) => response_box_colors[depth % response_box_colors.length];

    const getHeaderBadge = (key, val) => {
        if (val) {
            const s = truncStr(val.trim(), 12);
            const txt = `${key} = '${s}'`;
            return (<Badge key={val} color="blue" size="xs">{txt}</Badge>);
        } else {
            return (<Badge key={'unspecified'} color="blue" size="xs">{`(unspecified ${key})`}</Badge>);
        }
    };

    // Now we need to perform groupings by each var in the selected vars list,
    // nesting the groupings (preferrably with custom divs) and sorting within 
    // each group by value of that group's var (so all same values are clumped together).
    // :: For instance, for varnames = ['LLM', '$var1', '$var2'] we should get back 
    // :: nested divs first grouped by LLM (first level), then by var1, then var2 (deepest level).
    const groupByVars = (resps, varnames, eatenvars, header) => {
        if (resps.length === 0) return [];
        if (varnames.length === 0) {
            // Base case. Display n response(s) to each single prompt, back-to-back:
            const resp_boxes = resps.map((res_obj, res_idx) => {
                // Spans for actual individual response texts
                const ps = res_obj.responses.map((r, idx) => 
                    (<pre className="small-response" key={idx}>{r}</pre>)
                );

                // At the deepest level, there may still be some vars left over. We want to display these
                // as tags, too, so we need to display only the ones that weren't 'eaten' during the recursive call:
                // (e.g., the vars that weren't part of the initial 'varnames' list that form the groupings)
                const unused_vars = filterDict(res_obj.vars, v => !eatenvars.includes(v));
                const vars = vars_to_str(unused_vars);
                const var_tags = vars.map((v) => 
                    (<Badge key={v} color="blue" size="xs">{v}</Badge>)
                );
                return (
                    <div key={"r"+res_idx} className="response-box" style={{ backgroundColor: color_for_llm(res_obj.llm) }}>
                        {var_tags}
                        {eatenvars.includes('LLM') ?
                              ps
                            : (<div className="response-item-llm-name-wrapper">
                                    {ps}
                                    <h1>{res_obj.llm}</h1>
                              </div>)
                        }
                    </div>
                );
            });
            const className = eatenvars.length > 0 ? "response-group" : "";
            const boxesClassName = eatenvars.length > 0 ? "response-boxes-wrapper" : "";
            return (
                <div className={className} style={{ backgroundColor: rgroup_color(eatenvars.length) }}>
                    {header}
                    <div className={boxesClassName}>
                        {resp_boxes}
                    </div>
                </div>
            );
        }

        // Bucket responses by the first var in the list, where
        // we also bucket any 'leftover' responses that didn't have the requested variable (a kind of 'soft fail')
        const group_name = varnames[0];
        const [grouped_resps, leftover_resps] = (group_name === 'LLM') 
                                                ? groupResponsesBy(resps, (r => r.llm)) 
                                                : groupResponsesBy(resps, (r => ((group_name in r.vars) ? r.vars[group_name] : null)));
        const get_header = (group_name === 'LLM') 
                            ? ((key, val) => (<Badge key={val} color="violet" size="sm">{val}</Badge>))
                            : ((key, val) => getHeaderBadge(key, val));
        
        // Now produce nested divs corresponding to the groups
        const remaining_vars = varnames.slice(1);
        const updated_eatenvars = eatenvars.concat([group_name]);
        const grouped_resps_divs = Object.keys(grouped_resps).map(g => groupByVars(grouped_resps[g], remaining_vars, updated_eatenvars, get_header(group_name, g)));
        const leftover_resps_divs = leftover_resps.length > 0 ? groupByVars(leftover_resps, remaining_vars, updated_eatenvars, get_header(group_name, undefined)) : [];

        return (<>
            {header ? 
                (<div key={group_name} className="response-group" style={{ backgroundColor: rgroup_color(eatenvars.length) }}>
                    {header}
                    <div className="response-boxes-wrapper">
                        {grouped_resps_divs}
                    </div>
                </div>)
                : <div>{grouped_resps_divs}</div>}
            {leftover_resps_divs.length === 0 ? (<></>) : (
                <div key={'__unspecified_group'} className="response-group">
                    {leftover_resps_divs}
                </div>
            )}
        </>);
    };

    // Produce DIV elements grouped by selected vars
    const divs = groupByVars(responses, selected_vars, [], null);
    setResponses(divs);

  }, [multiSelectValue, multiSelectVars]);

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

            // Find all vars in responses
            let found_vars = new Set();
            json.responses.forEach(res_obj => {
                Object.keys(res_obj.vars).forEach(v => {
                    found_vars.add(v);
                });
            });

            // Set the variables accessible in the MultiSelect for 'group by'
            setMultiSelectVars(Array.from(found_vars).map(name => (
                // We add a $ prefix to mark this as a prompt parameter, and so 
                // in the future we can add special types of variables without name collisions
                {value: `${name}`, label: name} 
            )).concat({value: 'LLM', label: 'LLM'}));

            // If this is an initial run or the multi select value is empty, set to group by 'LLM' by default:
            let selected_vars = multiSelectValue;
            if (multiSelectValue.length === 0) {
                setMultiSelectValue(['LLM']);
                selected_vars = ['LLM'];
            }

            setJSONResponses(json.responses);
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

  // When the user clicks an item in the drop-down,
  // we want to autoclose the multiselect drop-down:
  const multiSelectRef = useRef(null);
  const handleMultiSelectValueChange = (new_val) => {
    if (multiSelectRef) {
        multiSelectRef.current.blur();
    }
    setMultiSelectValue(new_val);
  };

  return (
    <div className="inspector-node cfnode">
    <NodeLabel title={data.title || 'Inspect Node'} 
                nodeId={id}
                icon={'🔍'} />
      <MultiSelect   ref={multiSelectRef}
                     onChange={handleMultiSelectValueChange}
                     className='nodrag nowheel'
                     label={<span style={{marginTop: '0px', fontWeight: 'normal'}}>Group responses by (order matters):</span>}
                     data={multiSelectVars}
                     placeholder="Pick vars to group responses, in order of importance"
                     size="xs"
                     value={multiSelectValue}
                     clearSearchOnChange={true}
                     clearSearchOnBlur={true} />
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