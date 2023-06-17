import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import { Menu, Badge, Progress } from '@mantine/core';
import { v4 as uuid } from 'uuid';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import TemplateHooks, { extractBracketedSubstrings, toPyTemplateFormat } from './TemplateHooksComponent'
import LLMList from './LLMListComponent'
import LLMResponseInspectorModal from './LLMResponseInspectorModal';
import {BASE_URL} from './store';
import io from 'socket.io-client';
import { getDefaultModelSettings, AvailableLLMs } from './ModelSettingSchemas'

// The LLM(s) to include by default on a PromptNode whenever one is created.
// Defaults to ChatGPT (GPT3.5).
const initLLMs = [AvailableLLMs[0]];

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
// Ensure that a name is 'unique'; if not, return an amended version with a count tacked on (e.g. "GPT-4 (2)")
const ensureUniqueName = (_name, _prev_names) => {
    // Strip whitespace around names
    const prev_names = _prev_names.map(n => n.trim());
    const name = _name.trim();
  
    // Check if name is unique
    if (!prev_names.includes(name))
      return name;
    
    // Name isn't unique; find a unique one:
    let i = 2;
    let new_name = `${name} (${i})`;
    while (prev_names.includes(new_name)) {
      i += 1;
      new_name = `${name} (${i})`;
    }
    return new_name;
};

