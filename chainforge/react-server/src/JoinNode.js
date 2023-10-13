import React, { useState, useEffect } from 'react';
import { Handle } from 'reactflow';
import useStore from './store';
import NodeLabel from './NodeLabelComponent';
import fetch_from_backend from './fetch_from_backend';
import { IconArrowMerge } from '@tabler/icons-react';
import { Divider, NativeSelect, Text } from '@mantine/core';

const JoinNode = ({ data, id }) => {

  let is_fetching = false;

  const [jsonResponses, setJSONResponses] = useState(null);

  const [pastInputs, setPastInputs] = useState([]);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const handleOnConnect = () => {
    // For some reason, 'on connect' is called twice upon connection.
    // We detect when an inspector node is already fetching, and disable the second call:
    if (is_fetching) return; 

    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);

    is_fetching = true;

    // Grab responses associated with those ids:
    fetch_from_backend('grabResponses', {
      'responses': input_node_ids
    }).then(function(json) {
        if (json.responses && json.responses.length > 0) {
            setJSONResponses(json.responses);
        }
        is_fetching = false;
    }).catch(() => {
        is_fetching = false; 
    });
  }

  const [groupByVar, setGroupByVar] = useState("all text");
  const handleChangeGroupByVar = (new_val) => {
    setGroupByVar(new_val.target.value);
  };

  const [groupByLLM, setGroupByLLM] = useState("within");
  const handleChangeGroupByLLM = (new_val) => {
    setGroupByLLM(new_val.target.value);
  };

  const [responsesPerPrompt, setResponsesPerPrompt] = useState("all");
  const handleChangeResponsesPerPrompt = (new_val) => {
    setResponsesPerPrompt(new_val.target.value);
  };

  if (data.input) {
    // If there's a change in inputs...
    if (data.input != pastInputs) {
        setPastInputs(data.input);
        handleOnConnect();
    }
  }

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
        // Recreate the visualization:
        setDataPropsForNode(id, { refresh: false });
        handleOnConnect();
    }
  }, [data, id, handleOnConnect, setDataPropsForNode]);

  return (
    <div className="join-node cfnode">
    <NodeLabel title={data.title || 'Join Node'} 
                nodeId={id}
                icon={<IconArrowMerge size='14pt'/>}
                />
    <div style={{display: 'flex', justifyContent: 'left', maxWidth: '100%', marginBottom: '10px'}}>
      <Text mt='3px' mr='xs'>Join</Text>
      <NativeSelect onChange={handleChangeGroupByVar}
                    className='nodrag nowheel'
                    data={["all text", "by country", "by city"]}
                    size="xs"
                    value={groupByVar}
                    miw='80px'
                    mr='xs' />
    </div>
    <div style={{display: 'flex', justifyContent: 'left', maxWidth: '100%', marginBottom: '10px'}}>
      <NativeSelect onChange={handleChangeGroupByLLM}
                    className='nodrag nowheel'
                    data={["within", "across"]}
                    size="xs"
                    value={groupByLLM}
                    maw='80px'
                    mr='xs' />
      <Text mt='3px'>LLM(s)</Text>
    </div>
    <div style={{display: 'flex', justifyContent: 'left', maxWidth: '100%'}}>
      <Text size='sm' mt='3px' mr='xs' color='gray' fs='italic'> take</Text>
      <NativeSelect onChange={handleChangeResponsesPerPrompt}
                    className='nodrag nowheel'
                    data={["all", "1", "2", "3"]}
                    size="xs"
                    value={"1"}
                    maw='80px'
                    mr='xs' 
                    color='gray' />
      <Text size='sm' mt='3px' color='gray' fs='italic'>resp / prompt</Text>
    </div>
    <Divider my="xs" label="formatting" labelPosition="center" />
    <NativeSelect onChange={handleChangeResponsesPerPrompt}
                  className='nodrag nowheel'
                  data={["double newline \\n\\n", "newline \\n", "- dashed list", '["list", "of", "strings"]']}
                  size="xs"
                  value={"double newline"}
                  miw='80px' />
    <Handle
      type="target"
      position="left"
      id="input"
      className="grouped-handle"
      style={{ top: "50%" }}
      onConnect={handleOnConnect}
    />
    <Handle
      type="source"
      position="right"
      id="output"
      className="grouped-handle"
      style={{ top: "50%" }}
    />
  </div>);
};

export default JoinNode;