import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle } from 'react-flow-renderer';
import { Alert, NativeSelect, Textarea } from '@mantine/core';
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

  const [jsonResponses, setJSONResponses] = useState(null);
  const [status, setStatus] = useState('none');
  const alertModal = useRef(null);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const [llmScorers, setLLMScorers] = useState([data.scorer || DEFAULT_LLM_ITEM]);

  const handleRunClick = useCallback(() => {

  }, []);

  const handlePromptChange = useCallback((event) => {

  }, []);

  const onLLMListItemsChange = useCallback((new_items) => {
    // setLLMItemsCurrState(new_items);
    // setDataPropsForNode(id, { llms: new_items });
  }, [llmScorers]);

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
                defaultValue={data.prompt || DEFAULT_PROMPT}  
                onChange={handlePromptChange} />
      
      <LLMListContainer 
                llmItems={llmScorers} 
                description="Model to use as grader:"
                modelSelectButtonText="Change"
                selectModelAction="replace"
                onAddModel={() => {}} 
                onItemsChange={onLLMListItemsChange} />
    
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