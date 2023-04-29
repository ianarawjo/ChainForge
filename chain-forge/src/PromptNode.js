import React, { useEffect, useState, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import StatusIndicator from './StatusIndicatorComponent'
import NodeLabel from './NodeLabelComponent'

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

  const genTemplateHooks = (temp_var_names, names_to_blink) => {
    return temp_var_names.map(
        (name, idx) => {
            const className = (names_to_blink.includes(name)) ? 'text-blink' : '';
            const pos = (idx * 35) + 140 + 'px';
            const style = { top: pos,  background: '#555' };
            return (
                <div key={name} className={className} >
                <p>{name}</p>
                <Handle
                    type="target"
                    position="left"
                    id={name}
                    style={style}
                />
                </div>
            )
        }
    );
  };

  const [hovered, setHovered] = useState(false);
  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const [templateHooks, setTemplateHooks] = useState(genTemplateHooks(data.vars || [], []));
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

    const braces_regex = /(?<!\\){(.*?)(?<!\\)}/g;  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}
    const found_template_vars = value.match(braces_regex);
    if (found_template_vars && found_template_vars.length > 0) {
        const temp_var_names = found_template_vars.map(
            name => name.substring(1, name.length-1)
        )
        setTemplateVars(temp_var_names);
        setTemplateHooks(
            genTemplateHooks(temp_var_names, [])
        );
        setDataPropsForNode(id, {vars: temp_var_names});
    } else {
        setTemplateHooks([]);
        setDataPropsForNode(id, {vars: []});
    }
  };

  const handleRunClick = (event) => {
    // Go through all template hooks (if any) and check they're connected:
    const is_fully_connected = templateHooks.every(hook => {
        // Check that some edge has, as its target, this node and its template hook:
        return edges.some(e => (e.target == id && e.targetHandle == hook.key));
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
        templateHooks.forEach(hook => {
            // Find the relevant edge (breaking once we've found it):
            for (let i = 0; i < edges.length; i++) {
                const e = edges[i];
                if (e.target == id && e.targetHandle == hook.key) {
                    // Get the data output for that handle on the source node:
                    let out = output(e.source, e.sourceHandle);
                    if (!Array.isArray(out)) out = [out];
                    if (hook.key in pulled_data)
                        pulled_data[hook.key] = pulled_data[hook.key].concat(out);
                    else
                        pulled_data[hook.key] = out;
                }
            }
        });

        // Get Pythonic version of the prompt, by adding a $ before any template variables in braces:
        const py_prompt_template = promptText.replace(/(?<!\\){(.*?)(?<!\\)}/g, "${$1}")

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

        // Blink the names of unconnected params:
        const names_to_blink = templateVars.filter(name => {
            return !edges.some(e => (e.target == id && e.targetHandle == name));
        });
        setTemplateHooks(
            genTemplateHooks(templateVars, names_to_blink)
        );

        // Set timeout to turn off blinking:
        setTimeout(() => {
            setTemplateHooks(
                genTemplateHooks(templateVars, [])
            );
        }, 750*2);
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
      <div className="template-hooks"> 
        {templateHooks}
      </div>
      <div>
        <hr />
        <div>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Num responses per prompt:&nbsp;</label>
            <input id="num-generations" name="num-generations" type="number" min={1} max={50} defaultValue={data.n || 1} onChange={handleNumGenChange} className="nodrag"></input>
        </div>
        <hr />
        <p style={{marginTop: 0}} >LLMs:</p>
        <div className="nodrag">
            <input type="checkbox" id="gpt3.5" name="gpt3.5" value="gpt3.5" defaultChecked={true} onChange={handleLLMChecked} />
            <label htmlFor="gpt3.5">GPT3.5  </label>
            <input type="checkbox" id="alpaca.7B" name="alpaca.7B" value="alpaca.7B" onChange={handleLLMChecked} />
            <label htmlFor="alpaca.7B">Alpaca 7B</label>
        </div>
        <hr />
        <div className="response-preview-container nowheel">
            {responsePreviews}
        </div>
      </div>
    </div>
  );
};

export default PromptNode;