import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Handle } from 'reactflow';
import { NativeSelect } from '@mantine/core';
import useStore, { colorPalettes } from './store';
import Plot from 'react-plotly.js';
import BaseNode from './BaseNode';
import NodeLabel from './NodeLabelComponent';
import PlotLegend from './PlotLegend';
import fetch_from_backend from './fetch_from_backend';

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
const extractEvalResultsForMetric = (metric, responses) => {
    return responses.map(resp_obj => resp_obj.eval_res.items.map(item => item[metric])).flat();
};
const areSetsEqual = (xs, ys) =>
    xs.size === ys.size &&
    [...xs].every((x) => ys.has(x));

function addLineBreaks(str, max_line_len) {
    if (!str || (typeof str !== 'string') || str.length === 0)
        return '';
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
    const max_lines = 8;
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
    const [multiSelectValue, setMultiSelectValue] = useState(
        (Array.isArray(data.selected_vars) && data.selected_vars.length > 0) ? 
            data.selected_vars[0] : 'LLM (default)');

    // Typically, a user will only need the default LLM 'group' --all LLMs in responses.
    // However, when prompts are chained together, the original LLM info is stored in metavars as a key. 
    // LLM groups allow you to plot against the original LLMs, even though a 'scorer' LLM might come after. 
    const [availableLLMGroups, setAvailableLLMGroups] = useState(data.llm_groups || ['LLM']);
    const [selectedLLMGroup, setSelectedLLMGroup] = useState(data.selected_llm_group || 'LLM');
    const handleChangeLLMGroup = (new_val) => {
        setSelectedLLMGroup(new_val.target.value);
        setDataPropsForNode(id, { selected_llm_group: new_val.target.value });
    };

    // When the user clicks an item in the drop-down,
    // we want to autoclose the multiselect drop-down:
    const multiSelectRef = useRef(null);
    const handleMultiSelectValueChange = (new_val) => {
        if (multiSelectRef) {
            multiSelectRef.current.blur();
        }
        setStatus('loading');
        setMultiSelectValue(new_val.target.value);
        setDataPropsForNode(id, { selected_vars: [new_val.target.value] });
    };

    // Re-plot responses when anything changes
    useEffect(() => {
        if (!responses || responses.length === 0 || !multiSelectValue) return;

        // Check if there are evaluation results 
        if (responses.every(r => r?.eval_res === undefined)) {
            setPlaceholderText(<p style={{maxWidth: '220px', backgroundColor: '#f0f0aa', padding: '10px', fontSize: '10pt'}}>
                To plot evaluation results, you need to run LLM responses through an Evaluator Node or LLM Scorer Node first.
            </p>);
            return;
        }

        setStatus('none');

        const get_llm = (resp_obj) => {
            if (selectedLLMGroup === 'LLM')
                return typeof resp_obj.llm === "string" ? resp_obj.llm : resp_obj.llm?.name;
            else
                return resp_obj.metavars[selectedLLMGroup];
        };
        const getLLMsInResponses = (responses) => getUniqueKeysInResponses(responses, get_llm);

        // Get all LLMs in responses, by selected LLM group
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
        const varnames = (multiSelectValue !== 'LLM (default)' && multiSelectValue !== undefined) ? [multiSelectValue] : [];
        const varcolors = colorPalettes.var; // ['#44d044', '#f1b933', '#e46161', '#8888f9', '#33bef0', '#bb55f9', '#cadefc', '#f8f398'];
        let spec = [];
        let layout = {
            autosize: true, 
            dragmode: 'pan',
            title: '', 
            margin: {
                l: 125, r: 0, b: 36, t: 20, pad: 6
            },
            yaxis: {showgrid: true},
        };

        // Bucket responses by LLM:
        let responses_by_llm = {};
        responses.forEach(item => {
            const llm = get_llm(item);
            if (llm in responses_by_llm)
                responses_by_llm[llm].push(item);
            else
                responses_by_llm[llm] = [item];
        });

        // Get the type of evaluation results, if present
        // (This is assumed to be consistent across response batches)
        let typeof_eval_res = (responses[0].eval_res && 'dtype' in responses[0].eval_res) ? responses[0].eval_res['dtype'] : 'Numeric';

        // If categorical type, check if all binary:
        if (typeof_eval_res === 'Categorical') {
            const is_all_bools = responses.reduce((acc0, res_obj) => acc0 && res_obj.eval_res.items.reduce((acc, cur) => acc && typeof cur === 'boolean', true), true);
            if (is_all_bools) typeof_eval_res = 'Boolean';
        }

        // Check the max length of eval results, as if it's only 1 score per item (num of generations per prompt n=1), 
        // we might want to plot the result differently:
       let max_num_results_per_prompt = 1;
       responses.forEach(res_obj => {
        if (res_obj.eval_res?.items?.length > max_num_results_per_prompt)
            max_num_results_per_prompt = res_obj.eval_res.items.length;
       });

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
            if (eval_res_obj === undefined) return [];
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
                            :   getColorForLLMAndSetIfNotFound(get_llm(responses[0]));
                marker_colors.push(color);
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
                            //:   varcolors[name_idx % varcolors.length];
                            :   getColorForLLMAndSetIfNotFound(get_llm(responses[0]));

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
                    layout.yaxis = { showticklabels: true, dtick: 1, type: 'category', showgrid: true };
                    layout.xaxis = { title: { font: {size: 12}, text: "Number of 'true' values" }, ...layout.xaxis};
                } else {
                    // Plot a boxplot for all other cases.
                    // x_items = [x_items.reduce((val, acc) => val + acc, 0)];
                    let d = {
                        name: shortnames[name], 
                        x: x_items, 
                        text: text_items, 
                        hovertemplate: '%{text}', 
                        orientation: 'h',
                        marker: { color: color }
                    };

                    // If only one result, plot a bar chart:
                    if (x_items.length === 1) {
                        d.type = 'bar';
                        d.textposition = 'none'; // hide the text which appears within each bar
                        d.y = new Array(x_items.length).fill(shortnames[name]);
                    } else {
                        // If multiple eval results per response object (num generations per prompt n > 1),
                        // plot box-and-whiskers to illustrate the variability:
                        d.type = 'box';
                        d.boxpoints = 'all';
                    }
                    spec.push(d);
                }
            }
            layout.hovermode = 'closest';
            layout.showlegend = false;

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
                    layout.xaxis = { title: { font: {size: 12}, text: "Number of 'true' values" }, ...layout.xaxis};
                } else {
                    // Plot a boxplot or bar chart for other cases.
                    let d = {
                        name: llm,
                        marker: {color: getColorForLLMAndSetIfNotFound(llm)},
                        x: x_items,
                        y: y_items,
                        boxpoints: 'all',
                        text: text_items,
                        hovertemplate: '%{text} <b><i>(%{x})</i></b>',
                        orientation: 'h',
                    };

                    // If only one result, plot a bar chart:
                    if (max_num_results_per_prompt === 1) {
                        d.type = 'bar';
                        d.textposition = 'none'; // hide the text which appears within each bar
                    } else {
                        // If multiple eval results per response object (num generations per prompt n > 1),
                        // plot box-and-whiskers to illustrate the variability:
                        d.type = 'box';
                    }

                    spec.push(d);
                    layout.xaxis = {
                        title: { font: {size: 12}, text: 'score' },
                        ...layout.axis
                    };
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
                    plot_accuracy(get_llm, 'llm')
                else
                    plot_simple_boxplot(get_llm, 'llm');
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
                        const resps = responses.filter((r) => get_llm(r) === llm);
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
        
    }, [multiSelectVars, multiSelectValue, selectedLLMGroup, responses, selectedLegendItems, plotDivRef]);
  
    const handleOnConnect = useCallback(() => {
        // Grab the input node ids
        const input_node_ids = [data.input];

        fetch_from_backend(
            'grabResponses',
            {responses: input_node_ids}
        ).then(function(json) {
            if (json.responses && json.responses.length > 0) {

                // Store responses and extract + store vars
                setResponses(json.responses.toReversed());

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

                // Get all vars for the y-axis dropdown, merging metavars and vars into one list, 
                // and excluding any special 'LLM group' metavars:
                const msvars = ['LLM (default)'].concat(varnames.map(name => ({value: name, label: name})))
                                                .concat(metavars.filter(name => !name.startsWith('LLM_'))
                                                                .map(name => ({value: `__meta_${name}`, label: `${name} (meta)`})));

                // Find all the special 'LLM group' metavars and put them in the 'group by' dropdown:
                let available_llm_groups = [{value: 'LLM', label: 'LLM'}].concat(
                                                metavars.filter(name => name.startsWith('LLM_'))
                                                        .map(name => ({value: name, label: `LLMs #${parseInt(name.slice(4)) + 1}`})));
                if (available_llm_groups.length > 1)
                    available_llm_groups[0] = {value: 'LLM', label: 'LLMs (last)'};
                setAvailableLLMGroups(available_llm_groups);

                // Check for a change in available parameters
                if (!multiSelectVars || !multiSelectValue || !areSetsEqual(new Set(msvars.map(o => o.value)), new Set(multiSelectVars.map(o => o.value)))) {
                    setMultiSelectValue('LLM (default)');
                    setMultiSelectVars(msvars);
                    setDataPropsForNode(id, { vars: msvars, selected_vars: [], llm_groups: available_llm_groups });
                }
                // From here a React effect will detect the changes to these values and display a new plot
            }
        });

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
      <BaseNode classNames="vis-node" nodeId={id}>
        <NodeLabel title={data.title || 'Vis Node'} 
                   nodeId={id}
                   status={status}
                   icon={'📊'} />
        <div style={{display: 'flex', justifyContent: 'center', flexWrap: 'wrap'}}>
            <div style={{display: 'inline-flex', maxWidth: '50%'}}>
                <span style={{fontSize: '10pt', margin: '6pt 3pt 0 3pt', fontWeight: 'bold', whiteSpace: 'nowrap'}}>y-axis:</span>
                <NativeSelect ref={multiSelectRef}
                            onChange={handleMultiSelectValueChange}
                            className='nodrag nowheel'
                            data={multiSelectVars}
                            placeholder="Pick param to plot"
                            size="xs"
                            value={multiSelectValue}
                            miw='80px' />
            </div>
            <div style={{display: 'inline-flex', justifyContent: 'space-evenly', maxWidth: '30%', marginLeft: '10pt'}}>
                <span style={{fontSize: '10pt', margin: '6pt 3pt 0 0', fontWeight: 'bold', whiteSpace: 'nowrap'}}>x-axis:</span>
                <NativeSelect className='nodrag nowheel'
                            data={['score']}
                            size="xs"
                            value={'score'}
                            miw='80px'
                            disabled />
            </div>
            <div style={{display: 'inline-flex', justifyContent: 'space-evenly', maxWidth: '30%', marginLeft: '10pt'}}>
                <span style={{fontSize: '10pt', margin: '6pt 3pt 0 0', fontWeight: 'bold', whiteSpace: 'nowrap'}}>group by:</span>
                <NativeSelect className='nodrag nowheel'
                            onChange={handleChangeLLMGroup}
                            data={availableLLMGroups}
                            size="xs"
                            value={selectedLLMGroup}
                            miw='80px'
                            disabled={availableLLMGroups.length <= 1} />
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
            className="grouped-handle"
            style={{ top: '50%' }}
            onConnect={handleOnConnect}
        />
      </BaseNode>
    );
  };
  
  export default VisNode;