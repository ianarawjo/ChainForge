import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle } from 'react-flow-renderer';
import { Alert, NativeSelect, Progress, Textarea } from '@mantine/core';
import { IconAlertTriangle, IconRobot } from "@tabler/icons-react";
import { v4 as uuid } from 'uuid';
import useStore from './store';
import NodeLabel from './NodeLabelComponent';
import fetch_from_backend from './fetch_from_backend';
import { AvailableLLMs, getDefaultModelSettings } from './ModelSettingSchemas';
import { LLMListContainer } from './LLMListComponent';

const DEFAULT_PROMPT = "Classify the sentiment of the text into one of three categories: positive, neutral, or negative. Do not reply with anything else.";
const DEFAULT_LLM_ITEM = [AvailableLLMs.find(i => i.base_model === 'gpt-4')]
                                       .map((i) => ({key: uuid(), settings: getDefaultModelSettings(i.base_model), ...i}))[0];

const LLMEvaluatorNode = ({ data, id }) => {

  const [promptText, setPromptText] = useState(data.prompt || DEFAULT_PROMPT);
  const [status, setStatus] = useState('none');
  const alertModal = useRef(null);

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const apiKeys = useStore((state) => state.apiKeys);

  const [llmScorers, setLLMScorers] = useState([data.scorer || DEFAULT_LLM_ITEM]);

  // Progress when querying responses
  const [progress, setProgress] = useState(undefined);

  const handleRunClick = useCallback(() => {
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);
    if (input_node_ids.length === 0) {
        console.warn("No inputs for evaluator node.");
        return;
    }

    setStatus('loading');
    setProgress({success: 2, error: 0});

    const llm_key = llmScorers[0].key;
    const handleError = (err) => {
      setStatus('error');
      alertModal.current.trigger(err);
    };

    // Fetch info about the number of queries we'll need to make 
    fetch_from_backend('grabResponses', {
        responses: input_node_ids,
    }).then(function(json) {
      if (!json?.responses || json.responses.length === 0) {
        handleError('Error pulling input data for node: No input data found.');
        return;
      }

      // Create progress listener
      const progress_listener = (progress_by_llm => {
        setProgress({
          success: 100 * progress_by_llm[llm_key].success / json.responses.length,
          error: 100 * progress_by_llm[llm_key].error / json.responses.length,
        })
      });

      // Run LLM as evaluator
      fetch_from_backend('evalWithLLM', {
        id: id,
        llm: llmScorers[0],
        root_prompt: promptText + '\n```\n{input}\n```', 
        responses: input_node_ids,
        api_keys: (apiKeys ? apiKeys : {}),
        progress_listener: progress_listener,
      }).then(function(json) {
        // Check if there's an error; if so, bubble it up to user and exit:
        if (!json || json.error) {
          handleError(json?.error || 'Unknown error encountered when requesting evaluations: empty response returned.');
          return;
        } else if (json.errors && json.errors.length > 0) {
          handleError(Object.values(json.errors[0])[0]);
          return;
        }
        
        // Ping any vis + inspect nodes attached to this node to refresh their contents:
        pingOutputNodes(id);
  
        console.log(json.responses);
        setStatus('ready');
        setProgress(undefined);
      }).catch(handleError);
    });
  }, [inputEdgesForNode, promptText, llmScorers, apiKeys, pingOutputNodes, setStatus, alertModal]);

  const handlePromptChange = useCallback((event) => {
    // Store prompt text
    setPromptText(event.target.value);
  }, []);

  const onLLMListItemsChange = useCallback((new_items) => {
    setLLMScorers(new_items);
  }, []);

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus('warning');
    }
  }, [data]);

  return (
    <div className="evaluator-node cfnode">
      <NodeLabel title={data.title || 'LLM Evaluator'} 
                  nodeId={id} 
                  icon={<IconRobot size="16px" />} 
                  status={status}
                  alertModal={alertModal}
                  handleRunClick={handleRunClick}
                  runButtonTooltip="Run evaluator over inputs" />
      <Textarea autosize
                label="Describe how to 'grade' a single response."
                description="The text of the response will be pasted directly below your rubric."
                className="prompt-field-fixed nodrag nowheel" 
                minRows="4"
                maxRows="12"
                maw='290px'
                mb='lg'
                value={promptText}
                onChange={handlePromptChange} />
      
      <LLMListContainer 
                llmItems={llmScorers} 
                description="Model to use as grader:"
                modelSelectButtonText="Change"
                selectModelAction="replace"
                onAddModel={() => {}} 
                onItemsChange={onLLMListItemsChange} />
    
      {progress !== undefined ? 
          (<Progress animate={true} sections={[
              { value: progress.success, color: 'blue', tooltip: 'API call succeeded' },
              { value: progress.error, color: 'red', tooltip: 'Error collecting response' }
          ]} />)
      : <></>}

      <Handle
          type="target"
          position="left"
          id="responseBatch"
          className="grouped-handle"
          style={{ top: '50%' }}
        />
      <Handle
          type="source"
          position="right"
          id="output"
          className="grouped-handle"
          style={{ top: '50%' }}
        />
    </div>
  );
};

export default LLMEvaluatorNode;

/* <Alert icon={<IconAlertTriangle size="1rem" />} title="Caution" color="yellow" maw='260px' mt='lg' styles={{title: {margin: '0px'}, icon: {marginRight: '4px'}}}>
AI is not always accurate. Always double-check responses.
</Alert> */