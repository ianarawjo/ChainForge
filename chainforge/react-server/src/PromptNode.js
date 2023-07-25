import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import { Button, Progress, Textarea, Text, Popover, Center, Modal, Box, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSearch, IconList } from '@tabler/icons-react';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import TemplateHooks, { extractBracketedSubstrings } from './TemplateHooksComponent'
import { LLMListContainer } from './LLMListComponent'
import LLMResponseInspectorModal from './LLMResponseInspectorModal';
import fetch_from_backend from './fetch_from_backend';
import { escapeBraces } from './backend/template';

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


const PromptNode = ({ data, id }) => {

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

  // The LLM items container
  const llmListContainer = useRef(null);
  const [llmItemsCurrState, setLLMItemsCurrState] = useState([]);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef(null);

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
    alertModal.current.trigger(msg);
  }, [llmListContainer, alertModal]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && jsonResponses)
        inspectModal.current.trigger();
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

    return [promptText, pulled_data];
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
    const [root_prompt, pulled_vars] = pullInputData();
    fetch_from_backend('generatePrompts', {
        prompt: root_prompt,
        vars: pulled_vars,
    }).then(prompts => {
        setPromptPreviews(prompts.map(p => (new PromptInfo(p))));
    });
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
    const [root_prompt, pulled_vars] = pullInputData();
    const llms = llmItemsCurrState.map(item => item.model);
    const num_llms = llms.length;

    // Fetch response counts from backend
    fetchResponseCounts(root_prompt, pulled_vars, llmItemsCurrState, (err) => {
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
            const llm_name = llmListContainer?.current?.getLLMListItemForKey(llm_key)?.name;
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
    setJSONResponses([]);
    setProgressAnimated(true);

    const [prompt_template, pulled_data] = pullInputData();

    let FINISHED_QUERY = false;
    const rejected = (err) => {
        setStatus('error');
        triggerAlert(err.message);
        FINISHED_QUERY = true;
    };

    // Fetch info about the number of queries we'll need to make 
    const fetch_resp_count = () => fetchResponseCounts(
        prompt_template, pulled_data, llmItemsCurrState, rejected);
    
    // Initialize progress bars to small amounts
    setProgress({ success: 2, error: 0 });
    llmListContainer?.current?.setZeroPercProgress();

    // Create a callback to listen for progress
    let onProgressChange = () => {};
    const open_progress_listener = ([response_counts, total_num_responses]) => {
        const max_responses = Object.keys(total_num_responses).reduce((acc, llm) => acc + total_num_responses[llm], 0);

        onProgressChange = (progress_by_llm_key) => {
            if (!progress_by_llm_key) return;
        
            // Update individual progress bars
            const num_llms = llmItemsCurrState.length;
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
            llm: llmItemsCurrState,  // deep clone it first
            prompt: prompt_template,
            vars: pulled_data,
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
                FINISHED_QUERY = true;

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

                    // Trigger alert and display one error message per LLM of all collected errors:
                    let combined_err_msg = "";
                    llms_w_errors.forEach(llm_key => {
                        const item = llmListContainer?.current?.getLLMListItemForKey(llm_key);                        
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
                llmListContainer?.current?.resetLLMItemsProgress();
                
                // Save prompt text so we remember what prompt we have responses cache'd for:
                setPromptTextOnLastRun(promptText);
                setNumGenerationsLastRun(numGenerations);

                // Save response texts as 'fields' of data, for any prompt nodes pulling the outputs
                // First we need to get a unique key for a unique metavar for the LLM set that produced these responses,
                // so we can keep track of 'upstream' LLMs (and plot against them) later on:
                const llm_metavar_key = getUniqueLLMMetavarKey(json.responses);
                setDataPropsForNode(id, {fields: json.responses.map(
                    resp_obj => resp_obj['responses'].map(
                        r => {
                            // Carry over the response text and prompt fill history (vars):
                            let o = {text: escapeBraces(r), fill_history: resp_obj['vars']};

                            // Carry over any metavars
                            o.metavars = resp_obj['metavars'] || {};

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
      const observer = new ResizeObserver(() => {
        if (!textAreaRef || !textAreaRef.current) return;
        const new_hooks_y = textAreaRef.current.clientHeight + 68;
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
    <NodeLabel title={data.title || 'Prompt Node'} 
                nodeId={id} 
                onEdit={hideStatusIndicator}
                icon={'💬'} 
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
    <Textarea ref={setRef}
                autosize
                className="prompt-field-fixed nodrag nowheel" 
                minRows="4"
                maxRows="12"
                defaultValue={data.prompt}  
                onChange={handleInputChange} />
    <Handle
        type="source"
        position="right"
        id="prompt"
        className="grouped-handle"
        style={{ top: '50%' }}
    />
    <TemplateHooks vars={templateVars} nodeId={id} startY={hooksY} />
      <hr />
      <div>
        <div style={{marginBottom: '10px', padding: '4px'}}>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Num responses per prompt:&nbsp;</label>
            <input id="num-generations" name="num-generations" type="number" min={1} max={50} defaultValue={data.n || 1} onChange={handleNumGenChange} className="nodrag"></input>
        </div>

        <LLMListContainer 
            ref={llmListContainer}
            initLLMItems={data.llms} 
            onAddModel={addModel} 
            onItemsChange={onLLMListItemsChange} />

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