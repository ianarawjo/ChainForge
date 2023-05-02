import React, { useEffect, useState, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import StatusIndicator from './StatusIndicatorComponent'
import NodeLabel from './NodeLabelComponent'
import TemplateHooks from './TemplateHooksComponent'
import LLMList from './LLMListComponent'

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
    return pairs.join('; ');
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

const PromptNode = ({ data, id }) => {

  // Get state from the Zustand store:
  const edges = useStore((state) => state.edges);
  const output = useStore((state) => state.output);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const getNode = useStore((state) => state.getNode);

  const [hovered, setHovered] = useState(false);
  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const [promptText, setPromptText] = useState(data.prompt);
  const [promptTextOnLastRun, setPromptTextOnLastRun] = useState(null);
  const [selectedLLMs, setSelectedLLMs] = useState(['gpt3.5']);
  const [status, setStatus] = useState('none');
  const [responsePreviews, setReponsePreviews] = useState([]);
  const [numGenerations, setNumGenerations] = useState(data.n || 1);
  
  const handleMouseEnter = () => {
    setHovered(true);
  };
  const handleMouseLeave = () => {
    setHovered(false);
  };

  const handleInputChange = (event) => {
    const value = event.target.value;

    // Store prompt text
    setPromptText(value);
    data['prompt'] = value;

    // Update status icon, if need be:
    if (promptTextOnLastRun !== null) {
        if (status !== 'warning' && value !== promptTextOnLastRun) {
            setStatus('warning');
        } else if (status === 'warning' && value === promptTextOnLastRun) {
            setStatus('ready');
        }
    }

    // Update template var fields + handles
    const braces_regex = /(?<!\\){(.*?)(?<!\\)}/g;  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}
    const found_template_vars = value.match(braces_regex);
    if (found_template_vars && found_template_vars.length > 0) {
        const temp_var_names = found_template_vars.map(
            name => name.substring(1, name.length-1)  // remove brackets {}
        )
        setTemplateVars(temp_var_names);
    } else {
        setTemplateVars([]);
    }
  };

  const handleRunClick = (event) => {
    // Go through all template hooks (if any) and check they're connected:
    const is_fully_connected = templateVars.every(varname => {
        // Check that some edge has, as its target, this node and its template hook:
        return edges.some(e => (e.target == id && e.targetHandle == varname));
    });

    // console.log(templateHooks);

    if (is_fully_connected) {
        console.log('Connected!');

        // Check that there is at least one LLM selected:
        if (selectedLLMs.length === 0) {
            alert('Please select at least one LLM to prompt.')
            return;
        }

        // Set status indicator
        setStatus('loading');

        // Pull data from each source:
        const pulled_data = {};
        const get_outputs = (varnames, nodeId) => {
            console.log(varnames);
            varnames.forEach(varname => {
                // Find the relevant edge(s):
                edges.forEach(e => {
                    if (e.target == nodeId && e.targetHandle == varname) {
                        // Get the immediate output:
                        let out = output(e.source, e.sourceHandle);

                        // Save the var data from the pulled output
                        if (varname in pulled_data)
                            pulled_data[varname] = pulled_data[varname].concat(out);
                        else
                            pulled_data[varname] = out;

                        // Get any vars that the output depends on, and recursively collect those outputs as well:
                        const n_vars = getNode(e.source).data.vars;
                        if (n_vars && Array.isArray(n_vars) && n_vars.length > 0)
                            get_outputs(n_vars, e.source);
                    }
                });
            });
        };
        get_outputs(templateVars, id);

        // Get Pythonic version of the prompt, by adding a $ before any template variables in braces:
        const to_py_template_format = (str) => str.replace(/(?<!\\){(.*?)(?<!\\)}/g, "${$1}")
        const py_prompt_template = to_py_template_format(promptText);

        // Do the same for the vars, since vars can themselves be prompt templates:
        Object.keys(pulled_data).forEach(varname => {
            pulled_data[varname] = pulled_data[varname].map(val => to_py_template_format(val));
        });

        // Run all prompt permutations through the LLM to generate + cache responses:
        fetch('http://localhost:5000/queryllm', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                id: id,
                llm: selectedLLMs,
                prompt: py_prompt_template,
                vars: pulled_data,
                params: {
                    temperature: 0.5,
                    n: numGenerations,
                },
                no_cache: false,
            }),
        }).then(function(response) {
            return response.json();
        }).then(function(json) {
            if (json.responses) {

                // Success! Change status to 'ready':
                setStatus('ready');

                // Save prompt text so we remember what prompt we have responses cache'd for:
                setPromptTextOnLastRun(promptText);

                // Save preview strings of responses, for quick glance
                // Bucket responses by LLM:
                const responses_by_llm = bucketResponsesByLLM(json.responses);
                const colors = ['#cbf078', '#f1b963', '#e46161', '#f8f398', '#defcf9', '#cadefc', '#c3bef0', '#cca8e9'];
                setReponsePreviews(Object.keys(responses_by_llm).map((llm, llm_idx) => {
                    const resp_boxes = responses_by_llm[llm].map((res_obj, idx) => {
                        const num_resp = res_obj['responses'].length;
                        const resp_prevs = res_obj['responses'].map((r, i) => 
                            (<pre className="small-response" key={i}><i>{truncStr(r, 40)}</i><b>({i+1} of {num_resp})</b></pre>)
                        );
                        const vars = vars_to_str(res_obj.vars);
                        return (
                            <div key={idx} className="response-box" style={{ backgroundColor: colors[llm_idx % colors.length] }}>
                                <p className="response-tag">{vars}</p>
                                {resp_prevs}
                            </div>
                        );
                    });
                    return (
                        <div key={llm} className="llm-response-container">
                            <h1>Preview of responses for {llm}:</h1>
                            {resp_boxes}
                        </div>
                    );
                }));

                // Log responses for debugging:
                console.log(json.responses);
            } else {
                console.error(json.error || 'Unknown error when querying LLM');
            }
        });

        console.log(pulled_data);
    } else {
        console.log('Not connected! :(');

        // TODO: Blink the names of unconnected params
    }
  }

  const handleLLMChecked = (event) => {
    console.log(event.target.value, event.target.checked);
    if (event.target.checked) {
        if (!selectedLLMs.includes(event.target.value)) {
            // Add the selected LLM to the list:
            setSelectedLLMs(selectedLLMs.concat([event.target.value]))
        }
    } else {
        if (selectedLLMs.includes(event.target.value)) {
            // Remove the LLM from the selected list:
            const removeByIndex = (array, index) => array.filter((_, i) => i !== index);
            setSelectedLLMs(removeByIndex(selectedLLMs, selectedLLMs.indexOf(event.target.value)));
        }
    }
  }

  const handleNumGenChange = (event) => {
    let n = event.target.value;
    if (!isNaN(n) && n.length > 0 && /^\d+$/.test(n)) {
        // n is an integer; save it
        n = parseInt(n);
        setNumGenerations(n);
        setDataPropsForNode(id, {n: n});
    }
  };

