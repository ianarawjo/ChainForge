import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle } from 'react-flow-renderer';
import { MultiSelect } from '@mantine/core';
import useStore, { colorPalettes } from './store';
import Plot from 'react-plotly.js';
import NodeLabel from './NodeLabelComponent';
import PlotLegend from './PlotLegend';
import {BASE_URL} from './store';

// Helper funcs
const truncStr = (s, maxLen) => {
    if (s === undefined) return s;
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
const getLLMsInResponses = (responses) => getUniqueKeysInResponses(responses, (resp_obj) => resp_obj.llm);
const extractEvalResultsForMetric = (metric, responses) => {
    return responses.map(resp_obj => resp_obj.eval_res.items.map(item => item[metric])).flat();
};
const areSetsEqual = (xs, ys) =>
    xs.size === ys.size &&
    [...xs].every((x) => ys.has(x));

function addLineBreaks(str, max_line_len) {
    let result = '';
    const is_alphabetical = (s) => /^[A-Za-z]$/.test(s);
    for (var i = 0; i < str.length; i++) {
        result += str[i];
        if ((i + 1) % max_line_len === 0) {
            const next_char = i+1 < str.length ? str[i+1] : '';
            result += (is_alphabetical(str[i]) && is_alphabetical(next_char) ? '-' : '') + '<br>';
        }
    }
    return result;
} 
const genUniqueShortnames = (names, max_chars_per_line=32) => {
    // Generate unique 'shortnames' to refer to each name:
    let past_shortnames_counts = {};
    let shortnames = {};
    const max_lines = 2;
    for (const name of names) {
        // Truncate string up to maximum num of chars
        let sn = truncStr(name, max_chars_per_line * max_lines - 3);
        // Add <br> tags to spread across multiple lines, where necessary
        sn = addLineBreaks(sn, max_chars_per_line);
        if (sn in past_shortnames_counts) {
            past_shortnames_counts[sn] += 1;
            shortnames[name] = sn + `(${past_shortnames_counts[sn]})`;
        } else {
            shortnames[name] = sn;
            past_shortnames_counts[sn] = 1;
        }
    }
    return shortnames;
};
const calcMaxCharsPerLine = (shortnames) => {
    let max_chars = 1;
    for (let i = 0; i < shortnames.length; i++) {
        const sn = shortnames[i];
        if (sn.includes('<br>'))
            return sn.indexOf('<br>');
        else if (sn.length > max_chars)
            max_chars = sn.length;
    }
    return Math.max(max_chars, 9);
};
const calcLeftPaddingForYLabels = (shortnames) => {
    return calcMaxCharsPerLine(shortnames) * 7;
}

const VisNode = ({ data, id }) => {

    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const getColorForLLMAndSetIfNotFound = useStore((state) => state.getColorForLLMAndSetIfNotFound);

    const [plotlySpec, setPlotlySpec] = useState([]);
    const [plotlyLayout, setPlotlyLayout] = useState({});
    const [pastInputs, setPastInputs] = useState([]);
    const [responses, setResponses] = useState([]);
    const [status, setStatus] = useState('none');
    const [placeholderText, setPlaceholderText] = useState(<></>);

    const [plotLegend, setPlotLegend] = useState(null);
    const [selectedLegendItems, setSelectedLegendItems] = useState(null);

    const plotDivRef = useRef(null);
    const plotlyRef = useRef(null);

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

        const llm_names = getLLMsInResponses(responses);

        // If there are variables but no variables are selected and only 1 LLM is present...
        // if (llm_names.length <= 1 && multiSelectVars && multiSelectVars.length > 0 && multiSelectValue.length === 0) {
        //     console.warn('No variables selected to plot.');
        //     setSelectedLegendItems(null);
        //     setPlotLegend(null);
        //     setPlotlySpec([]);
        //     setPlotlyLayout({});
        //     setPlaceholderText(
        //         <p style={{maxWidth: '220px', backgroundColor: '#f0f0aa', padding: '10px', fontSize: '10pt'}}>{
        //             "Please select at least one parameter to plot."
        //         }</p>
        //     )
        //     return;
        // }

        // Create Plotly spec here
        const varnames = multiSelectValue;
        const varcolors = colorPalettes.var; // ['#44d044', '#f1b933', '#e46161', '#8888f9', '#33bef0', '#bb55f9', '#cadefc', '#f8f398'];
        let spec = [];
        let layout = {
            autosize: true, title: '', margin: {
                l: 125, r: 0, b: 36, t: 20, pad: 6
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

        // Get the type of evaluation results, if present
        // (This is assumed to be consistent across response batches)
        let typeof_eval_res = 'dtype' in responses[0].eval_res ? responses[0].eval_res['dtype'] : 'Numeric';

        // If categorical type, check if all binary:
        if (typeof_eval_res === 'Categorical') {
            const is_all_bools = responses.reduce((acc0, res_obj) => acc0 && res_obj.eval_res.items.reduce((acc, cur) => acc && typeof cur === 'boolean', true), true);
            if (is_all_bools) typeof_eval_res = 'Boolean';
        }

        let plot_legend = null;
        let metric_axes_labels = [];
        let num_metrics = 1;
        if (typeof_eval_res.includes('KeyValue')) {
            metric_axes_labels = Object.keys(responses[0].eval_res.items[0]);
            num_metrics = metric_axes_labels.length;
        }

        const get_var = (resp_obj, varname, empty_str_if_undefined=false) => {
            const v = varname.startsWith('__meta_') ? 
                      resp_obj.metavars[varname.slice('__meta_'.length)] : 
                      resp_obj.vars[varname];
            if (v === undefined && empty_str_if_undefined)
                return "";
            return v;
        };

        const get_var_and_trim = (resp_obj, varname, empty_str_if_undefined=false) => {
            const v = get_var(resp_obj, varname, empty_str_if_undefined);
            if (v !== undefined) return v.trim();
            else return v;
        };

        const get_items = (eval_res_obj) => {
            if (typeof_eval_res.includes('KeyValue'))
                return eval_res_obj.items.map(item => item[metric_axes_labels[0]]);
            return eval_res_obj.items;
        };

        // Only for Boolean data
        const plot_accuracy = (resp_to_x, group_type) => {
            // Plots the percentage of 'true' evaluations out of the total number of evaluations,
            // per category of 'resp_to_x', as a horizontal bar chart, with different colors per category.
            let names = new Set(responses.map(resp_to_x));
            const shortnames = genUniqueShortnames(names);   
            let name_idx = 0;
            let x_items = [];
            let y_items = [];
            let marker_colors = [];
            for (const name of names) {
                 // Add a shortened version of the name as the y-tick
                 y_items.push(shortnames[name]);
                 
                // Calculate how much percentage a single 'true' value counts for:
                const num_eval_scores = responses.reduce((acc, r) => {
                    if (resp_to_x(r) !== name) return acc;
                    else return acc + get_items(r.eval_res).length;
                }, 0);
                const perc_scalar = 100 / num_eval_scores;

                // Calculate the length of the bar
                x_items.push(
                    responses.reduce((acc, r) => {
                        if (resp_to_x(r) !== name) return acc;
                        else return acc + get_items(r.eval_res).filter(res => res === true).length * perc_scalar;
                    }, 0)
                )

                // Lookup the color per LLM when displaying LLM differences, 
                // otherwise use the palette for displaying variables.
                const color = (group_type === 'llm') ? 
                                getColorForLLMAndSetIfNotFound(name) 
                            :   getColorForLLMAndSetIfNotFound(responses[0].llm);
                marker_colors.push(color);
                name_idx += 1;
            }
            
            // Set the left margin to fit the yticks labels
            layout.margin.l = calcLeftPaddingForYLabels(Object.values(shortnames));

            spec = [{
                type: 'bar',
                y: y_items,
                x: x_items,
                marker: {
                    color: marker_colors,
                },
                // error_x: { // TODO: Error bars
                //     type: 'data',
                //     array: [0.5, 1, 2],
                //     visible: true
                // },
                hovertemplate: '%{x:.2f}\%<extra>%{y}</extra>',
                showtrace: false,
                orientation: 'h',
            }];
            layout.xaxis = { range: [0, 100], tickmode: "linear", tick0: 0, dtick: 10 };

            if (metric_axes_labels.length > 0)
                layout.xaxis = { 
                    title: { font: {size: 12}, text: metric_axes_labels[0] },
                    ...layout.xaxis,
                };
            else
                layout.xaxis = {
                    title: { font: {size: 12}, text: '% percent true' },
                    ...layout.xaxis,
                };
        };

        const plot_simple_boxplot = (resp_to_x, group_type) => {
            let names = new Set();
            const plotting_categorical_vars = group_type === 'var' && typeof_eval_res === 'Categorical';

            // When we're plotting vars, we want the stacked bar colors to be the *categories*,
            // and the x_items to be the names of vars, so that the left axis is a vertical list of varnames.
            if (plotting_categorical_vars) {
                // Get all categories present in the evaluation results
                responses.forEach(r => get_items(r.eval_res).forEach(i => names.add(i)));
            } else {
                // Get all possible values of the single variable response ('name' vals)
                names = new Set(responses.map(resp_to_x));
            }

            const shortnames = genUniqueShortnames(names);
            let name_idx = 0;
            for (const name of names) {
                let x_items = [];
                let text_items = [];

                if (plotting_categorical_vars) {
                    responses.forEach(r => {
                        // Get all evaluation results for this response which match the category 'name':
                        const eval_res = get_items(r.eval_res).filter(i => i === name);
                        x_items = x_items.concat(new Array(eval_res.length).fill(resp_to_x(r)));
                    });
                } else {
                    responses.forEach(r => {
                        if (resp_to_x(r) !== name) return;
                        x_items = x_items.concat(get_items(r.eval_res));
                        text_items = text_items.concat(createHoverTexts(r.responses));
                    });
                }

                // Lookup the color per LLM when displaying LLM differences, 
                // otherwise use the palette for displaying variables.
                const color = (group_type === 'llm') ? 
                                getColorForLLMAndSetIfNotFound(name) 
                            :   varcolors[name_idx % varcolors.length];

                if (typeof_eval_res === 'Boolean' || typeof_eval_res === 'Categorical')  {
                    // Plot a histogram for categorical data.
                    spec.push({
                        type: 'histogram',
                        histfunc: "sum",
                        name: shortnames[name],
                        marker: {color: color},
                        y: x_items,
                        orientation: 'h',
                    });
                    layout.barmode = "stack";
                    layout.yaxis = { showticklabels: true, dtick: 1, type: 'category' };
                } else {
                    // Plot a boxplot for all other cases.
                    spec.push({
                        type: 'box', 
                        name: shortnames[name], 
                        boxpoints: 'all', 
                        x: x_items, 
                        text: text_items, 
                        hovertemplate: '%{text}', 
                        orientation: 'h',
                        marker: { color: color }
                    });
                }

                name_idx += 1;
            }
            layout.hovermode = 'closest';

            // Set the left margin to fit the yticks labels
            layout.margin.l = calcLeftPaddingForYLabels(Object.values(shortnames));

            if (metric_axes_labels.length > 0)
                layout.xaxis = { 
                    title: { font: {size: 12}, text: metric_axes_labels[0] },
                    ...layout.xaxis,
                };
        };

        const plot_grouped_boxplot = (resp_to_x) => {
            // Get all possible values of the single variable response ('name' vals)
            const names = new Set(responses.map(resp_to_x));
            const shortnames = genUniqueShortnames(names);

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
                        y_items = y_items.concat(Array(get_items(r.eval_res).length).fill(shortnames[name])).flat();
                    });
                }

                if (typeof_eval_res === 'Boolean') {
                    // Plot a histogram for boolean (true/false) categorical data.
                    spec.push({
                        type: 'histogram',
                        histfunc: "sum",
                        name: llm,
                        marker: {color: getColorForLLMAndSetIfNotFound(llm)},
                        x: x_items.map(i => i === true ? "1" : "0"),
                        y: y_items,
                        orientation: 'h',
                    });
                    layout.barmode = "stack";
                } else {
                    // Plot a boxplot for all other cases.
                    spec.push({
                        type: 'box',
                        name: llm,
                        marker: {color: getColorForLLMAndSetIfNotFound(llm)},
                        x: x_items,
                        y: y_items,
                        boxpoints: 'all',
                        text: text_items,
                        hovertemplate: '%{text} <b><i>(%{x})</i></b>',
                        orientation: 'h',
                    });
                }
            });
            layout.boxmode = 'group';
            layout.bargap = 0.5;

            // Set the left margin to fit the yticks labels
            layout.margin.l = calcLeftPaddingForYLabels(Object.values(shortnames));

            if (metric_axes_labels.length > 0)
                layout.xaxis = { 
                    title: { font: {size: 12}, text: metric_axes_labels[0] },
                };
        };

        if (num_metrics > 1) {
            // For 2 or more metrics, display a parallel coordinates plot.
            // :: For instance, if evaluator produces { height: 32, weight: 120 } plot responses with 2 metrics, 'height' and 'weight'
            if (varnames.length === 1) {
                let unique_vals = getUniqueKeysInResponses(responses, (resp_obj) => get_var(resp_obj, varnames[0]));
                // const response_txts = responses.map(res_obj => res_obj.responses).flat();

                let group_colors = varcolors;
                const unselected_line_color = '#ddd';
                const spec_colors = responses.map(resp_obj => {
                    const idx = unique_vals.indexOf(get_var(resp_obj, varnames[0]));
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
                if (typeof_eval_res === 'Boolean')
                    plot_accuracy((r) => r.llm, 'llm')
                else
                    plot_simple_boxplot((r) => r.llm, 'llm');
            }
            else if (varnames.length === 1) {
                // 1 var; numeric eval
                if (llm_names.length === 1) {
                    if (typeof_eval_res === 'Boolean')
                        // Accuracy plot per value of the selected variable:
                        plot_accuracy((r) => get_var_and_trim(r, varnames[0]), 'var');
                    else {
                        // Simple box plot, as there is only a single LLM in the response
                        plot_simple_boxplot((r) => get_var_and_trim(r, varnames[0]), 'var');
                    }
                } else {
                    // There are multiple LLMs in the response; do a grouped box plot by LLM.
                    // Note that 'name' is now the LLM, and 'x' stores the value of the var: 
                    plot_grouped_boxplot((r) => get_var_and_trim(r, varnames[0]), 'var');
                }
            }
            else if (varnames.length === 2) {
                // Input is 2 vars; numeric eval
                // Display a 3D scatterplot with 2 dimensions:

                const names_0 = new Set(responses.map(r => get_var_and_trim(r, varnames[0])));
                const shortnames_0 = genUniqueShortnames(names_0);
                const names_1 = new Set(responses.map(r => get_var_and_trim(r, varnames[1])));
                const shortnames_1 = genUniqueShortnames(names_1);

                if (llm_names.length === 1) {
                    spec = {
                        type: 'scatter3d',
                        x: responses.map(r => get_var(r, varnames[0], true)).map(s => shortnames_0[s]),
                        y: responses.map(r => get_var(r, varnames[1], true)).map(s => shortnames_1[s]),
                        z: responses.map(r => get_items(r.eval_res).reduce((acc, val) => (acc + val), 0) / r.eval_res.items.length), // calculates mean
                        mode: 'markers',
                        marker: {
                            color: getColorForLLMAndSetIfNotFound(llm_names[0])
                        }
                    };
                } else {
                    spec = [];
                    llm_names.forEach(llm => {
                        const resps = responses.filter((r) => r.llm === llm);
                        spec.push({
                            type: 'scatter3d',
                            x: resps.map(r => get_var(r, varnames[0], true)).map(s => shortnames_0[s]),
                            y: resps.map(r => get_var(r, varnames[1], true)).map(s => shortnames_1[s]),
                            z: resps.map(r => get_items(r.eval_res).reduce((acc, val) => (acc + val), 0) / r.eval_res.items.length), // calculates mean
                            mode: 'markers',
                            marker: {
                                color: getColorForLLMAndSetIfNotFound(llm)
                            },
                            name: llm,
                        });
                    });
                }
            }
        }

        if (!Array.isArray(spec))
            spec = [spec];

        setPlotLegend(plot_legend);
        setPlotlySpec(spec);
        setPlotlyLayout(layout);

        // if (plotDivRef && plotDivRef.current) {
        //     plotDivRef.current.style.width = '300px';
        // }
        
    }, [multiSelectVars, multiSelectValue, responses, selectedLegendItems, plotDivRef]);
  
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

                // Find all vars in responses
                let varnames = new Set();
                let metavars = new Set();
                json.responses.forEach(resp_obj => {
                    Object.keys(resp_obj.vars).forEach(v => varnames.add(v));
                    if (resp_obj.metavars)
                        Object.keys(resp_obj.metavars).forEach(v => metavars.add(v));
                });
                varnames = Array.from(varnames);
                metavars = Array.from(metavars);

                const msvars = varnames.map(name => ({value: name, label: name})).concat(
                    metavars.map(name => ({value: `__meta_${name}`, label: `${name} (meta)`}))
                );

                // Check for a change in available parameters
                if (!multiSelectVars || !multiSelectValue || !areSetsEqual(new Set(msvars.map(o => o.value)), new Set(multiSelectVars.map(o => o.value)))) {
                    setMultiSelectValue([]);
                    setMultiSelectVars(msvars);
                    console.log('here');
                    setDataPropsForNode(id, { vars: msvars, selected_vars: [] });
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
  
    // Resizing the plot when div is resized:
    const setPlotDivRef = useCallback((elem) => {
        // To listen for resize events of the textarea, we need to use a ResizeObserver.
        // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div wrapping the Plotly vis.
        if (!plotDivRef.current && window.ResizeObserver) {
          const observer = new ResizeObserver(() => {
            if (!plotlyRef || !plotlyRef.current || !plotlyRef.current.resizeHandler || !plotlySpec || plotlySpec.length === 0) return;
            // The below calls Plotly.Plots.resize() on the specific element
            plotlyRef.current.resizeHandler();
          });
    
          observer.observe(elem);
        }
        plotDivRef.current = elem;
      }, [plotDivRef, plotlySpec]);

    return (
      <div className="vis-node cfnode">
        <NodeLabel title={data.title || 'Vis Node'} 
                   nodeId={id}
                   status={status}
                   icon={'📊'} />
        <div style={{display: 'flex', justifyContent: 'center', flexWrap: 'wrap', width: '100%'}}>
            <div style={{display: 'inline-flex', maxWidth: '50%'}}>
                <span style={{fontSize: '10pt', margin: '6pt 3pt 0 3pt', fontWeight: 'bold', whiteSpace: 'nowrap'}}>y-axis:</span>
                <MultiSelect ref={multiSelectRef}
                            onChange={handleMultiSelectValueChange}
                            className='nodrag nowheel'
                            data={multiSelectVars}
                            placeholder="Pick param to plot"
                            size="xs"
                            value={multiSelectValue}
                            miw='80px'
                            searchable />
            </div>
            <div style={{display: 'inline-flex', justifyContent: 'space-evenly', maxWidth: '40%', marginLeft: '10pt'}}>
                <span style={{fontSize: '10pt', margin: '6pt 3pt 0 0', fontWeight: 'bold', whiteSpace: 'nowrap'}}>x-axis:</span>
                <MultiSelect className='nodrag nowheel'
                            data={['score']}
                            size="xs"
                            value={['score']}
                            miw='80px'
                            disabled />
            </div>
            <div style={{display: 'inline-flex', justifyContent: 'space-evenly', maxWidth: '40%', marginLeft: '10pt'}}>
                <span style={{fontSize: '10pt', margin: '6pt 3pt 0 0', fontWeight: 'bold', whiteSpace: 'nowrap'}}>group by:</span>
                <MultiSelect className='nodrag nowheel'
                            data={['LLM']}
                            size="xs"
                            value={['LLM']}
                            miw='80px'
                            disabled />
            </div>
        </div>
        <hr />
        <div className="nodrag" ref={setPlotDivRef} style={{minWidth: '150px', minHeight: '100px'}}>
            {plotlySpec && plotlySpec.length > 0 ? <></> : placeholderText}
                <Plot
                    ref={plotlyRef}
                    data={plotlySpec}
                    layout={plotlyLayout}
                    useResizeHandler={true}
                    className="plotly-vis"
                    style={{display: (plotlySpec && plotlySpec.length > 0 ? 'block' : 'none')}}
                />
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