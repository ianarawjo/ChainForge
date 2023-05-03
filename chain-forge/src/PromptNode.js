import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import { Menu, Badge } from '@mantine/core';
import { v4 as uuid } from 'uuid';
import useStore from './store';
import StatusIndicator from './StatusIndicatorComponent'
import NodeLabel from './NodeLabelComponent'
import TemplateHooks from './TemplateHooksComponent'
import LLMList from './LLMListComponent'
import AlertModal from './AlertModal'
import {BASE_URL} from './store';

// Available LLMs
const allLLMs = [
    { name: "GPT3.5", emoji: "🙂", model: "gpt3.5", temp: 1.0 },
    { name: "GPT4", emoji: "🥵", model: "gpt4", temp: 1.0 },
    { name: "Alpaca 7B", emoji: "🦙", model: "alpaca.7B", temp: 0.5 },
    { name: "Claude v1", emoji: "📚", model: "claude.v1", temp: 0.5 },
    { name: "Ian Chatbot", emoji: "💩", model: "test", temp: 0.5 }
];
const initLLMs = [allLLMs[0]];

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

const PromptNode = ({ data, id }) => {

  // Get state from the Zustand store:
  const edges = useStore((state) => state.edges);
  const output = useStore((state) => state.output);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const getNode = useStore((state) => state.getNode);

  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const [promptText, setPromptText] = useState(data.prompt);
  const [promptTextOnLastRun, setPromptTextOnLastRun] = useState(null);
  const [status, setStatus] = useState('none');
  const [responsePreviews, setReponsePreviews] = useState([]);
  const [numGenerations, setNumGenerations] = useState(data.n || 1);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // Selecting LLM models to prompt
  const [llmItems, setLLMItems] = useState(initLLMs.map((i, idx) => ({key: uuid(), ...i})));
  const [llmItemsCurrState, setLLMItemsCurrState] = useState([]);

  const addModel = useCallback((model) => {
    // Get the item for that model
    let item = allLLMs.find(llm => llm.model === model);

    if (!item) {  // This should never trigger, but in case it does:
        alertModal.current.trigger(`Could not find model named '${model}' in list of available LLMs.`);
        return;
    }

    // Give it a uid as a unique key (this is needed for the draggable list to support multiple same-model items; keys must be unique)
    item = {key: uuid(), ...item};

    // Add model to LLM list (regardless of it's present already or not). 
    setLLMItems(llmItemsCurrState.concat([item]))
  }, [llmItemsCurrState]);

  const onLLMListItemsChange = useCallback((new_items) => {
    setLLMItemsCurrState(new_items);
  }, [setLLMItemsCurrState]);

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
        if (llmItemsCurrState.length === 0) {
            alert('Please select at least one LLM to prompt.')
            return;
        }

        // Set status indicator
        setStatus('loading');

        // Pull data from each source, recursively:
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

        const rejected = (err) => {
            setStatus('error');
            alertModal.current.trigger(err.message);
        };

        // Run all prompt permutations through the LLM to generate + cache responses:
        fetch(BASE_URL + 'queryllm', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                id: id,
                llm: llmItemsCurrState.map(item => item.model),
                prompt: py_prompt_template,
                vars: pulled_data,
                params: {
                    temperature: 0.5,
                    n: numGenerations,
                },
                no_cache: false,
            }),
        }, rejected).then(function(response) {
            return response.json();
        }, rejected).then(function(json) {
            if (!json) {
                setStatus('error');
                alertModal.current.trigger('Request was sent and received by backend server, but there was no response.');
            }
            else if (json.responses) {

                // Success! Change status to 'ready':
                setStatus('ready');

                // Save prompt text so we remember what prompt we have responses cache'd for:
                setPromptTextOnLastRun(promptText);

                // Save preview strings of responses, for quick glance
                // Bucket responses by LLM:
                const responses_by_llm = bucketResponsesByLLM(json.responses);
                // const colors = ['#cbf078', '#f1b963', '#e46161', '#f8f398', '#defcf9', '#cadefc', '#c3bef0', '#cca8e9'];
                // const colors = ['green', 'yellow', 'orange', 'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'gray', 'cyan', 'lime'];
                setReponsePreviews(Object.keys(responses_by_llm).map((llm, llm_idx) => {
                    const resp_boxes = responses_by_llm[llm].map((res_obj, idx) => {
                        const num_resp = res_obj['responses'].length;
                        const resp_prevs = res_obj['responses'].map((r, i) => 
                            (<pre className="small-response" key={i}><i>{truncStr(r, 40)}</i><b>({i+1} of {num_resp})</b></pre>)
                        );
                        const vars = vars_to_str(res_obj.vars);
                        const var_tags = vars.map((v, i) => (
                            <Badge key={v} color="green" size="xs">{v}</Badge>
                        ));
                        return (
                            <div key={idx} className="response-box">
                                {var_tags}
                                {/* <p className="response-tag">{vars}</p> */}
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
                setStatus('error');
                alertModal.current.trigger(json.error || 'Unknown error when querying LLM');
            }
        }, rejected);

        console.log(pulled_data);
    } else {
        console.log('Not connected! :(');
        alertModal.current.trigger('Missing inputs to one or more template variables.')

        // TODO: Blink the names of unconnected params
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

  const hideStatusIndicator = () => {
    if (status !== 'none') { setStatus('none'); }
  };

  return (
    <div className="prompt-node cfnode">
    <NodeLabel title={data.title || 'Prompt Node'} 
                nodeId={id} 
                onEdit={hideStatusIndicator}
                icon={'💬'} 
                status={status}
                alertModal={alertModal}
                handleRunClick={handleRunClick}
                />
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
      <TemplateHooks vars={templateVars} nodeId={id} startY={145} />
      <hr />
      <div>
        <div style={{marginBottom: '10px', padding: '4px'}}>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Num responses per prompt:&nbsp;</label>
            <input id="num-generations" name="num-generations" type="number" min={1} max={50} defaultValue={data.n || 1} onChange={handleNumGenChange} className="nodrag"></input>
        </div>
        <div id="llms-list" className="nowheel" style={{backgroundColor: '#eee', borderRadius: '4px', padding: '8px', overflowY: 'auto', maxHeight: '175px'}}>
            <div style={{marginTop: '6px', marginBottom: '6px', marginLeft: '6px', paddingBottom: '4px', textAlign: 'left', fontSize: '10pt', color: '#777'}}>
                Models to query:
                <div className="add-llm-model-btn nodrag">
                    <Menu transitionProps={{ transition: 'pop-top-left' }}
                        position="bottom-start"
                        width={220}
                        withinPortal={true}
                    >
                        <Menu.Target>
                            <button>Add +</button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {allLLMs.map(item => (<Menu.Item key={item.model} onClick={() => addModel(item.model)} icon={item.emoji}>{item.name}</Menu.Item>))}
                        </Menu.Dropdown>
                    </Menu>
                </div>
            </div>
            
            <div className="nodrag">
                <LLMList llms={llmItems} onItemsChange={onLLMListItemsChange} />
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