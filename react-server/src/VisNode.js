import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle } from 'react-flow-renderer';
import { MultiSelect } from '@mantine/core';
import useStore from './store';
import Plot from 'react-plotly.js';
import NodeLabel from './NodeLabelComponent';
import PlotLegend from './PlotLegend';
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
const getUniqueKeysInResponses = (responses, keyFunc) => {
    let ukeys = new Set();
    responses.forEach(res_obj => 
        ukeys.add(keyFunc(res_obj)));
    return Array.from(ukeys);
};
const extractEvalResultsForMetric = (metric, responses) => {
    return responses.map(resp_obj => resp_obj.eval_res.items.map(item => item[metric])).flat();
};
const areSetsEqual = (xs, ys) =>
    xs.size === ys.size &&
    [...xs].every((x) => ys.has(x));

const VisNode = ({ data, id }) => {

    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const [plotlySpec, setPlotlySpec] = useState([]);
    const [plotlyLayout, setPlotlyLayout] = useState({});
    const [pastInputs, setPastInputs] = useState([]);
    const [responses, setResponses] = useState([]);
    const [status, setStatus] = useState('none');
    const [placeholderText, setPlaceholderText] = useState(<></>);

    const [plotLegend, setPlotLegend] = useState(null);
    const [selectedLegendItems, setSelectedLegendItems] = useState(null);

    // The MultiSelect so people can dynamically set what vars they care about
    const [multiSelectVars, setMultiSelectVars] = useState(data.vars || []);
    const [multiSelectValue, setMultiSelectValue] = useState(data.selected_vars || []);

    // When the user clicks an item in the drop-down,
    // we want to autoclose the multiselect drop-down:
    const multiSelectRef = useRef(null);
    const handleMultiSelectValueChange = (new_val) => {
        if (multiSelectRef) {
            multiSelectRef.current.blur();
        }
        setStatus('loading');
        setMultiSelectValue(new_val);
        setDataPropsForNode(id, { selected_vars: new_val });
    };

    // Re-plot responses when anything changes
    useEffect(() => {
        if (!responses || responses.length === 0 || !multiSelectValue) return;

        setStatus('none');

        // If there are variables but no variables are selected...
        if (multiSelectVars && multiSelectVars.length > 0 && multiSelectValue.length === 0) {
            console.warn('No variables selected to plot.');
            setSelectedLegendItems(null);
            setPlotLegend(null);
            setPlotlySpec([]);
            setPlotlyLayout({});
            setPlaceholderText(
                <p style={{maxWidth: '220px', backgroundColor: '#f0f0aa', padding: '10px', fontSize: '10pt'}}>{
                    "Please select at least one parameter to plot."
                }</p>
            )
            return;
        }

        // Create Plotly spec here
        const varnames = multiSelectValue;
        const colors = ['#44d044', '#f1b933', '#e46161', '#8888f9', '#33bef0', '#bb55f9', '#cadefc', '#f8f398'];
        let spec = [];
        let layout = {
            width: 420, height: 300, title: '', margin: {
                l: 105, r: 0, b: 36, t: 20, pad: 0
            }
        };

        // Bucket responses by LLM:
        let responses_by_llm = {};
        responses.forEach(item => {
            if (item.llm in responses_by_llm)
                responses_by_llm[item.llm].push(item);
            else
                responses_by_llm[item.llm] = [item];
        });
        const llm_names = Object.keys(responses_by_llm);

        // Get the type of evaluation results, if present
        // (This is assumed to be consistent across response batches)
        const typeof_eval_res = 'dtype' in responses[0].eval_res ? responses[0].eval_res['dtype'] : 'Numeric';

        let plot_legend = null;
        let metric_axes_labels = [];
        let num_metrics = 1;
        if (typeof_eval_res.includes('KeyValue')) {
            metric_axes_labels = Object.keys(responses[0].eval_res.items[0]);
            num_metrics = metric_axes_labels.length;

            // if (metric_axes_labels.length > 1)
            //     throw Error('Dict metrics with more than one key are currently unsupported.')
            // TODO: When multiple metrics are present, and 1 var is selected (can be multiple LLMs as well), 
            // default to Parallel Coordinates plot, with the 1 var values on the y-axis as colored groups, and metrics on x-axis.
            // For multiple LLMs, add a control drop-down selector to switch the LLM visualized in the plot.
        }

        const get_items = (eval_res_obj) => {
            if (typeof_eval_res.includes('KeyValue'))
                return eval_res_obj.items.map(item => item[metric_axes_labels[0]]);
            return eval_res_obj.items;
        };

        const plot_grouped_boxplot = (resp_to_x) => {
            // Get all possible values of the single variable response ('name' vals)
            const names = new Set(responses.map(resp_to_x));

            llm_names.forEach((llm, idx) => {
                // Create HTML for hovering over a single datapoint. We must use 'br' to specify line breaks.
                const rs = responses_by_llm[llm];

                let x_items = [];
                let y_items = [];
                let text_items = [];
                for (const name of names) {
                    rs.forEach(r => {
                        if (resp_to_x(r) !== name) return;
                        x_items = x_items.concat(get_items(r.eval_res)).flat();
                        text_items = text_items.concat(createHoverTexts(r.responses)).flat();
                        y_items = y_items.concat(Array(get_items(r.eval_res).length).fill(truncStr(name, 12))).flat();
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
            });
            layout.boxmode = 'group';

            if (metric_axes_labels.length > 0)
                layout.xaxis = { 
                    title: { font: {size: 12}, text: metric_axes_labels[0] },
                };
        };

        if (num_metrics > 1) {
            // For 2 or more metrics, display a parallel coordinates plot.
            // :: For instance, if evaluator produces { height: 32, weight: 120 } plot responses with 2 metrics, 'height' and 'weight'
            if (varnames.length === 1) {
                let unique_vals = getUniqueKeysInResponses(responses, (resp_obj) => resp_obj.vars[varnames[0]]);
                // const response_txts = responses.map(res_obj => res_obj.responses).flat();

                let group_colors = colors;
                const unselected_line_color = '#ddd';
                const spec_colors = responses.map(resp_obj => {
                    const idx = unique_vals.indexOf(resp_obj.vars[varnames[0]]);
                    return Array(resp_obj.eval_res.items.length).fill(idx);
                }).flat();
                
                let colorscale = [];
                for (let i = 0; i < unique_vals.length; i++) {
                    if (!selectedLegendItems || selectedLegendItems.indexOf(unique_vals[i]) > -1)
                        colorscale.push([i / (unique_vals.length-1), group_colors[i % group_colors.length]]);
                    else
                        colorscale.push([i / (unique_vals.length-1), unselected_line_color]);
                }

                let dimensions = [];
                metric_axes_labels.forEach(metric => {
                    const evals = extractEvalResultsForMetric(metric, responses);
                    dimensions.push({
                        range: [Math.min(...evals), Math.max(...evals)],
                        label: metric,
                        values: evals,
                    });
                });

                spec.push({
                    type: 'parcoords',
                    pad: [10, 10, 10, 10],
                    line: {
                        color: spec_colors,
                        colorscale: colorscale,
                    },
                    dimensions: dimensions,
                });
                layout.margin = { l: 40, r: 40, b: 40, t: 50, pad: 0 };
                layout.paper_bgcolor = "white";
                layout.font = {color: "black"};
                layout.selectedpoints = [];
                
                // There's no built-in legend for parallel coords, unfortunately, so we need to construct our own:
                let legend_labels = {}; 
                unique_vals.forEach((v, idx) => {
                    if (!selectedLegendItems || selectedLegendItems.indexOf(v) > -1)
                        legend_labels[v] = group_colors[idx % group_colors.length];
                    else
                        legend_labels[v] = unselected_line_color;
                });
                const onClickLegendItem = (label) => {
                    if (selectedLegendItems && selectedLegendItems.length === 1 && selectedLegendItems[0] === label)
                        setSelectedLegendItems(null);  // Clicking twice on a legend item deselects it and displays all
                    else
                        setSelectedLegendItems([label]);
                };
                plot_legend = (<PlotLegend labels={legend_labels} onClickLabel={onClickLegendItem} />);

                // Tried to support Plotly hover events here, but looks like 
                // currently there are unsupported for parcoords: https://github.com/plotly/plotly.js/issues/3012
                // onHover = (e) => {
                //     console.log(e.curveNumber);
                //     // const curveIdx = e.curveNumber;
                //     // if (curveIdx < response_txts.length) {
                //     //     if (!selectedLegendItems || selectedLegendItems.indexOf(unique_vals[spec_colors[curveIdx]]) > -1)
                //     //         console.log(response_txts[curveIdx]);
                //     // }
                // };

            } else {
                setSelectedLegendItems(null);
                const error_text = "Plotting evaluations with more than one metric and more than one prompt parameter is currently unsupported.";
                setPlaceholderText(
                    <p style={{maxWidth: '220px', backgroundColor: '#f0aaaa', padding: '10px', fontSize: '10pt'}}>{error_text}</p>
                )
                console.error(error_text);
            }
        }
        else { // A single metric --use plots like grouped box-and-whiskers, 3d scatterplot
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
                            x_items = x_items.concat(get_items(r.eval_res));
                            text_items = text_items.concat(createHoverTexts(r.responses));
                        });
                        spec.push(
                            {type: 'box', x: x_items, name: truncStr(name, 12), boxpoints: 'all', text: text_items, hovertemplate: '%{text}', orientation: 'h'}
                        );
                    }
                    layout.hovermode = 'closest';

                    if (metric_axes_labels.length > 0)
                        layout.xaxis = { 
                            title: { font: {size: 12}, text: metric_axes_labels[0] },
                        };
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
                    z: responses.map(r => get_items(r.eval_res).reduce((acc, val) => (acc + val), 0) / r.eval_res.items.length), // calculates mean
                    mode: 'markers',
                }
            }
        }

        if (!Array.isArray(spec))
            spec = [spec];

        setPlotLegend(plot_legend);
        setPlotlySpec(spec);
        setPlotlyLayout(layout);
        
    }, [multiSelectVars, multiSelectValue, responses, selectedLegendItems]);
  
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

                const varnames = Object.keys(json.responses[0].vars);
                const msvars = varnames.map(name => ({value: name, label: name}));

                // Check for a change in available parameters
                if (!multiSelectVars || !multiSelectValue || !areSetsEqual(new Set(varnames), new Set(multiSelectVars.map(o => o.value)))) {
                    setMultiSelectValue(varnames);
                    setMultiSelectVars(msvars);
                    setDataPropsForNode(id, { vars: msvars, selected_vars: varnames });
                }
                // From here a React effect will detect the changes to these values and display a new plot
            }
        });
        // Analyze its structure --how many 'vars'?


        // Based on its structure, construct a Plotly data visualization
        // :: For 1 var and 1 eval_res that's a number, plot {x: var, y: eval_res}
        // :: For 2 vars and 1 eval_res that's a number, plot {x: var1, y: var2, z: eval_res}
        // :: For all else, don't plot anything (at the moment)
    }, [data]);
    
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
                   status={status}
                   icon={'📊'} />
        <MultiSelect ref={multiSelectRef}
                     onChange={handleMultiSelectValueChange}
                     className='nodrag nowheel'
                     data={multiSelectVars}
                     placeholder="Pick params you wish to plot"
                     size="sm"
                     value={multiSelectValue}
                     searchable />
        <div className="nodrag">
            {plotlySpec && plotlySpec.length > 0 ? (
                <Plot
                    data={plotlySpec}
                    layout={plotlyLayout}
                />) : placeholderText}
            {plotLegend ? plotLegend : <></>}
        </div>
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