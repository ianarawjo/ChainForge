import { useState, useCallback, useEffect, useRef } from "react";
import { Handle } from "reactflow";
import { NativeSelect, TextInput, Flex, Text, Box, Select, ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconCaretDown, IconHash, IconRuler2, IconSearch, IconX } from "@tabler/icons-react";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorModal from "./LLMResponseInspectorModal";
import useStore from "./store";
import fetch_from_backend from "./fetch_from_backend";
import { stripLLMDetailsFromResponses, toStandardResponseFormat } from "./backend/utils";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";

const createJSEvalCodeFor = (responseFormat, operation, value, valueType) => {
  let responseObj = 'r.text'
  if (responseFormat === 'response in lowercase')
    responseObj = 'r.text.toLowerCase()';
  else if (responseFormat === 'length of response')
    responseObj = 'r.text.length';

  let valueObj = `${JSON.stringify(value)}`;
  if (valueType === 'var')
    valueObj = `r.var['${value}']`;
  else if (valueType === 'meta')
    valueObj = `r.meta['${value}']`;

  let returnBody;
  switch (operation) { // 'contains', 'starts with', 'ends with', 'equals', 'appears in'
    case 'contains':
      returnBody = `${responseObj}.includes(${valueObj})`;
      break;
    case 'starts with':
      returnBody = `${responseObj}.trim().startsWith(${valueObj})`;
      break;
    case 'ends with':
      returnBody = `${responseObj}.trim().endsWith(${valueObj})`;
      break;
    case 'equals':
      returnBody = `${responseObj} === ${valueObj}`;
      break;
    case 'appears in':
      returnBody = `${valueObj}.includes(${responseObj})`;
      break;
    default:
      console.error(`Could not create JS code for simple evaluator: Operation type '${operation}' does not exist.`)
      break;
  }
  return `function evaluate(r) {\n  return ${returnBody};\n}`;
};

/**
 * A no-code evaluator node with a very basic options for scoring responses.
 */
