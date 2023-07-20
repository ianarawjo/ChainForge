import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Handle } from 'react-flow-renderer';
import { Menu, Button, Progress, Textarea, Text, Popover, Center, Modal, Box, Tooltip, Switch } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { v4 as uuid } from 'uuid';
import { IconSearch, IconList } from '@tabler/icons-react';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import TemplateHooks, { extractBracketedSubstrings } from './TemplateHooksComponent'
import LLMList from './LLMListComponent'
import LLMResponseInspectorModal from './LLMResponseInspectorModal';
import { getDefaultModelSettings, AvailableLLMs } from './ModelSettingSchemas'
import fetch_from_backend from './fetch_from_backend';
import { PromptTemplate, escapeBraces } from './backend/template';
import ChatHistoryView from './ChatHistoryView';

// The LLM(s) to include by default on a PromptNode whenever one is created.
// Defaults to ChatGPT (GPT3.5).
const initLLMs = [AvailableLLMs[0]];

// Helper funcs
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
const getUniqueLLMMetavarKey = (responses) => {
    const metakeys = new Set(responses.map(resp_obj => Object.keys(resp_obj.metavars)).flat());
    let i = 0;
    while (metakeys.has(`LLM_${i}`))
        i += 1;
    return `LLM_${i}`;
};


class PromptInfo {
    prompt; // string

    constructor(prompt) {
        this.prompt = prompt;
    }
}

const displayPromptInfos = (promptInfos) => 
    promptInfos.map((info, idx) => (
        <div key={idx}>
            <pre className='prompt-preview'>{info.prompt}</pre>
        </div>
    ));

const PromptListPopover = ({ promptInfos, onHover, onClick }) => {
    const [opened, { close, open }] = useDisclosure(false);

    const _onHover = useCallback(() => {
        onHover();
        open();
    }, [onHover, open]);

    return (
        <Popover position="right-start" withArrow withinPortal shadow="rgb(38, 57, 77) 0px 10px 30px -14px" key="query-info" opened={opened} styles={{dropdown: {maxHeight: '500px', maxWidth: '400px', overflowY: 'auto', backgroundColor: '#fff'}}}>
            <Popover.Target>
                <Tooltip label='Click to view all prompts' withArrow>
                    <button className='custom-button' onMouseEnter={_onHover} onMouseLeave={close} onClick={onClick} style={{border:'none'}}>
                        <IconList size='12pt' color='gray' style={{marginBottom: '-4px'}} />
                    </button>
                </Tooltip>
            </Popover.Target>
            <Popover.Dropdown sx={{ pointerEvents: 'none' }}>
                <Center><Text size='xs' fw={500} color='#666'>Preview of generated prompts ({promptInfos.length} total)</Text></Center>
                {displayPromptInfos(promptInfos)}
            </Popover.Dropdown>
        </Popover>
    );
};