//   const nodeLabelRef = React.useRef(null);
//   const makeEditable = () => {
//     if (nodeLabelRef.current) {
//         for (const child of nodeLabelRef.current.children) {
//             console.log(child.children);
//             child.contentEditable = 'true';
//         }
//     }
//   };

  const hideStatusIndicator = () => {
    if (status !== 'none') { setStatus('none'); }
  };
  
  const borderStyle = hovered
    ? '1px solid #222'
    : '1px solid #999';

  const llm_list_data = [
    {
      "position": 6,
      "mass": 12.011,
      "symbol": "C",
      "name": "Carbon"
    },
    {
      "position": 7,
      "mass": 14.007,
      "symbol": "N",
      "name": "Nitrogen"
    },
    {
      "position": 39,
      "mass": 88.906,
      "symbol": "Y",
      "name": "Yttrium"
    }
  ];

  return (
    <div 
      className="prompt-node"
      style={{ border: borderStyle }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="node-header drag-handle">
        <NodeLabel title={data.title || 'Prompt Node'} 
                   nodeId={id} 
                   onEdit={hideStatusIndicator} />
        <StatusIndicator status={status} />
        <button className="AmitSahoo45-button-3 nodrag" onClick={handleRunClick}><div className="play-button"></div></button>
      </div>
      <div className="input-field">
        <textarea
          rows="4"
          cols="40"
          defaultValue={data.prompt}
          onChange={handleInputChange}
          className="nodrag"
        />
        <Handle
          type="source"
          position="right"
          id="prompt"
          style={{ top: '50%', background: '#555' }}
        />
      </div>
      <TemplateHooks vars={templateVars} nodeId={id} startY={140} />
      <div>
        <div style={{marginBottom: '10px', padding: '4px'}}>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Num responses per prompt:&nbsp;</label>
            <input id="num-generations" name="num-generations" type="number" min={1} max={50} defaultValue={data.n || 1} onChange={handleNumGenChange} className="nodrag"></input>
        </div>
        <div id="llms-list" style={{backgroundColor: '#eee', padding: '8px', boxShadow: 'inset 0 0 30px #fff'}}>
            <div style={{marginTop: '6px', marginBottom: '6px', marginLeft: '6px', paddingBottom: '4px', textAlign: 'left', fontSize: '10pt', color: '#777'}}>
                Models to query:
                <div className="add-llm-model-btn nodrag">
                    <button>Add +</button>
                </div>
            </div>
            
            <div className="nodrag">
                <LLMList data={llm_list_data} />
                {/* <input type="checkbox" id="gpt3.5" name="gpt3.5" value="gpt3.5" defaultChecked={true} onChange={handleLLMChecked} />
                <label htmlFor="gpt3.5">GPT3.5  </label>
                <input type="checkbox" id="gpt4" name="gpt4" value="gpt4" defaultChecked={false} onChange={handleLLMChecked} />
                <label htmlFor="gpt4">GPT4  </label>
                <input type="checkbox" id="alpaca.7B" name="alpaca.7B" value="alpaca.7B" defaultChecked={false} onChange={handleLLMChecked} />
                <label htmlFor="alpaca.7B">Alpaca 7B</label> */}
            </div>
        </div>
        <div className="response-preview-container nowheel">
            {responsePreviews}
        </div>
      </div>
    </div>
  );
};

export default PromptNode;