const PromptNode = ({ data, id }) => {

  // Get state from the Zustand store:
  const edges = useStore((state) => state.edges);
  const output = useStore((state) => state.output);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const outputEdgesForNode = useStore((state) => state.outputEdgesForNode);
  const getNode = useStore((state) => state.getNode);

  // API Keys (set by user in popup GlobalSettingsModal)
  const apiKeys = useStore((state) => state.apiKeys);

  const [jsonResponses, setJSONResponses] = useState(null);
  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const [promptText, setPromptText] = useState(data.prompt || "");
  const [promptTextOnLastRun, setPromptTextOnLastRun] = useState(null);
  const [status, setStatus] = useState('none');
  const [responsePreviews, setResponsePreviews] = useState([]);
  const [numGenerations, setNumGenerations] = useState(data.n || 1);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef(null);

  // Selecting LLM models to prompt
  const [llmItems, setLLMItems] = useState(data.llms || initLLMs.map((i) => ({key: uuid(), settings: getDefaultModelSettings(i.base_model), ...i})));
  const [llmItemsCurrState, setLLMItemsCurrState] = useState([]);
  const resetLLMItemsProgress = useCallback(() => {
    setLLMItems(llmItemsCurrState.map(item => {
        item.progress = undefined;
        return item;
    }));
  }, [llmItemsCurrState]);
  const ensureLLMItemsErrorProgress = useCallback((llm_keys_w_errors) => {
    setLLMItems(llmItemsCurrState.map(item => {
        if (llm_keys_w_errors.includes(item.key)) {
            if (!item.progress)
                item.progress = { success: 0, error: 100 };
            else {
                const succ_perc = item.progress.success;
                item.progress = { success: succ_perc, error: 100 - succ_perc };
            }
        } else {
            if (item.progress && item.progress.success === 0)
                item.progress = undefined;
        }

        return item;
    }));
  }, [llmItemsCurrState]);
  
  const getLLMListItemForKey = useCallback((key) => {
    return llmItemsCurrState.find((item) => item.key === key);
  }, [llmItemsCurrState]);

  // Progress when querying responses
  const [progress, setProgress] = useState(undefined);
  const [progressAnimated, setProgressAnimated] = useState(true);
  const [runTooltip, setRunTooltip] = useState(null);

  const triggerAlert = useCallback((msg) => {
    setProgress(undefined);
    resetLLMItemsProgress();
    alertModal.current.trigger(msg);
  }, [resetLLMItemsProgress, alertModal]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && jsonResponses)
        inspectModal.current.trigger();
  }, [inspectModal, jsonResponses]);

  const addModel = useCallback((model) => {
    // Get the item for that model
    let item = AvailableLLMs.find(llm => llm.base_model === model);

    if (!item) {  // This should never trigger, but in case it does:
        triggerAlert(`Could not find model named '${model}' in list of available LLMs.`);
        return;
    }

    // Give it a uid as a unique key (this is needed for the draggable list to support multiple same-model items; keys must be unique)
    item = {key: uuid(), ...item};

    // Generate the default settings for this model
    item.settings = getDefaultModelSettings(model);

    // Repair names to ensure they are unique
    const unique_name = ensureUniqueName(item.name, llmItemsCurrState.map(i => i.name));
    item.name = unique_name;
    item.formData = { 'shortname': unique_name };

    // Add model to LLM list (regardless of it's present already or not). 
    setLLMItems(llmItemsCurrState.concat([item]))
  }, [llmItemsCurrState]);

  const onLLMListItemsChange = useCallback((new_items) => {
    setLLMItemsCurrState(new_items);
    setDataPropsForNode(id, { llms: new_items });
  }, [setLLMItemsCurrState]);

  const refreshTemplateHooks = (text) => {
    // Update template var fields + handles
    const found_template_vars = extractBracketedSubstrings(text);  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}
    setTemplateVars(found_template_vars);
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

    refreshTemplateHooks(value);
  };

  // On initialization
  useEffect(() => {
    refreshTemplateHooks(promptText);
  }, []);

  // Pull all inputs needed to request responses.
  // Returns [prompt, vars dict]
  const pullInputData = () => {
    // Pull data from each source recursively:
    const pulled_data = {};
    const store_data = (_texts, _varname, _data) => {
        if (_varname in _data)
            _data[_varname] = _data[_varname].concat(_texts);
        else
            _data[_varname] = _texts;
    };
    const get_outputs = (varnames, nodeId) => {
        varnames.forEach(varname => {
            // Find the relevant edge(s):
            edges.forEach(e => {
                if (e.target == nodeId && e.targetHandle == varname) {
                    // Get the immediate output:
                    let out = output(e.source, e.sourceHandle);
                    if (!out || !Array.isArray(out) || out.length === 0) return;

                    // Check the format of the output. Can be str or dict with 'text' and more attrs:
                    if (typeof out[0] === 'object') {
                        out.forEach(obj => store_data([obj], varname, pulled_data));
                    }
                    else {
                        // Save the list of strings from the pulled output under the var 'varname'
                        store_data(out, varname, pulled_data);
                    }
                    
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
    const str_to_py_template_format = toPyTemplateFormat; // (str) => str.replace(/(?<!\\){(.*?)(?<!\\)}/g, "${$1}")
    const to_py_template_format = (str_or_obj) => {
        if (typeof str_or_obj === 'object') {
            let new_obj = { text: str_to_py_template_format(str_or_obj.text), fill_history: {}};
            // Convert fill history vars to py template format
            if (str_or_obj.fill_history) {
                Object.keys(str_or_obj.fill_history).forEach(v => {
                    new_obj.fill_history[v] = str_to_py_template_format(str_or_obj.fill_history[v]);
                });
            }
            // Carry all other properties of the object over:
            Object.keys(str_or_obj).forEach(key => {
                if (key !== 'text' && key !== 'fill_history')
                    new_obj[key] = str_or_obj[key];
            });
            return new_obj;
        } else
            return str_to_py_template_format(str_or_obj);
    };
    const py_prompt_template = to_py_template_format(promptText);

    // Do the same for the vars, since vars can themselves be prompt templates:
    Object.keys(pulled_data).forEach(varname => {
        pulled_data[varname] = pulled_data[varname].map(val => to_py_template_format(val));
    });

    return [py_prompt_template, pulled_data];
  };

  // Ask the backend how many responses it needs to collect, given the input data:
  const fetchResponseCounts = (prompt, vars, llms, rejected) => {
    return fetch(BASE_URL + 'app/countQueriesRequired', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            prompt: prompt,
            vars: vars,
            llms: llms,
            id: id, 
            n: numGenerations,
    })}, rejected).then(function(response) {
        return response.json();
    }, rejected).then(function(json) {
        if (!json || !json.counts) {
            throw new Error('There was no response from the server.');
        }
        return [json.counts, json.total_num_responses];
    }, rejected);
  };

  // On hover over the 'Run' button, request how many responses are required and update the tooltip. Soft fails.
  const handleRunHover = () => {
    // Check if there's at least one model in the list; if not, nothing to run on.
    if (!llmItemsCurrState || llmItemsCurrState.length == 0) {
        setRunTooltip('No LLMs to query.');
        return;
    }

    // Check if the PromptNode is not already waiting for a response...
    if (status === 'loading') {
        setRunTooltip('Fetching responses...');
        return;
    }

    // Get input data and prompt
    const [py_prompt, pulled_vars] = pullInputData();
    const llms = llmItemsCurrState.map(item => item.model);
    const num_llms = llms.length;

    // Fetch response counts from backend
    fetchResponseCounts(py_prompt, pulled_vars, llmItemsCurrState, (err) => {
        console.warn(err.message);  // soft fail
    }).then(([counts, total_num_responses]) => {
        // Check for empty counts (means no requests will be sent!)
        const num_llms_missing = Object.keys(counts).length;
        if (num_llms_missing === 0) {
            setRunTooltip('Will load responses from cache');
            return;
        }

        // Tally how many queries per LLM:
        let queries_per_llm = {};
        Object.keys(counts).forEach(llm_key => {
            queries_per_llm[llm_key] = Object.keys(counts[llm_key]).reduce(
                (acc, prompt) => acc + counts[llm_key][prompt]
            , 0);
        });

        // Check if all counts are the same:
        if (num_llms_missing > 1) {
            const some_llm_num = queries_per_llm[Object.keys(queries_per_llm)[0]];
            const all_same_num_queries = Object.keys(queries_per_llm).reduce((acc, llm_key) => acc && queries_per_llm[llm_key] === some_llm_num, true)
            if (num_llms_missing === num_llms && all_same_num_queries) { // Counts are the same
                const req = some_llm_num > 1 ? 'requests' : 'request';
                setRunTooltip(`Will send ${some_llm_num} new ${req}` + (num_llms > 1 ? ' per LLM' : ''));
            }
            else if (all_same_num_queries) {
                const req = some_llm_num > 1 ? 'requests' : 'request';
                setRunTooltip(`Will send ${some_llm_num} new ${req}` + (num_llms > 1 ? ` to ${num_llms_missing} LLMs` : ''));
            }
            else { // Counts are different 
                const sum_queries = Object.keys(queries_per_llm).reduce((acc, llm_key) => acc + queries_per_llm[llm_key], 0);
                setRunTooltip(`Will send a variable # of queries to LLM(s) (total=${sum_queries})`);
            }
        } else {
            const llm_key = Object.keys(queries_per_llm)[0];
            const llm_name = getLLMListItemForKey(llm_key)?.name;
            const llm_count = queries_per_llm[llm_key];
            const req = llm_count > 1 ? 'queries' : 'query';
            if (num_llms > num_llms_missing)
                setRunTooltip(`Will send ${llm_count} ${req} to ${llm_name} and load others`);
            else
                setRunTooltip(`Will send ${llm_count} ${req} to ${llm_name}`);
        }
    }).catch(() => {
        setRunTooltip('Could not reach backend server.');
    });
  };

  const handleRunClick = (event) => {
    // Go through all template hooks (if any) and check they're connected:
    const is_fully_connected = templateVars.every(varname => {
        // Check that some edge has, as its target, this node and its template hook:
        return edges.some(e => (e.target == id && e.targetHandle == varname));
    });

    if (!is_fully_connected) {
        console.log('Not connected! :(', templateVars, edges);
        triggerAlert('Missing inputs to one or more template variables.');
        return;
    }

    console.log('Connected!');

    // Check that there is at least one LLM selected:
    if (llmItemsCurrState.length === 0) {
        alert('Please select at least one LLM to prompt.')
        return;
    }

    // Set status indicator
    setStatus('loading');
    setResponsePreviews([]);
    setProgressAnimated(true);

    const [py_prompt_template, pulled_data] = pullInputData();

    let FINISHED_QUERY = false;
    const rejected = (err) => {
        setStatus('error');
        triggerAlert(err.message);
        FINISHED_QUERY = true;
    };

    // Ask the backend to reset the scratchpad for counting queries:
    const create_progress_scratchpad = () => {
        return fetch(BASE_URL + 'app/createProgressFile', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                id: id,
        })}, rejected);
    };

    // Fetch info about the number of queries we'll need to make 
    const fetch_resp_count = () => fetchResponseCounts(
        py_prompt_template, pulled_data, llmItemsCurrState, rejected);

    // Open a socket to listen for progress
    const open_progress_listener_socket = ([response_counts, total_num_responses]) => {
        // With the counts information we can create progress bars. Now we load a socket connection to 
        // the socketio server that will stream to us the current progress:
        const socket = io('http://localhost:8001/' + 'queryllm', {
            transports: ["websocket"],
            cors: {origin: "http://localhost:8000/"},
        });
        
        const max_responses = Object.keys(total_num_responses).reduce((acc, llm) => acc + total_num_responses[llm], 0);

        // On connect to the server, ask it to give us the current progress 
        // for task 'queryllm' with id 'id', and stop when it reads progress >= 'max'. 
        socket.on("connect", (msg) => {
            // Initialize progress bars to small amounts
            setProgress({ success: 2, error: 0 });
            setLLMItems(llmItemsCurrState.map(item => {
                item.progress = { success: 0, error: 0 };
                return item;
            }));

            // Request progress bar updates
            socket.emit("queryllm", {'id': id, 'max': max_responses});
        });

        // Socket connection could not be established
        socket.on("connect_error", (error) => {
            console.log("Socket connection failed:", error.message);
            socket.disconnect();
        });

        // Socket disconnected
        socket.on("disconnect", (msg) => {
            console.log(msg);
        });
        
        // The current progress, a number specifying how many responses collected so far:
        socket.on("response", (counts) => {
            if (!counts || FINISHED_QUERY) return;

            // Update individual progress bars
            const num_llms = llmItemsCurrState.length;
            const num_resp_per_llm = (max_responses / num_llms);
            setLLMItems(llmItemsCurrState.map(item => {
                if (item.key in counts) {
                    item.progress = {
                        success: counts[item.key]['success'] / num_resp_per_llm * 100,
                        error: counts[item.key]['error'] / num_resp_per_llm * 100,
                    }
                }
                return item;
            }));
            
            // Update total progress bar
            const total_num_success = Object.keys(counts).reduce((acc, llm_key) => {
                return acc + counts[llm_key]['success'];
            }, 0);
            const total_num_error = Object.keys(counts).reduce((acc, llm_key) => {
                return acc + counts[llm_key]['error'];
            }, 0);
            setProgress({
                success: Math.max(5, total_num_success / max_responses * 100),
                error: total_num_error / max_responses * 100 }
            );
        });

        // The process has finished; close the connection:
        socket.on("finish", (msg) => {
            console.log("finished:", msg);
            socket.disconnect();
        });
    };

    // Run all prompt permutations through the LLM to generate + cache responses:
    const query_llms = () => {
        return fetch(BASE_URL + 'app/queryllm', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                id: id,
                llm: llmItemsCurrState,
                prompt: py_prompt_template,
                vars: pulled_data,
                n: numGenerations,
                api_keys: (apiKeys ? apiKeys : {}),
                no_cache: false,
            }),
        }, rejected).then(function(response) {
            return response.json();
        }, rejected).then(function(json) {
            if (!json) {
                setStatus('error');
                triggerAlert('Request was sent and received by backend server, but there was no response.');
            }
            else if (json.responses && json.errors) {
                FINISHED_QUERY = true;

                // If there was at least one error collecting a response...
                const llms_w_errors = Object.keys(json.errors);
                if (llms_w_errors.length > 0) {
                    // Remove the total progress bar
                    setProgress(undefined);

                    // Ensure there's a sliver of error displayed in the progress bar
                    // of every LLM item that has an error:
                    ensureLLMItemsErrorProgress(llms_w_errors);

                    // Set error status
                    setStatus('error');

                    // Trigger alert and display one error message per LLM of all collected errors:
                    let combined_err_msg = "";
                    llms_w_errors.forEach(llm_key => {
                        const item = getLLMListItemForKey(llm_key);                        
                        combined_err_msg += item.name + ': ' + json.errors[llm_key][0] + '\n';
                    });
                    // We trigger the alert directly (don't use triggerAlert) here because we want to keep the progress bar:
                    alertModal.current.trigger('Errors collecting responses. Re-run prompt node to retry.\n\n'+combined_err_msg);

                    return;
                }

                // All responses collected! Change status to 'ready':
                setStatus('ready');

                // Remove progress bars
                setProgress(undefined);
                setProgressAnimated(true);
                resetLLMItemsProgress();
                
                // Save prompt text so we remember what prompt we have responses cache'd for:
                setPromptTextOnLastRun(promptText);

                // Save response texts as 'fields' of data, for any prompt nodes pulling the outputs
                setDataPropsForNode(id, {fields: json.responses.map(
                    resp_obj => resp_obj['responses'].map(
                        r => ({text: r, fill_history: resp_obj['vars']}))).flat()
                });

                // Save preview strings of responses, for quick glance
                // Bucket responses by LLM:
                const responses_by_llm = bucketResponsesByLLM(json.responses);
                // const colors = ['#cbf078', '#f1b963', '#e46161', '#f8f398', '#defcf9', '#cadefc', '#c3bef0', '#cca8e9'];
                // const colors = ['green', 'yellow', 'orange', 'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'gray', 'cyan', 'lime'];
                setResponsePreviews(Object.keys(responses_by_llm).map((llm, llm_idx) => {
                    const resp_boxes = responses_by_llm[llm].map((res_obj, idx) => {
                        const num_resp = res_obj['responses'].length;
                        const resp_prevs = res_obj['responses'].map((r, i) => 
                            (<pre className="small-response" key={i}><i>{truncStr(r, 33)}</i><b>({i+1} of {num_resp})</b></pre>)
                        );
                        const vars = vars_to_str(res_obj.vars);
                        const var_tags = vars.map((v, i) => (
                            <Badge key={v} color="blue" size="xs">{v}</Badge>
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

                // Ping any inspect nodes attached to this node to refresh their contents:
                const output_nodes = outputEdgesForNode(id).map(e => e.target);
                output_nodes.forEach(n => {
                    const node = getNode(n);
                    if (node && node.type === 'inspect') {
                        setDataPropsForNode(node.id, { refresh: true });
                    }
                });

                // Store responses
                setJSONResponses(json.responses);

                // Log responses for debugging:
                console.log(json.responses);
            } else {
                setStatus('error');
                triggerAlert(json.error || 'Unknown error when querying LLM');
            }
        }, rejected);
    };

    // Now put it all together!
    create_progress_scratchpad()
        .then(fetch_resp_count)
        .then(open_progress_listener_socket)
        .then(query_llms)
        .catch(rejected);
  };

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
                handleRunHover={handleRunHover}
                runButtonTooltip={runTooltip}
                />
    <LLMResponseInspectorModal ref={inspectModal} jsonResponses={jsonResponses} prompt={promptText} />
      <div className="input-field">
        <textarea
          rows="4"
          cols="40"
          defaultValue={data.prompt}
          onChange={handleInputChange}
          className="nodrag nowheel"
        />
        <Handle
          type="source"
          position="right"
          id="prompt"
          style={{ top: '50%', background: '#555' }}
        />
      </div>
      <TemplateHooks vars={templateVars} nodeId={id} startY={138} />
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
                            {AvailableLLMs.map(item => (<Menu.Item key={item.model} onClick={() => addModel(item.base_model)} icon={item.emoji}>{item.name}</Menu.Item>))}
                        </Menu.Dropdown>
                    </Menu>
                </div>
            </div>
            
            <div className="nodrag">
                <LLMList llms={llmItems} onItemsChange={onLLMListItemsChange} />
            </div>
        </div>
        {progress !== undefined ? 
            (<Progress animate={progressAnimated} sections={[
                { value: progress.success, color: 'blue', tooltip: 'API call succeeded' },
                { value: progress.error, color: 'red', tooltip: 'Error collecting response' }
            ]} />)
        : <></>}
        <div className="response-preview-container nowheel" onClick={showResponseInspector}>
            {responsePreviews}
        </div>
      </div>
    </div>
  );
};

export default PromptNode;