const PromptNode = ({ data, id, type: node_type }) => {
  const node_icon = useMemo(() => (node_type === 'chat' ? '🗣' : '💬'), [node_type]);
  const node_default_title = useMemo(() => (node_type === 'chat' ? 'Chat Turn' : 'Prompt Node'), [node_type]);

  // Get state from the Zustand store:
  const edges = useStore((state) => state.edges);
  const output = useStore((state) => state.output);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const getNode = useStore((state) => state.getNode);

  // API Keys (set by user in popup GlobalSettingsModal)
  const apiKeys = useStore((state) => state.apiKeys);

  const [jsonResponses, setJSONResponses] = useState(null);
  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const [promptText, setPromptText] = useState(data.prompt || "");
  const [promptTextOnLastRun, setPromptTextOnLastRun] = useState(null);
  const [status, setStatus] = useState('none');
  const [numGenerations, setNumGenerations] = useState(data.n || 1);
  const [numGenerationsLastRun, setNumGenerationsLastRun] = useState(data.n || 1);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef(null);

  // Chat node specific
  const [contChatWithPriorLLMs, setContChatWithPriorLLMs] = useState(true);

  // For an info pop-up that shows all the prompts that will be sent off
  // NOTE: This is the 'full' version of the PromptListPopover that activates on hover.
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] = useDisclosure(false);

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

  // Signal that prompt node state is dirty; user should re-run:
  const signalDirty = useCallback(() => {
    if (promptTextOnLastRun !== null && status === 'ready')
        setStatus('warning');
  }, [promptTextOnLastRun, status])

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
    signalDirty();    
  }, [llmItemsCurrState, signalDirty]);

  const onLLMListItemsChange = useCallback((new_items) => {
    setLLMItemsCurrState(new_items);
    setDataPropsForNode(id, { llms: new_items });
    
    // If there's been any change to the item list, signal dirty: 
    if (new_items.length !== llmItemsCurrState.length || !new_items.every(i => llmItemsCurrState.some(s => s.key === i.key))) {
        signalDirty();
    } else if (!new_items.every(itemA => {
        const itemB = llmItemsCurrState.find(b => b.key === itemA.key);
        return JSON.stringify(itemA.settings) === JSON.stringify(itemB.settings);
    })) {
        signalDirty();
    }
  }, [setLLMItemsCurrState, signalDirty]);

  const refreshTemplateHooks = (text) => {
    // Update template var fields + handles
    const found_template_vars = Array.from(
        new Set(extractBracketedSubstrings(text)));  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}
    setTemplateVars(found_template_vars);
  };

  const handleInputChange = (event) => {
    const value = event.target.value;

    // Store prompt text
    setPromptText(value);
    data['prompt'] = value;

    // Update status icon, if need be:
    if (promptTextOnLastRun !== null && status !== 'warning' && value !== promptTextOnLastRun) {
        setStatus('warning');
    }

    refreshTemplateHooks(value);
  };

  // On initialization
  useEffect(() => {
    refreshTemplateHooks(promptText);

    // Attempt to grab cache'd responses
    fetch_from_backend('grabResponses', {
        responses: [id],
    }).then(function(json) {
        if (json.responses && json.responses.length > 0) {
            // Store responses and set status to green checkmark
            setJSONResponses(json.responses);
            setStatus('ready');
        }
    });
  }, []);

  // On upstream changes
  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus('warning');
    }
  }, [data]);

  // Pull all inputs needed to request responses.
  // Returns [prompt, vars dict]
  const pullInputData = (_targetHandles) => {
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
    get_outputs(_targetHandles, id);

    return pulled_data;
  };

  // Chat nodes only. Pulls input data attached to the 'past conversations' handle.
  // Returns a tuple (past_chat_llms, __past_chats), where both are undefined if nothing is connected.
  const pullInputChats = () => {
    const pulled_data = pullInputData(['__past_chats']);
    if (!('__past_chats' in pulled_data)) return [undefined, undefined];

    // For storing the unique LLMs in past_chats:
    let llm_names = new Set();
    let past_chat_llms = [];

    // Now we could've pulled from a Prompt Node, in which 
    // case there won't be 'chat_history'. HOWEVER, the 'chat history' 
    // is implicit in the TemplateVarInfo object: 'text' is the response, and 
    // 'prompt' was the string of the prompt that generate the response. 
    // We need to convert that to OpenAI chat message format:
    const past_chats = pulled_data['__past_chats'].map(info => {
        // Add to unique LLMs list, if necessary
        const llm_name = obj?.llm?.name;
        if (llm_name !== undefined && !llm_names.has(llm_name)) {
            llm_names.add(llm_name);
            past_chat_llms.push(obj.llm);
        }
        // Create revised chat_history on the TemplateVarInfo object,
        // with the prompt and text of the pulled data as the 2nd-to-last, and last, messages:
        const last_messages = [
            { role: 'user', content: info.prompt },
            { role: 'assistant', content: info.text }
        ];
        const updated_chat_hist = info.chat_history !== undefined ? info.chat_history.concat(last_messages) : last_messages;
        return {...info, chat_history: updated_chat_hist};
    });

    return [past_chat_llms, past_chats];
  };

  // Ask the backend how many responses it needs to collect, given the input data:
  const fetchResponseCounts = (prompt, vars, llms, rejected) => {
    return fetch_from_backend('countQueriesRequired', {
        prompt: prompt,
        vars: vars,
        llms: llms,
        id: id, 
        n: numGenerations,
    }, rejected).then(function(json) {
        if (!json || !json.counts) {
            throw new Error('There was no response from the server.');
        }
        return [json.counts, json.total_num_responses];
    }, rejected);
  };

  // On hover over the 'info' button, to preview the prompts that will be sent out
  const [promptPreviews, setPromptPreviews] = useState([]);
  const handlePreviewHover = () => {
    // Pull input data and prompt
    const pulled_vars = pullInputData(templateVars);
    fetch_from_backend('generatePrompts', {
        prompt: promptText,
        vars: pulled_vars,
    }).then(prompts => {
        setPromptPreviews(prompts.map(p => (new PromptInfo(p))));
    });

    pullInputChats();
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
    const pulled_vars = pullInputData(templateVars);
    const llms = llmItemsCurrState.map(item => item.model);
    const num_llms = llms.length;

    // Fetch response counts from backend
    fetchResponseCounts(promptText, pulled_vars, llmItemsCurrState, (err) => {
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

    // If this is a chat node, we need to pull chat histories: 
    const [past_chat_llms, pulled_chats] = node_type === 'chat' ? pullInputChats() : [undefined, undefined];

    // If this is a chat node and 'continuing chat with prior LLMs' is checked,
    // there's no customizable model list (llmItemsCurrState). Instead, we need to get the unique
    // LLMs present by finding the set of 'llm' key with unique 'name' properties
    // in the input variables (if any). If there's keys present w/o LLMs (for instance a text node),
    // we need to pop-up an error message.
    if (node_type === 'chat' && contChatWithPriorLLMs) {
        // Override LLM list with the past llm info (unique LLMs in prior responses)
        llmItemsCurrState = past_chat_llms;
        setLLMItemsCurrState(past_chat_llms);
    }

    // Check that there is at least one LLM selected:
    if (llmItemsCurrState.length === 0) {
        alert('Please select at least one LLM to prompt.')
        return;
    }

    // Set status indicator
    setStatus('loading');
    setJSONResponses([]);
    setProgressAnimated(true);

    // Pull the data to fill in template input variables, if any
    const pulled_data = pullInputData(templateVars);
    const prompt_template = promptText;

    const rejected = (err) => {
        setStatus('error');
        triggerAlert(err.message);
    };

    // Ask the backend to reset the scratchpad for counting queries:
    const create_progress_scratchpad = () => {
        return fetch_from_backend('createProgressFile', {id: id}, rejected);
    };

    // Fetch info about the number of queries we'll need to make 
    const fetch_resp_count = () => fetchResponseCounts(
        prompt_template, pulled_data, llmItemsCurrState, rejected);
    
    // Initialize progress bars to small amounts
    setProgress({ success: 2, error: 0 });
    setLLMItems(llmItemsCurrState.map(item => {
        item.progress = { success: 0, error: 0 };
        return item;
    }));

    // Create a callback to listen for progress
    let onProgressChange = () => {};
    const open_progress_listener = ([response_counts, total_num_responses]) => {
        const max_responses = Object.keys(total_num_responses).reduce((acc, llm) => acc + total_num_responses[llm], 0);

        onProgressChange = (progress_by_llm_key) => {
            if (!progress_by_llm_key) return;
        
            // Update individual progress bars
            const num_llms = llmItemsCurrState.length;
            const num_resp_per_llm = (max_responses / num_llms);
            setLLMItems(llmItemsCurrState.map(item => {
                if (item.key in progress_by_llm_key) {
                    item.progress = {
                        success: progress_by_llm_key[item.key]['success'] / num_resp_per_llm * 100,
                        error: progress_by_llm_key[item.key]['error'] / num_resp_per_llm * 100,
                    }
                }
                return item;
            }));
            
            // Update total progress bar
            const total_num_success = Object.keys(progress_by_llm_key).reduce((acc, llm_key) => {
                return acc + progress_by_llm_key[llm_key]['success'];
            }, 0);
            const total_num_error = Object.keys(progress_by_llm_key).reduce((acc, llm_key) => {
                return acc + progress_by_llm_key[llm_key]['error'];
            }, 0);
            setProgress({
                success: Math.max(5, total_num_success / max_responses * 100),
                error: total_num_error / max_responses * 100 }
            );
        };
    };

    // Run all prompt permutations through the LLM to generate + cache responses:
    const query_llms = () => {
        return fetch_from_backend('queryllm', {
            id: id,
            llm: llmItemsCurrState,  // deep clone it first
            prompt: prompt_template,
            vars: pulled_data,
            chat_histories: pulled_chats,
            n: numGenerations,
            api_keys: (apiKeys ? apiKeys : {}),
            no_cache: false,
            progress_listener: onProgressChange,
        }, rejected).then(function(json) {
            if (!json) {
                setStatus('error');
                triggerAlert('Request was sent and received by backend server, but there was no response.');
            }
            else if (json.responses && json.errors) {

                // Store and log responses (if any)
                if (json.responses) {
                    setJSONResponses(json.responses);

                    // Log responses for debugging:
                    console.log(json.responses);
                }

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
                        combined_err_msg += item.name + ': ' + JSON.stringify(json.errors[llm_key][0]) + '\n';
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
                setNumGenerationsLastRun(numGenerations);

                // Save response texts as 'fields' of data, for any prompt nodes pulling the outputs
                // We also need to store a unique metavar for the LLM *set* (set of LLM nicknames) that produced these responses,
                // so we can keep track of 'upstream' LLMs (and plot against them) later on:
                const llm_metavar_key = getUniqueLLMMetavarKey(json.responses);
                setDataPropsForNode(id, {fields: json.responses.map(
                    resp_obj => resp_obj['responses'].map(
                        r => {
                            // Carry over the response text, prompt, prompt fill history (vars), and llm nickname:
                            let o = { text: escapeBraces(r), 
                                      prompt: resp_obj['prompt'],
                                      fill_history: resp_obj['vars'],
                                      llm: llmItemsCurrState.find((item) => item.name === resp_obj.llm) };

                            // Carry over any metavars
                            o.metavars = resp_obj['metavars'] || {};

                            // Carry over any chat history
                            if (resp_obj['chat_history']) 
                                o.chat_history = resp_obj['chat_history'];

                            // Add a meta var to keep track of which LLM produced this response
                            o.metavars[llm_metavar_key] = resp_obj['llm'];
                            return o;
                        }
                    )).flat()
                });

                // Ping any inspect nodes attached to this node to refresh their contents:
                pingOutputNodes(id);
            } else {
                setStatus('error');
                triggerAlert(json.error || 'Unknown error when querying LLM');
            }
        }, rejected);
    };

    // Now put it all together!
    create_progress_scratchpad()
        .then(fetch_resp_count)
        .then(open_progress_listener)
        .then(query_llms)
        .catch(rejected);
  };

  const handleNumGenChange = useCallback((event) => {
    let n = event.target.value;
    if (!isNaN(n) && n.length > 0 && /^\d+$/.test(n)) {
        // n is an integer; save it
        n = parseInt(n);
        if (n !== numGenerationsLastRun && status === 'ready')
            setStatus('warning');
        setNumGenerations(n);
        setDataPropsForNode(id, {n: n});
    }
  }, [numGenerationsLastRun, setDataPropsForNode, status]);

  const hideStatusIndicator = () => {
    if (status !== 'none') { setStatus('none'); }
  };

  // Dynamically update the textareas and position of the template hooks
  const textAreaRef = useRef(null);
  const [hooksY, setHooksY] = useState(138);
  const setRef = useCallback((elem) => {
    // To listen for resize events of the textarea, we need to use a ResizeObserver.
    // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div wrapping textfields.
    // NOTE: This won't work on older browsers, but there's no alternative solution.
    if (!textAreaRef.current && elem && window.ResizeObserver) {
      let past_hooks_y = 138;
      const incr = 68 + (node_type === 'chat' ? -6 : 0);
      const observer = new ResizeObserver(() => {
        if (!textAreaRef || !textAreaRef.current) return;
        const new_hooks_y = textAreaRef.current.clientHeight + incr;
        if (past_hooks_y !== new_hooks_y) {
          setHooksY(new_hooks_y);
          past_hooks_y = new_hooks_y;
        }
      });

      observer.observe(elem);
      textAreaRef.current = elem;
    }
  }, [textAreaRef]);

  return (
    <div className="prompt-node cfnode">
    <NodeLabel title={data.title || node_default_title} 
                nodeId={id} 
                onEdit={hideStatusIndicator}
                icon={node_icon} 
                status={status}
                alertModal={alertModal}
                handleRunClick={handleRunClick}
                handleRunHover={handleRunHover}
                runButtonTooltip={runTooltip}
                customButtons={[
                    <PromptListPopover promptInfos={promptPreviews} onHover={handlePreviewHover} onClick={openInfoModal} />
                ]} />
    <LLMResponseInspectorModal ref={inspectModal} jsonResponses={jsonResponses} prompt={promptText} />
    <Modal title={'List of prompts that will be sent to LLMs (' + promptPreviews.length + ' total)'} size='xl' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-80px'}}}>
        <Box size={600} m='lg' mt='xl'>
            {displayPromptInfos(promptPreviews)}
        </Box>
    </Modal>

    { node_type === 'chat' ? (<div ref={setRef}>
        <ChatHistoryView bgColors={['#ccc', '#ceeaf5b1']} messages={[
            "(Past conversation)",
            <Textarea 
                className="prompt-field-fixed nodrag nowheel" 
                minRows="4"
                defaultValue={data.prompt}  
                onChange={handleInputChange}
                miw={230}
                styles={{input: {background: 'transparent', borderWidth: '0px'}}} />
        ]} />
        <Handle
            type="target"
            position="left"
            id="__past_chats"
            style={{ top: '82px', background: '#555' }}
        />
      </div>) : (
        <Textarea ref={setRef}
                autosize
                className="prompt-field-fixed nodrag nowheel" 
                minRows="4"
                maxRows="12"
                defaultValue={data.prompt}  
                onChange={handleInputChange} />)
    }
    
    <Handle
        type="source"
        position="right"
        id="prompt"
        className="grouped-handle"
        style={{ top: '50%' }}
    />
    <TemplateHooks vars={templateVars} nodeId={id} startY={hooksY} ignoreHandles={['__past_chats']} />
    <hr />
    <div>
        <div style={{marginBottom: '10px', padding: '4px'}}>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Num responses per prompt:&nbsp;</label>
            <input id="num-generations" name="num-generations" type="number" min={1} max={50} defaultValue={data.n || 1} onChange={handleNumGenChange} className="nodrag"></input>
        </div>

        {node_type === 'chat' ? (
            <div>
                <Switch
                    label={contChatWithPriorLLMs ? "Continue chat with prior LLM(s)" : "Continue chat with new LLMs:"}
                    defaultChecked={true}
                    checked={contChatWithPriorLLMs} 
                    onChange={(event) => setContChatWithPriorLLMs(event.currentTarget.checked)}
                    color='cyan'
                    size='xs'
                    mb={contChatWithPriorLLMs ? '0px' : '10px'}
                />
            </div>
        ) : <></>} 
        
        {node_type !== 'chat' || !contChatWithPriorLLMs ? (
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
        </div>) : <></>}
        {progress !== undefined ? 
            (<Progress animate={progressAnimated} sections={[
                { value: progress.success, color: 'blue', tooltip: 'API call succeeded' },
                { value: progress.error, color: 'red', tooltip: 'Error collecting response' }
            ]} />)
        : <></>}

        { jsonResponses && jsonResponses.length > 0 && status !== 'loading' ? 
            (<div className="eval-inspect-response-footer nodrag" onClick={showResponseInspector} style={{display: 'flex', justifyContent:'center'}}>
                <Button color='blue' variant='subtle' w='100%' >Inspect responses&nbsp;<IconSearch size='12pt'/></Button>
            </div>) : <></>
        }
        </div>
    </div>
   );
};

export default PromptNode;