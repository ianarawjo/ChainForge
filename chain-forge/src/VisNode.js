import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle } from 'react-flow-renderer';
import { MultiSelect } from '@mantine/core';
import useStore from './store';
import Plot from 'react-plotly.js';
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
    const [responses, setResponses] = useState([]);

    // The MultiSelect so people can dynamically set what vars they care about
    const [multiSelectVars, setMultiSelectVars] = useState(data.vars || []);
    const [multiSelectValue, setMultiSelectValue] = useState(data.selected_vars || []);

    // Re-plot responses when anything changes
    useEffect(() => {
        if (!responses || responses.length === 0 || !multiSelectValue || multiSelectValue.length === 0) return;

        // Bucket responses by LLM:
        let responses_by_llm = {};
        responses.forEach(item => {
            if (item.llm in responses_by_llm)
                responses_by_llm[item.llm].push(item);
            else
                responses_by_llm[item.llm] = [item];
        });
        const llm_names = Object.keys(responses_by_llm);

        // Create Plotly spec here
        const varnames = multiSelectValue;
        const colors = ['#cbf078', '#f1b963', '#e46161', '#f8f398', '#defcf9', '#cadefc', '#c3bef0', '#cca8e9'];
        let spec = [];
        let layout = {
            width: 420, height: 300, title: '', margin: {
                l: 105, r: 0, b: 20, t: 20, pad: 0
            }
        }

        const plot_grouped_boxplot = (resp_to_x) => {
            llm_names.forEach((llm, idx) => {
                // Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
                const rs = responses_by_llm[llm];

                // Get all possible values of the single variable response ('name' vals)
                const names = new Set(responses.map(resp_to_x));
                let x_items = [];
                let y_items = [];
                let text_items = [];
                for (const name of names) {
                    rs.forEach(r => {
                        if (r.vars[varnames[0]].trim() !== name) return;
                        x_items = x_items.concat(r.eval_res.items).flat();
                        text_items = text_items.concat(createHoverTexts(r.responses)).flat();
                        y_items = y_items.concat(Array(r.eval_res.items.length).fill(truncStr(name, 12))).flat();
                    });
                }

                spec.push({
                    type: 'box',
                    name: llm,
                    marker: {color: colors[idx % colors.length]},
                    x: x_items,
                    y: y_items,
                    boxpoints: 'all',
                    text: text_items,
                    hovertemplate: '%{text} <b><i>(%{x})</i></b>',
                    orientation: 'h',
                });

                // const hover_texts = rs.map(r => createHoverTexts(r.responses)).flat();
                // spec.push({
                //     type: 'box',
                //     name: llm,
                //     marker: {color: colors[idx % colors.length]},
                //     x: rs.map(r => r.eval_res.items).flat(),
                //     y: rs.map(r => Array(r.eval_res.items.length).fill(resp_to_x(r))).flat(),
                //     boxpoints: 'all',
                //     text: hover_texts,
                //     hovertemplate: '%{text} <b><i>(%{x})</i></b>',
                //     orientation: 'h',
                // });
            });
            layout.boxmode = 'group';
        };

        if (varnames.length === 0) {
            // No variables means they used a single prompt (no template) to generate responses
            // (Users are likely evaluating differences in responses between LLMs)
            plot_grouped_boxplot((r) => truncStr(r.prompt.trim(), 12));
        }
        else if (varnames.length === 1) {
            // 1 var; numeric eval
            if (llm_names.length === 1) {
                // Simple box plot, as there is only a single LLM in the response
                // Get all possible values of the single variable response ('name' vals)
                const names = new Set(responses.map(r => r.vars[varnames[0]].trim()));
                for (const name of names) {
                    let x_items = [];
                    let text_items = [];
                    responses.forEach(r => {
                        if (r.vars[varnames[0]].trim() !== name) return;
                        x_items = x_items.concat(r.eval_res.items);
                        text_items = text_items.concat(createHoverTexts(r.responses));
                    });
                    spec.push(
                        {type: 'box', x: x_items, name: truncStr(name, 12), boxpoints: 'all', text: text_items, hovertemplate: '%{text}', orientation: 'h'}
                    );
                }
                layout.hovermode = 'closest';
            } else {
                // There are multiple LLMs in the response; do a grouped box plot by LLM.
                // Note that 'name' is now the LLM, and 'x' stores the value of the var: 
                plot_grouped_boxplot((r) => r.vars[varnames[0]].trim());
            }
        }
        else if (varnames.length === 2) {
            // Input is 2 vars; numeric eval
            // Display a 3D scatterplot with 2 dimensions:
            spec = {
                type: 'scatter3d',
                x: responses.map(r => r.vars[varnames[0]]).map(s => truncStr(s, 12)),
                y: responses.map(r => r.vars[varnames[1]]).map(s => truncStr(s, 12)),
                z: responses.map(r => r.eval_res.mean),
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
    }, [multiSelectVars, multiSelectValue, responses]);
  
    const handleOnConnect = useCallback(() => {
        // Grab the input node ids
        const input_node_ids = [data.input];

        fetch(BASE_URL + 'app/grabResponses', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                responses: input_node_ids,
            }),
        }).then(function(res) {
            return res.json();
        }).then(function(json) {
            if (json.responses && json.responses.length > 0) {

                // Store responses and extract + store vars
                setResponses(json.responses);

                const varnames = Object.keys(json.responses[0].vars)
                setMultiSelectVars(
                    varnames.map(name => ({value: name, label: name}))
                );
                setMultiSelectValue(varnames);

                // From here a React effect will detect the changes to these values and display a new plot
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
        <NodeLabel title={data.title || 'Vis Node'} 
                   nodeId={id}
                   icon={'📊'} />
        <MultiSelect onChange={setMultiSelectValue}
                     className='nodrag nowheel'
                     data={multiSelectVars}
                     placeholder="Pick all vars you wish to plot"
                     size="sm"
                     value={multiSelectValue}
                     searchable />
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