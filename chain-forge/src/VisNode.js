import React, { useState, useEffect, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import Plot from 'react-plotly.js';
import { hover } from '@testing-library/user-event/dist/hover';

const VisNode = ({ data, id }) => {

    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const [hovered, setHovered] = useState(false);
    const [plotlyObj, setPlotlyObj] = useState([]);
    const [pastInputs, setPastInputs] = useState([]);
    
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
    const preventDefault = (event) => {
      console.log(event);
      event.preventDefault();
    }
  
    const handleOnConnect = useCallback(() => {
        // Grab the input node ids
        const input_node_ids = [data.input];

        const response = fetch('http://localhost:5000/grabResponses', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                responses: input_node_ids,
            }),
        }).then(function(res) {
            return res.json();
        }).then(function(json) {
            console.log('got responses');
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
                    width: 420, height: 380, title: '', margin: {
                        l: 40, r: 20, b: 20, t: 20, pad: 2
                    }
                }

                // Helper funcs
                let splitAndAddBreaks = (s, chunkSize) => {
                    // Split the input string into chunks of specified size
                    let chunks = [];
                    for (let i = 0; i < s.length; i += chunkSize) {
                        chunks.push(s.slice(i, i + chunkSize));
                    }
                  
                    // Join the chunks with a <br> tag
                    return chunks.join('<br>');
                }
                let truncStr = (s, maxLen) => {
                    if (s.length > maxLen) // Cut the name short if it's long
                        return s.substring(0, maxLen) + '...'
                    else
                        return s;
                }

                if (varnames.length === 1) {
                    // 1 var; numeric eval
                    // spec = {
                    //     type: 'bar',
                    //     x: json.responses.map(r => r.vars[varnames[0]]),
                    //     y: json.responses.map(r => r.eval_res.mean),
                    // }
                    if (Object.keys(responses_by_llm).length === 1) {
                        // Simple box plot, as there is only a single LLM in the response
                        spec = json.responses.map(r => {
                            // Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
                            const hover_texts = r.responses.map(s => {
                                // If responses were reduced across dimensions, this could include several. Pick the first and mark it as one of many:
                                if (Array.isArray(s)) {
                                    const s_len = s.length;
                                    return s.map((substr, idx) => splitAndAddBreaks(substr, 60) + `<br><b>(${idx+1} of ${s_len})</b>`);
                                } else
                                    return [splitAndAddBreaks(s, 60)];
                            }).flat();

                            // Use the var value to 'name' this group of points:
                            const s = truncStr(r.vars[varnames[0]].trim(), 12);

                            return {type: 'box', y: r.eval_res.items, name: s, boxpoints: 'all', text: hover_texts, hovertemplate: '%{text}'};
                        });
                        layout.hovermode = 'closest';
                    } else {
                        // There are multiple LLMs in the response; do a grouped box plot by LLM.
                        // Note that 'name' is now the LLM, and 'x' stores the value of the var: 
                        spec = [];
                        const colors = ['#cbf078', '#f1b963', '#e46161', '#f8f398', '#defcf9', '#cadefc', '#c3bef0', '#cca8e9'];
                        Object.keys(responses_by_llm).forEach((llm, idx) => {
                            const rs = responses_by_llm[llm];
                            spec.push({
                                type: 'box',
                                name: llm,
                                marker: {color: colors[idx % colors.length]},
                                y: rs.map(r => r.eval_res.items).flat(),
                                x: rs.map(r => Array(r.eval_res.items.length).fill(r.vars[varnames[0]].trim())).flat(),
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

    const borderStyle = hovered
      ? '1px solid #222'
      : '1px solid #999';
  
    return (
      <div 
        className="vis-node"
        style={{ border: borderStyle }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="node-header">
          Vis Node
        </div>
        <div onMouseDownCapture={stopDragPropagation} onClick={stopDragPropagation}>{plotlyObj}</div>
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