const SimpleEvalNode = ({data, id}) => {
  
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pullInputData = useStore((state) => state.pullInputData);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);
  const [pastInputs, setPastInputs] = useState([]);

  const [status, setStatus] = useState('none');
  const alertModal = useRef(null);

  const inspectModal = useRef(null);
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [lastResponses, setLastResponses] = useState([]);
  const [lastRunSuccess, setLastRunSuccess] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const [responseFormat, setResponseFormat] = useState(data.responseFormat || "response");
  const [operation, setOperation] = useState(data.operation || "contains");
  const [textValue, setTextValue] = useState(data.textValue || "");
  const [varValue, setVarValue] = useState(data.varValue || "");
  const [varValueType, setVarValueType] = useState(data.varValueType || "var");
  const [valueFieldDisabled, setValueFieldDisabled] = useState(data.varSelected || false);
  const [lastTextValue, setLastTextValue] = useState("");

  const [availableVars, setAvailableVars] = useState(data.availableVars || []);
  const [availableMetavars, setAvailableMetavars] = useState(data.availableMetavars || []);

  const dirtyStatus = useCallback(() => {
    if (status === 'ready') 
      setStatus('warning');
  }, [status]);

  const handleSetVarAsValue = useCallback((e, valueType) => {
    const txt = `of ${e.target.innerText} (${valueType})`;
    setLastTextValue(textValue);
    setTextValue(txt);
    setVarValue(e.target.innerText);
    setVarValueType(valueType);
    setValueFieldDisabled(true);
    setDataPropsForNode(id, { varValue: e.target.innerText, varValueType: valueType, varSelected: true, textValue: txt });
    dirtyStatus();
  }, [textValue, dirtyStatus]);
  const handleClearValueField = useCallback(() => {
    setTextValue(lastTextValue);
    setValueFieldDisabled(false);
    setDataPropsForNode(id, { varSelected: false, textValue: lastTextValue });
    dirtyStatus();
  }, [lastTextValue, dirtyStatus]);

  const handlePullInputs = useCallback(() => {
    // Pull input data
    let pulled_inputs = pullInputData(["responseBatch"], id);
    if (!pulled_inputs || !pulled_inputs["responseBatch"]) {
      console.warn(`No inputs to the Simple Evaluator node.`);
      return [];
    }
    // Convert to standard response format (StandardLLMResponseFormat)
    return pulled_inputs["responseBatch"].map(toStandardResponseFormat);
  }, [pullInputData, id, toStandardResponseFormat]); 

  const handleRunClick = useCallback(() => {
    // Pull inputs to the node
    let pulled_inputs = handlePullInputs();

    // Set status and created rejection callback
    setStatus('loading');
    setLastResponses([]);

    const rejected = (err_msg) => {
      setStatus('error');
      alertModal.current.trigger(err_msg);
    };

    // Generate JS code for the user's spec
    const code = valueFieldDisabled 
                 ? createJSEvalCodeFor(responseFormat, operation, varValue, varValueType)
                 : createJSEvalCodeFor(responseFormat, operation, textValue, 'string');

    // Run evaluator in backend
    fetch_from_backend('executejs', {
        id: id,
        code: code,
        responses: pulled_inputs,
        scope: 'response',
        process_type: 'evaluator'
    }).then(function(json) {    
      // Check if there's an error; if so, bubble it up to user and exit:
      if (!json || json.error) {
        setLastRunSuccess(false);
        rejected(json ? json.error : 'Unknown error encountered when requesting evaluations: empty response returned.');
        return;
      }
      
      // Ping any vis + inspect nodes attached to this node to refresh their contents:
      pingOutputNodes(id);

      console.log(json.responses);
      setLastResponses(stripLLMDetailsFromResponses(json.responses));
      setLastRunSuccess(true);

      if (status !== 'ready' && !showDrawer)
        setUninspectedResponses(true);
      
      setStatus('ready');
    }).catch((err) => rejected(err.message));
  }, [handlePullInputs, pingOutputNodes, setStatus, alertModal, status, varValue, varValueType, responseFormat, textValue, showDrawer, valueFieldDisabled]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  const handleOnConnect = useCallback(() => {
    // Pull inputs to the node
    let pulled_inputs = handlePullInputs();
    if (pulled_inputs && pulled_inputs.length > 0) {
      // Find all vars and metavars in responses
      let varnames = new Set();
      let metavars = new Set();
      pulled_inputs.forEach(resp_obj => {
          Object.keys(resp_obj.vars).forEach(v => varnames.add(v));
          if (resp_obj.metavars)
              Object.keys(resp_obj.metavars).forEach(v => metavars.add(v));
      });
      const avs = Array.from(varnames);
      const amvs = Array.from(metavars).filter(v => !(v.startsWith('LLM_')));
      setAvailableVars(avs);
      setAvailableMetavars(amvs);
      setDataPropsForNode(id, { availableVars: avs, availableMetavars: amvs });
    }
  }, [data, id, handlePullInputs, setDataPropsForNode]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input != pastInputs) {
        setPastInputs(data.input);
        handleOnConnect();
    }
  }

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus('warning');
      handleOnConnect();
    }
  }, [data]);

  return (
    <BaseNode classNames="evaluator-node" nodeId={id}>
      <NodeLabel title={data.title || 'Simple Evaluator'} 
                  nodeId={id} 
                  icon={<IconRuler2 size="16px" />} 
                  status={status}
                  alertModal={alertModal}
                  handleRunClick={handleRunClick}
                  runButtonTooltip="Run evaluator over inputs" />

      <LLMResponseInspectorModal ref={inspectModal} jsonResponses={lastResponses} />
      <iframe style={{display: 'none'}} id={`${id}-iframe`}></iframe>

      <Flex gap='xs'>
        <Text mt='6px' fz='sm'>Return true if</Text>
        <NativeSelect data={['response', 'response in lowercase']}
                      defaultValue={responseFormat}
                      onChange={(e) => {
                        setResponseFormat(e.target.value);
                        setDataPropsForNode(id, { responseFormat: e.target.value });
                        dirtyStatus();
                      }} />
      </Flex>

      <Flex gap='xs'>
        <Box w='85px' />
        <NativeSelect mt='sm'
                      data={['contains', 'starts with', 'ends with', 'equals', 'appears in']}
                      defaultValue={operation}
                      onChange={(e) => {
                        setOperation(e.target.value);
                        setDataPropsForNode(id, { operation: e.target.value });
                        dirtyStatus();
                      }} />
      </Flex>
      
      <Flex gap='xs' mt='sm'>
        <Text mt='6px' fz='sm'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;the value</Text>
        <TextInput value={textValue} 
                   onChange={(e) => setTextValue(e.target.value)} 
                   onBlur={(e) => setDataPropsForNode(id, {textValue: e.target.value})}
                   onKeyDown={dirtyStatus}
                   disabled={valueFieldDisabled}
                   className="nodrag" />
        { valueFieldDisabled ? (
          <Tooltip label='Clear variable' withArrow position="right" withinPortal>
            <ActionIcon variant="light" size='lg' onClick={handleClearValueField}>
              <IconX size='20px' />
            </ActionIcon>
          </Tooltip>
        ): (
          (availableVars.length > 0 || availableMetavars.length > 0) ? 
            <Menu shadow="md" width={200} withinPortal>
              <Menu.Target>
                <Tooltip label='Use a variable' withArrow position="right" withinPortal>
                  <ActionIcon variant="light" size='lg'>
                    <IconCaretDown size='20px' />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>

              <Menu.Dropdown>
                { availableVars.length > 0 ? <>
                  <Menu.Label>Variables</Menu.Label>
                  {availableVars.map(v => 
                    <Menu.Item key={v} icon={<IconHash size={14} />} onClick={(e) => handleSetVarAsValue(e, 'var')}>{v}</Menu.Item>
                  )}
                  <Menu.Divider />
                </> : <></>}

                { availableMetavars.length > 0 ? <>
                  <Menu.Label>Metavariables</Menu.Label>
                  {availableMetavars.map(v => 
                    <Menu.Item key={v} icon={<IconHash size={14} />} onClick={(e) => handleSetVarAsValue(e, 'meta')}>{v}</Menu.Item>
                  )}
                </> : <></>}
              </Menu.Dropdown>
            </Menu>
          : <></>)}
      </Flex>
      
      <Handle
          type="target"
          position="left"
          id="responseBatch"
          className="grouped-handle"
          style={{ top: '50%' }}
          onConnect={handleOnConnect} />
      <Handle
          type="source"
          position="right"
          id="output"
          className="grouped-handle"
          style={{ top: '50%' }} />
      
      { lastRunSuccess && lastResponses && lastResponses.length > 0 ? 
        (<InspectFooter label={<>Inspect scores&nbsp;<IconSearch size='12pt'/></>}
                        onClick={showResponseInspector}
                        showNotificationDot={uninspectedResponses} 
                        isDrawerOpen={showDrawer}
                        showDrawerButton={true} 
                        onDrawerClick={() => {
                          setShowDrawer(!showDrawer); 
                          setUninspectedResponses(false);
                          bringNodeToFront(id);
                        }}
         />) : <></>}
        
      <LLMResponseInspectorDrawer jsonResponses={lastResponses} showDrawer={showDrawer} />

    </BaseNode>
  );
};

export default SimpleEvalNode;