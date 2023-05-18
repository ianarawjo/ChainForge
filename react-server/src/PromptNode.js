import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import { Menu, Badge, Progress } from '@mantine/core';
import { v4 as uuid } from 'uuid';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import TemplateHooks from './TemplateHooksComponent'
import LLMList from './LLMListComponent'
import {BASE_URL} from './store';
import io from 'socket.io-client';

// Available LLMs
const allLLMs = [
    { name: "GPT3.5", emoji: "🙂", model: "gpt-3.5-turbo", temp: 1.0 },
    { name: "GPT4", emoji: "🥵", model: "gpt-4", temp: 1.0 },
    { name: "Alpaca 7B", emoji: "🦙", model: "alpaca.7B", temp: 0.5 },
    { name: "Claude v1", emoji: "📚", model: "claude-v1", temp: 0.5 },
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
  const outputEdgesForNode = useStore((state) => state.outputEdgesForNode);
  const getNode = useStore((state) => state.getNode);

  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const [promptText, setPromptText] = useState(data.prompt || "");
  const [promptTextOnLastRun, setPromptTextOnLastRun] = useState(null);
  const [status, setStatus] = useState('none');
  const [responsePreviews, setResponsePreviews] = useState([]);
  const [numGenerations, setNumGenerations] = useState(data.n || 1);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // Selecting LLM models to prompt
  const [llmItems, setLLMItems] = useState(data.llms || initLLMs.map((i) => ({key: uuid(), ...i})));
  const [llmItemsCurrState, setLLMItemsCurrState] = useState([]);
  const resetLLMItemsProgress = useCallback(() => {
    setLLMItems(llmItemsCurrState.map(item => {
        item.progress = undefined;
        return item;
    }));
  }, [llmItemsCurrState]);

  // Progress when querying responses
  const [progress, setProgress] = useState(100);
  const [runTooltip, setRunTooltip] = useState(null);

  const triggerAlert = (msg) => {
    setProgress(100);
    resetLLMItemsProgress();
    alertModal.current.trigger(msg);
  };

  const addModel = useCallback((model) => {
    // Get the item for that model
    let item = allLLMs.find(llm => llm.model === model);

    if (!item) {  // This should never trigger, but in case it does:
        triggerAlert(`Could not find model named '${model}' in list of available LLMs.`);
        return;
    }

    // Give it a uid as a unique key (this is needed for the draggable list to support multiple same-model items; keys must be unique)
    item = {key: uuid(), ...item};

    // Add model to LLM list (regardless of it's present already or not). 
    setLLMItems(llmItemsCurrState.concat([item]))
  }, [llmItemsCurrState]);

  const onLLMListItemsChange = useCallback((new_items) => {
    setLLMItemsCurrState(new_items);
    setDataPropsForNode(id, { llms: new_items });
  }, [setLLMItemsCurrState]);

  const refreshTemplateHooks = (text) => {
    // Update template var fields + handles
    const braces_regex = /(?<!\\){(.*?)(?<!\\)}/g;  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}
    const found_template_vars = text.match(braces_regex);
    if (found_template_vars && found_template_vars.length > 0) {
        const temp_var_names = found_template_vars.map(
            name => name.substring(1, name.length-1)  // remove brackets {}
        )
        setTemplateVars(temp_var_names);
    } else {
        setTemplateVars([]);
    }
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

                    // Check the format of the output. Can be str or dict with 'text' and 'vars' attrs:
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
    const str_to_py_template_format = (str) => str.replace(/(?<!\\){(.*?)(?<!\\)}/g, "${$1}")
    const to_py_template_format = (str_or_obj) => {
        if (typeof str_or_obj === 'object') {
            let new_vars = {};
            Object.keys(str_or_obj.fill_history).forEach(v => {
                new_vars[v] = str_to_py_template_format(str_or_obj.fill_history[v]);
            });
            return {text: str_to_py_template_format(str_or_obj.text), fill_history: new_vars};
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
            throw new Error('Request was sent and received by backend server, but there was no response.');
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
    fetchResponseCounts(py_prompt, pulled_vars, llms, (err) => {
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
        Object.keys(counts).forEach(llm => {
            queries_per_llm[llm] = Object.keys(counts[llm]).reduce(
                (acc, prompt) => acc + counts[llm][prompt]
            , 0);
        });

        // Check if all counts are the same:
        if (num_llms_missing > 1) {
            const some_llm_num = queries_per_llm[Object.keys(queries_per_llm)[0]];
            const all_same_num_queries = Object.keys(queries_per_llm).reduce((acc, llm) => acc && queries_per_llm[llm] === some_llm_num, true)
            if (num_llms_missing === num_llms && all_same_num_queries) { // Counts are the same
                const req = some_llm_num > 1 ? 'requests' : 'request';
                setRunTooltip(`Will send ${some_llm_num} new ${req}` + (num_llms > 1 ? ' per LLM' : ''));
            }
            else if (all_same_num_queries) {
                const req = some_llm_num > 1 ? 'requests' : 'request';
                setRunTooltip(`Will send ${some_llm_num} new ${req}` + (num_llms > 1 ? ` to ${num_llms_missing} LLMs` : ''));
            }
            else { // Counts are different 
                const sum_queries = Object.keys(queries_per_llm).reduce((acc, llm) => acc + queries_per_llm[llm], 0);
                setRunTooltip(`Will send a variable # of queries to LLM(s) (total=${sum_queries})`);
            }
        } else {
            const llm_name = Object.keys(queries_per_llm)[0];
            const llm_count = queries_per_llm[llm_name];
            const req = llm_count > 1 ? 'queries' : 'query';
            if (num_llms > num_llms_missing)
                setRunTooltip(`Will send ${llm_count} ${req} to ${llm_name} and load others`);
            else
                setRunTooltip(`Will send ${llm_count} ${req} to ${llm_name}`)
        }
        
    });
  };

  const handleRunClick = (event) => {
    // Go through all template hooks (if any) and check they're connected:
    const is_fully_connected = templateVars.every(varname => {
        // Check that some edge has, as its target, this node and its template hook:
        return edges.some(e => (e.target == id && e.targetHandle == varname));
    });

    if (!is_fully_connected) {
        console.log('Not connected! :(');
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
        py_prompt_template, pulled_data, llmItemsCurrState.map(item => item.model), rejected);

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
            setProgress(5);
            setLLMItems(llmItemsCurrState.map(item => {
                item.progress = 0;
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
            // console.log(counts);
            if (!counts || FINISHED_QUERY) return;

            // Update individual progress bars
            const num_llms = llmItemsCurrState.length;
            setLLMItems(llmItemsCurrState.map(item => {
                if (item.model in counts)
                    item.progress = counts[item.model] / (max_responses / num_llms) * 100;
                return item;
            }));
            
            // Update total progress bar
            const total_num_resps = Object.keys(counts).reduce((acc, llm_name) => {
                return acc + counts[llm_name];
            }, 0);
            setProgress(Math.max(5, total_num_resps / max_responses * 100));
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

                // Remove progress bars
                setProgress(100);
                resetLLMItemsProgress();
                FINISHED_QUERY = true;

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

                // Log responses for debugging:
                console.log(json.responses);
            } else {
                setStatus('error');
                alertModal.current.trigger(json.error || 'Unknown error when querying LLM');
            }
        }, rejected);
    };

    // Now put it all together!
    create_progress_scratchpad()
        .then(fetch_resp_count)
        .then(open_progress_listener_socket)
        .then(query_llms)
        .catch(rejected);
    
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
                handleRunHover={handleRunHover}
                runButtonTooltip={runTooltip}
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
        {progress < 100 ? (<Progress value={progress} animate />) : <></>}
        <div className="response-preview-container nowheel">
            {responsePreviews}
        </div>
      </div>
    </div>
  );
};

export default PromptNode;