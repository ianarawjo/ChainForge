import React, { useState, useEffect, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import Plot from 'react-plotly.js';
import { hover } from '@testing-library/user-event/dist/hover';
import { create } from 'zustand';
import NodeLabel from './NodeLabelComponent';
import {BASE_URL} from './store';

// Helper funcs
const truncStr = (s, maxLen) => {
    if (s.length > maxLen) // Cut the name short if it's long
        return s.substring(0, maxLen) + '...'
    else
        return s;
}
const splitAndAddBreaks = (s, chunkSize) => {
    // Split the input string into chunks of specified size
    let chunks = [];
    for (let i = 0; i < s.length; i += chunkSize) {
        chunks.push(s.slice(i, i + chunkSize));
    }

    // Join the chunks with a <br> tag
    return chunks.join('<br>');
}
// Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
const createHoverTexts = (responses) => {
    const max_len = 500;
    return responses.map(s => {
        // If responses were reduced across dimensions, this could include several. Pick the first and mark it as one of many:
        if (Array.isArray(s)) {
            const s_len = s.length;
            return s.map((substr, idx) => splitAndAddBreaks(truncStr(substr, max_len), 60) + `<br><b>(${idx+1} of ${s_len})</b>`);
        } else
            return [splitAndAddBreaks(truncStr(s, max_len), 60)];
    }).flat();
}

const VisNode = ({ data, id }) => {

    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const [plotlyObj, setPlotlyObj] = useState([]);
    const [pastInputs, setPastInputs] = useState([]);
  
    const handleOnConnect = useCallback(() => {
        // Grab the input node ids
        const input_node_ids = [data.input];

        fetch(BASE_URL + 'grabResponses', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                responses: input_node_ids,
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

                // Create Plotly spec here
                const varnames = Object.keys(json.responses[0].vars);
                let spec = {};
                let layout = {
                    width: 420, height: 300, title: '', margin: {
                        l: 40, r: 20, b: 20, t: 20, pad: 2
                    }
                }

                if (varnames.length === 1) {
                    // 1 var; numeric eval
                    if (Object.keys(responses_by_llm).length === 1) {
                        // Simple box plot, as there is only a single LLM in the response
                        spec = json.responses.map(r => {
                            // Use the var value to 'name' this group of points:
                            const s = truncStr(r.vars[varnames[0]].trim(), 12);

                            return {type: 'box', y: r.eval_res.items, name: s, boxpoints: 'all', text: createHoverTexts(r.responses), hovertemplate: '%{text}'};
                        });
                        layout.hovermode = 'closest';
                    } else {
                        // There are multiple LLMs in the response; do a grouped box plot by LLM.
                        // Note that 'name' is now the LLM, and 'x' stores the value of the var: 
                        spec = [];
                        const colors = ['#cbf078', '#f1b963', '#e46161', '#f8f398', '#defcf9', '#cadefc', '#c3bef0', '#cca8e9'];
                        Object.keys(responses_by_llm).forEach((llm, idx) => {
                            // Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
                            const rs = responses_by_llm[llm];
                            const hover_texts = rs.map(r => createHoverTexts(r.responses)).flat();
                            spec.push({
                                type: 'box',
                                name: llm,
                                marker: {color: colors[idx % colors.length]},
                                y: rs.map(r => r.eval_res.items).flat(),
                                x: rs.map(r => Array(r.eval_res.items.length).fill(r.vars[varnames[0]].trim())).flat(),
                                boxpoints: 'all',
                                text: hover_texts,
                                hovertemplate: '%{text}',
                            });
                        });
                        layout.boxmode = 'group';
                    }
                }
                else if (varnames.length === 2) {
                    // Input is 2 vars; numeric eval
                    // Display a 3D scatterplot with 2 dimensions:
                    spec = {
                        type: 'scatter3d',
                        x: json.responses.map(r => r.vars[varnames[0]]).map(s => truncStr(s, 12)),
                        y: json.responses.map(r => r.vars[varnames[1]]).map(s => truncStr(s, 12)),
                        z: json.responses.map(r => r.eval_res.mean),
                        mode: 'markers',
                    }
                }

                if (!Array.isArray(spec))
                    spec = [spec];

                setPlotlyObj((
                    <Plot
                        data={spec}
                        layout={layout}
                    />
                ))

            } else {

            }
        });
        // Analyze its structure --how many 'vars'?


        // Based on its structure, construct a Plotly data visualization
        // :: For 1 var and 1 eval_res that's a number, plot {x: var, y: eval_res}
        // :: For 2 vars and 1 eval_res that's a number, plot {x: var1, y: var2, z: eval_res}
        // :: For all else, don't plot anything (at the moment)
    }, [data, setPlotlyObj]);
    
    // console.log('from visnode', data);
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
      <div className="vis-node cfnode">
        <div className="node-header">
            <NodeLabel title={data.title || 'Vis Node'} 
                       nodeId={id}
                       icon={'📊'} />
        </div>
        <div className="nodrag">{plotlyObj}</div>
        <Handle
            type="target"
            position="left"
            id="input"
            style={{ top: '50%', background: '#555' }}
            onConnect={handleOnConnect}
        />
      </div>
    );
  };
  
  export default VisNode;