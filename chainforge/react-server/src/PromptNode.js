import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Handle } from 'reactflow';
import { Switch, Progress, Textarea, Text, Popover, Center, Modal, Box, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconList } from '@tabler/icons-react';
import useStore from './store';
import BaseNode from './BaseNode';
import NodeLabel from './NodeLabelComponent';
import TemplateHooks, { extractBracketedSubstrings } from './TemplateHooksComponent'
import { LLMListContainer } from './LLMListComponent'
import LLMResponseInspectorModal from './LLMResponseInspectorModal';
import fetch_from_backend from './fetch_from_backend';
import { escapeBraces } from './backend/template';
import ChatHistoryView from './ChatHistoryView';
import InspectFooter from './InspectFooter';
import { countNumLLMs, setsAreEqual, getLLMsInPulledInputData } from './backend/utils';
import LLMResponseInspectorDrawer from './LLMResponseInspectorDrawer';
import { DuplicateVariableNameError } from './backend/errors';

const getUniqueLLMMetavarKey = (responses) => {
    const metakeys = new Set(responses.map(resp_obj => Object.keys(resp_obj.metavars)).flat());
    let i = 0;
    while (metakeys.has(`LLM_${i}`))
        i += 1;
    return `LLM_${i}`;
};
const bucketChatHistoryInfosByLLM = (chat_hist_infos) => {
    let chats_by_llm = {};
    chat_hist_infos.forEach(chat_hist_info => {
        if (chat_hist_info.llm in chats_by_llm) 
            chats_by_llm[chat_hist_info.llm].push(chat_hist_info);
        else
            chats_by_llm[chat_hist_info.llm] = [ chat_hist_info ];
    });
    return chats_by_llm;
}

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
  const pullInputData = useStore((state) => state.pullInputData);
  const getImmediateInputNodeTypes = useStore((state) => state.getImmediateInputNodeTypes);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);

  // API Keys (set by user in popup GlobalSettingsModal)
  const apiKeys = useStore((state) => state.apiKeys);

  const [jsonResponses, setJSONResponses] = useState(null);
  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const [promptText, setPromptText] = useState(data.prompt || "");
  const [promptTextOnLastRun, setPromptTextOnLastRun] = useState(null);
  const [status, setStatus] = useState('none');
  const [numGenerations, setNumGenerations] = useState(data.n || 1);
  const [numGenerationsLastRun, setNumGenerationsLastRun] = useState(data.n || 1);

  // The LLM items container
  const llmListContainer = useRef(null);
  const [llmItemsCurrState, setLLMItemsCurrState] = useState([]);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef(null);
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [responsesWillChange, setResponsesWillChange] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // For continuing with prior LLMs toggle
  const [contWithPriorLLMs, setContWithPriorLLMs] = useState(data.contChat !== undefined ? data.contChat : (node_type === 'chat' ? true : false));
  const [showContToggle, setShowContToggle] = useState(node_type === 'chat');
  const [contToggleDisabled, setContChatToggleDisabled] = useState(false);

  // For an info pop-up that shows all the prompts that will be sent off
  // NOTE: This is the 'full' version of the PromptListPopover that activates on hover.
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] = useDisclosure(false);

  // Progress when querying responses
  const [progress, setProgress] = useState(undefined);
  const [progressAnimated, setProgressAnimated] = useState(true);
  const [runTooltip, setRunTooltip] = useState(null);

  const triggerAlert = useCallback((msg) => {
    setProgress(undefined);
    llmListContainer?.current?.resetLLMItemsProgress();
    alertModal?.current?.trigger(msg);
  }, [llmListContainer, alertModal]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && jsonResponses) {
        inspectModal.current?.trigger();
        setUninspectedResponses(false);
    }
  }, [inspectModal, jsonResponses]);

  // Signal that prompt node state is dirty; user should re-run:
  const signalDirty = useCallback(() => {
    if (promptTextOnLastRun !== null && status === 'ready')
        setStatus('warning');
  }, [promptTextOnLastRun, status])

  const addModel = useCallback((new_model, all_items) => {
    setLLMItemsCurrState(all_items);
    setDataPropsForNode(id, { llms: all_items });
    signalDirty(); 
  }, [signalDirty]);

  const onLLMListItemsChange = useCallback((new_items, old_items) => {
    setLLMItemsCurrState(new_items);
    setDataPropsForNode(id, { llms: new_items });
    
    // If there's been any change to the item list, signal dirty: 
    if (new_items.length !== old_items.length || !new_items.every(i => old_items.some(s => s.key === i.key))) {
        signalDirty();
    } else if (!new_items.every(itemA => {
        const itemB = old_items.find(b => b.key === itemA.key);
        return JSON.stringify(itemA.settings) === JSON.stringify(itemB.settings);
    })) {
        signalDirty();
    }
  }, [setDataPropsForNode, signalDirty]);

  const updateShowContToggle = useCallback((pulled_data) => {
    if (node_type === 'chat') return; // always show when chat node
    const hasPromptInput = getImmediateInputNodeTypes(templateVars, id).some(t => ['prompt', 'chat'].includes(t));
    setShowContToggle(hasPromptInput || (pulled_data && countNumLLMs(pulled_data) > 0));
  }, [setShowContToggle, countNumLLMs, getImmediateInputNodeTypes, templateVars, id]);

  const handleOnConnect = useCallback(() => {
    if (node_type === 'chat') return; // always show when chat node
    // Re-pull data and update show cont toggle:
    try {
        const pulled_data = pullInputData(templateVars, id);
        updateShowContToggle(pulled_data);
    } catch (err) {
        // alertModal.current?.trigger(err.message);
        console.error(err);
    }
  }, [templateVars, id, pullInputData, updateShowContToggle]);

  const refreshTemplateHooks = useCallback((text) => {
    // Update template var fields + handles
    const found_template_vars = new Set(extractBracketedSubstrings(text));  // gets all strs within braces {} that aren't escaped; e.g., ignores \{this\} but captures {this}

    if (!setsAreEqual(found_template_vars, new Set(templateVars))) {
        if (node_type !== 'chat') {
            try {
                updateShowContToggle(pullInputData(found_template_vars, id));
            } catch (err) {
                console.error(err);
            }
        }
        setTemplateVars(Array.from(found_template_vars));
    }
  }, [setTemplateVars, templateVars, pullInputData, id]);

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
    if (data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus('warning');
      handleOnConnect();
    } else if (data.refreshLLMList === true) {
      llmListContainer?.current?.refreshLLMProviderList();
      setDataPropsForNode(id, { refreshLLMList: false });
    }
  }, [data]);

  // Chat nodes only. Pulls input data attached to the 'past conversations' handle.
  // Returns a tuple (past_chat_llms, __past_chats), where both are undefined if nothing is connected.
  const pullInputChats = () => {
    const pulled_data = pullInputData(['__past_chats'], id);
    if (!('__past_chats' in pulled_data)) return [undefined, undefined];

    // For storing the unique LLMs in past_chats:
    let llm_names = new Set();
    let past_chat_llms = [];

    // We need to calculate the conversation history from the pulled responses.
    // Note that TemplateVarInfo might have a 'chat_history' component, but this does not 
    // include the most recent prompt and response --for that, we need to use the 'prompt' and 'text' items.
    // We need to create a revised chat history that concatenates the past history with the last AI + human turns:
    const past_chats = pulled_data['__past_chats'].map(info => {
        // Add to unique LLMs list, if necessary
        const llm_name = info?.llm?.name;
        if (llm_name !== undefined && !llm_names.has(llm_name)) {
            llm_names.add(llm_name);
            past_chat_llms.push(info.llm);
        }
        
        // Create revised chat_history on the TemplateVarInfo object,
        // with the prompt and text of the pulled data as the 2nd-to-last, and last, messages:
        let last_messages = [
            { role: 'user', content: info.prompt },
            { role: 'assistant', content: info.text }
        ];
        let updated_chat_hist = info.chat_history !== undefined ? info.chat_history.concat(last_messages) : last_messages;

        // Append any present system message retroactively as the first message in the chat history:
        if (info?.llm?.settings?.system_msg !== undefined && updated_chat_hist[0].role !== 'system')
            updated_chat_hist = [{ role: 'system', content: info.llm.settings.system_msg }].concat(updated_chat_hist);

        // ChatHistoryInfo format (see typing.ts)
        return {messages: updated_chat_hist, fill_history: info.fill_history, metavars: info.metavars, llm: llm_name};
    });

    // Returns [list of LLM specs, list of ChatHistoryInfo]
    return [past_chat_llms, past_chats];
  };

  // Ask the backend how many responses it needs to collect, given the input data:
  const fetchResponseCounts = (prompt, vars, llms, chat_histories, rejected) => {
    return fetch_from_backend('countQueriesRequired', {
        prompt: prompt,
        vars: vars,
        llms: llms,
        id: id, 
        chat_histories: chat_histories,
        n: numGenerations,
        cont_only_w_prior_llms: node_type !== 'chat' ? (showContToggle && contWithPriorLLMs) : undefined,
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
    try {
        const pulled_vars = pullInputData(templateVars, id);
        updateShowContToggle(pulled_vars);

        fetch_from_backend('generatePrompts', {
            prompt: promptText,
            vars: pulled_vars,
        }).then(prompts => {
            setPromptPreviews(prompts.map(p => (new PromptInfo(p.toString()))));
        });

        pullInputChats();
    } catch (err) {
        // soft fail
        console.error(err);
        setPromptPreviews([]);
    }
  };

  // On hover over the 'Run' button, request how many responses are required and update the tooltip. Soft fails.
  const handleRunHover = () => {
    // Check if the PromptNode is not already waiting for a response...
    if (status === 'loading') {
        setRunTooltip('Fetching responses...');
        return;
    }

    let _llmItemsCurrState = llmItemsCurrState;

    // If this is a chat node, we also need to pull chat histories: 
    let [past_chat_llms, pulled_chats] = node_type === 'chat' ? pullInputChats() : [undefined, undefined];
    if (node_type === 'chat' && contWithPriorLLMs) {
        if (past_chat_llms === undefined) {
            setRunTooltip('Attach an input to past conversations first.');
            return;
        }
        _llmItemsCurrState = past_chat_llms;
        pulled_chats = bucketChatHistoryInfosByLLM(pulled_chats);
    }

    // Pull the input data
    let pulled_vars = {};
    try {
        pulled_vars = pullInputData(templateVars, id);
    } catch (err) {
        setRunTooltip('Error: Duplicate variables detected.');
        console.error(err);
        return;  // early exit
    }

    updateShowContToggle(pulled_vars);

    // Whether to continue with only the prior LLMs, for each value in vars dict
    if (node_type !== 'chat' && showContToggle && contWithPriorLLMs) {
        // We need to draw the LLMs to query from the input responses
        _llmItemsCurrState = getLLMsInPulledInputData(pulled_vars);
    }

    // Check if there's at least one model in the list; if not, nothing to run on.
    if (!_llmItemsCurrState || _llmItemsCurrState.length == 0) {
        setRunTooltip('No LLMs to query.');
        return;
    }
    
    const llms = _llmItemsCurrState.map(item => item.model);
    const num_llms = llms.length;

    // Fetch response counts from backend
    fetchResponseCounts(promptText, pulled_vars, _llmItemsCurrState, pulled_chats, (err) => {
        console.warn(err.message);  // soft fail
    }).then(([counts, total_num_responses]) => {
        // Check for empty counts (means no requests will be sent!)
        const num_llms_missing = Object.keys(counts).length;
        if (num_llms_missing === 0) {
            setRunTooltip('Will load responses from cache');
            setResponsesWillChange(false);
            return;
        }

        setResponsesWillChange(true);

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
            const llm_name = llmListContainer?.current?.getLLMListItemForKey(llm_key)?.name;
            const llm_count = queries_per_llm[llm_key];
            const req = llm_count > 1 ? 'queries' : 'query';
            if (llm_name === undefined)
                setRunTooltip(`Will send ${llm_count} ${req} per LLM`);
            else if (num_llms > num_llms_missing)
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
        triggerAlert('Missing inputs to one or more template variables.');
        return;
    }

    // If this is a chat node, we need to pull chat histories: 
    let [past_chat_llms, pulled_chats] = node_type === 'chat' ? pullInputChats() : [undefined, undefined];

    // If this is a chat node and 'continuing chat with prior LLMs' is checked,
    // there's no customizable model list (llmItemsCurrState). Instead, we need to get the unique
    // LLMs present by finding the set of 'llm' key with unique 'name' properties
    // in the input variables (if any). If there's keys present w/o LLMs (for instance a text node),
    // we need to pop-up an error message.
    let _llmItemsCurrState = llmItemsCurrState;
    if (node_type === 'chat' && contWithPriorLLMs) {
        // If there's nothing attached to past conversations, we can't continue the chat:
        if (past_chat_llms === undefined) {
            triggerAlert('You need to attach an input to the Past Conversation message first. For instance, you might query \
                          multiple chat LLMs with a prompt node, and then attach the Prompt Node output to the \
                          Past Conversation input of this Chat Turn node in order to continue the chat.');
            return;
        }

        // Check if pulled chats includes undefined content.
        // This could happen with Join nodes, where there is no longer a single "prompt" (user prompt)
        // of the chat provenance. Instead of blocking this behavior, we replace undefined with a blank string,
        // and output a warning to the console. 
        if (!pulled_chats.every(c => c.messages.every(m => m.content !== undefined))) {
            console.warn("Chat history contains undefined content. This can happen if a Join Node was used, \
                         as there is no longer a single prompt as the provenance of the conversation. \
                         Soft failing by replacing undefined with empty strings.");
            pulled_chats.forEach(c => {c.messages = c.messages.map(m => {
                if (m.content !== undefined) return m;
                else return {...m, content: " "}; // the string contains a single space since PaLM2 refuses to answer with empty strings
            })});
        }

        // Override LLM list with the past llm info (unique LLMs in prior responses)
        _llmItemsCurrState = past_chat_llms;

        // Now we need transform the 'pulled_chats' to be a dict indexed by LLM nicknames:
        pulled_chats = bucketChatHistoryInfosByLLM(pulled_chats);
    }

    // Pull the data to fill in template input variables, if any
    let pulled_data = {};
    try {
        // Try to pull inputs
        pulled_data = pullInputData(templateVars, id);
    } catch (err) {
        alertModal.current?.trigger(err.message);
        console.error(err);
        return;  // early exit
    }

    const prompt_template = promptText;

    // Whether to continue with only the prior LLMs, for each value in vars dict
    if (node_type !== 'chat' && showContToggle && contWithPriorLLMs) {
        // We need to draw the LLMs to query from the input responses
        _llmItemsCurrState = getLLMsInPulledInputData(pulled_data);
    }

    // Check that there is at least one LLM selected:
    if (_llmItemsCurrState.length === 0) {
        alert('Please select at least one LLM to prompt.')
        return;
    }

    // Set status indicator
    setStatus('loading');
    setContChatToggleDisabled(true);
    setJSONResponses([]);
    setProgressAnimated(true);

    const rejected = (err) => {
        setStatus('error');
        setContChatToggleDisabled(false);
        triggerAlert(err.message || err);
    };

    // Fetch info about the number of queries we'll need to make 
    const fetch_resp_count = () => fetchResponseCounts(
        prompt_template, pulled_data, _llmItemsCurrState, pulled_chats, rejected);
    
    // Initialize progress bars to small amounts
    setProgress({ success: 2, error: 0 });
    llmListContainer?.current?.setZeroPercProgress();

    // Create a callback to listen for progress
    let onProgressChange = () => {};
    const open_progress_listener = ([response_counts, total_num_responses]) => {
        setResponsesWillChange(!response_counts || Object.keys(response_counts).length === 0);

        const max_responses = Object.keys(total_num_responses).reduce((acc, llm) => acc + total_num_responses[llm], 0);

        onProgressChange = (progress_by_llm_key) => {
            if (!progress_by_llm_key) return;
        
            // Update individual progress bars
            const num_llms = _llmItemsCurrState.length;
            const num_resp_per_llm = (max_responses / num_llms);
            llmListContainer?.current?.updateProgress(item => {
                if (item.key in progress_by_llm_key) {
                    item.progress = {
                        success: progress_by_llm_key[item.key]['success'] / num_resp_per_llm * 100,
                        error: progress_by_llm_key[item.key]['error'] / num_resp_per_llm * 100,
                    }
                }
                return item;
            });
            
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
            llm: _llmItemsCurrState,  // deep clone it first
            prompt: prompt_template,
            vars: pulled_data,
            chat_histories: pulled_chats,
            n: numGenerations,
            api_keys: (apiKeys ? apiKeys : {}),
            no_cache: false,
            progress_listener: onProgressChange,
            cont_only_w_prior_llms: node_type !== 'chat' ? (showContToggle && contWithPriorLLMs) : undefined,
        }, rejected).then(function(json) {
            if (!json) {
                rejected('Request was sent and received by backend server, but there was no response.');
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
                    llmListContainer?.current?.ensureLLMItemsErrorProgress(llms_w_errors);

                    // Set error status
                    setStatus('error');
                    setContChatToggleDisabled(false);

                    // Trigger alert and display one error message per LLM of all collected errors:
                    let combined_err_msg = "";
                    llms_w_errors.forEach(llm_key => {
                        const item = _llmItemsCurrState.find((item) => item.key === llm_key);                       
                        combined_err_msg += item?.name + ': ' + JSON.stringify(json.errors[llm_key][0]) + '\n';
                    });
                    // We trigger the alert directly (don't use triggerAlert) here because we want to keep the progress bar:
                    alertModal?.current?.trigger('Errors collecting responses. Re-run prompt node to retry.\n\n'+combined_err_msg);

                    return;
                }

                if (responsesWillChange && !showDrawer)
                    setUninspectedResponses(true);
                setResponsesWillChange(false);

                // All responses collected! Change status to 'ready':
                setStatus('ready');
                setContChatToggleDisabled(false);

                // Remove progress bars
                setProgress(undefined);
                setProgressAnimated(true);
                llmListContainer?.current?.resetLLMItemsProgress();
                
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
                                      llm: _llmItemsCurrState.find((item) => item.name === resp_obj.llm) };

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
                rejected(json.error || 'Unknown error when querying LLM');
            }
        }, rejected);
    };

    // Now put it all together!
    fetch_resp_count()
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
    <BaseNode classNames="prompt-node" nodeId={id}>
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
                    <PromptListPopover key='prompt-previews' promptInfos={promptPreviews} onHover={handlePreviewHover} onClick={openInfoModal} />
                ]} />
    <LLMResponseInspectorModal ref={inspectModal} jsonResponses={jsonResponses} prompt={promptText} />
    <Modal title={'List of prompts that will be sent to LLMs (' + promptPreviews.length + ' total)'} size='xl' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-5%'}}}>
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
            <input id="num-generations" name="num-generations" type="number" min={1} max={999} defaultValue={data.n || 1} onChange={handleNumGenChange} className="nodrag"></input>
        </div>

        { showContToggle ? 
            <div>
                <Switch
                    label={contWithPriorLLMs ? "Continue with prior LLM(s)" : "Continue with new LLMs:"}
                    defaultChecked={true}
                    checked={contWithPriorLLMs} 
                    disabled={contToggleDisabled}
                    onChange={(event) => {
                        setStatus('warning');
                        setContWithPriorLLMs(event.currentTarget.checked);
                        setDataPropsForNode(id, { contChat: event.currentTarget.checked });
                    }}
                    color='cyan'
                    size='xs'
                    mb={contWithPriorLLMs ? '4px' : '10px'}
                />
            </div>
            : <></>
        }
        
        {(!contWithPriorLLMs || !showContToggle) ? (
         <LLMListContainer 
            ref={llmListContainer}
            initLLMItems={data.llms} 
            onAddModel={addModel} 
            onItemsChange={onLLMListItemsChange} />
         ) : <></>}

        {progress !== undefined ? 
            (<Progress animate={progressAnimated} sections={[
                { value: progress.success, color: 'blue', tooltip: 'API call succeeded' },
                { value: progress.error, color: 'red', tooltip: 'Error collecting response' }
            ]} />)
        : <></>}

        { jsonResponses && jsonResponses.length > 0 && status !== 'loading' ? 
            (<InspectFooter onClick={showResponseInspector} 
                showNotificationDot={uninspectedResponses} 
                       isDrawerOpen={showDrawer}
                   showDrawerButton={true} 
                      onDrawerClick={() => {
                        setShowDrawer(!showDrawer); 
                        setUninspectedResponses(false);
                        bringNodeToFront(id);
                    }} />
            ) : <></>
        }
        </div>

        <LLMResponseInspectorDrawer jsonResponses={jsonResponses} showDrawer={showDrawer} />
        
    </BaseNode>
   );
};

export default PromptNode;