import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Handle } from "reactflow";
import { NativeSelect, TextInput, Flex, Text, Group, Box, Select, ActionIcon, Menu, Tooltip, Card, rem, Input, Code, Progress, Collapse, Button } from "@mantine/core";
import { useDisclosure } from '@mantine/hooks';
import { IconAbacus, IconArrowDown, IconCaretDown, IconChevronDown, IconChevronRight, IconDots, IconHash, IconInfoCircle, IconPlus, IconRobot, IconRuler2, IconSearch, IconSparkles, IconTerminal, IconTrash, IconX } from "@tabler/icons-react";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorModal from "./LLMResponseInspectorModal";
import useStore from "./store";
import fetch_from_backend from "./fetch_from_backend";
import { APP_IS_RUNNING_LOCALLY, stripLLMDetailsFromResponses, toStandardResponseFormat } from "./backend/utils";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";
import { CodeEvaluatorComponent } from "./CodeEvaluatorNode";

const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

/** A wrapper for a single evaluator, that can be renamed */
const EvaluatorContainer = ({name, type: evalType, children}) => {
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Card withBorder shadow="sm" mb='xs' radius="md" style={{cursor: 'default'}}>
      <Card.Section withBorder pl='8px'>
        <Group justify="space-between">
          <Group justify="flex-start" spacing='0px'>
            <Button onClick={toggle} variant="subtle" color="gray" p='0px' m='0px'>
              {opened ? <IconChevronDown size='14pt'/> : <IconChevronRight size='14pt'/>}
            </Button>
            <TextInput value={name} placeholder="Criteria name" variant="unstyled" size="sm" classNames="nodrag nowheel" styles={{input: {padding: '0px', height: '14pt', minHeight: '0pt', fontWeight: '500'}}} />
          </Group>
          <Group spacing='4px' ml="auto">
            <Text color='#bbb' size="sm" mr='6px'>{evalType}</Text>
            {/* <Progress
                radius="xl"
                w={32}
                size={14}
                sections={[
                  { value: 70, color: 'green', tooltip: '70% true' },
                  { value: 30, color: 'red', tooltip: '30% false' },
                ]} /> */}
            <Menu withinPortal position="right-start" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDots style={{ width: rem(16), height: rem(16) }} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item icon={<IconSearch size='14px' />}>Inspect scores</Menu.Item>
                <Menu.Item icon={<IconInfoCircle size='14px' />}>Help / info</Menu.Item>
                <Menu.Item icon={<IconTrash size='14px' />} color="red">Delete</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Card.Section>

      <Card.Section p={'0px'}>
        <Collapse in={opened}>
          {children}
        </Collapse>
      </Card.Section>
    </Card>
  );
};

/** A node that stores multiple evaluator functions (can be mix of LLM scorer prompts and arbitrary code.) */
const MultiEvalNode = ({data, id}) => {
  
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pullInputData = useStore((state) => state.pullInputData);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);
  const flags = useStore((state) => state.flags);

  const AI_SUPPORT_ENABLED = useMemo(() => {
    return flags["aiSupport"];
  }, [flags]);

  const [status, setStatus] = useState('none');
  const alertModal = useRef(null);

  const inspectModal = useRef(null);
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [lastResponses, setLastResponses] = useState([]);
  const [lastRunSuccess, setLastRunSuccess] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const handleError = useCallback((err) => {
    console.error(err);
    setStatus('error');
    alertModal.current?.trigger(err?.message ?? err);
  }, [alertModal, setStatus]);

  const handlePullInputs = useCallback(() => {
    // Pull input data
    try {
      let pulled_inputs = pullInputData(["responseBatch"], id);
      if (!pulled_inputs || !pulled_inputs["responseBatch"]) {
        console.warn(`No inputs to the Simple Evaluator node.`);
        return [];
      }
      // Convert to standard response format (StandardLLMResponseFormat)
      return pulled_inputs["responseBatch"].map(toStandardResponseFormat);
    } catch (err) {
      handleError(err);
      return [];
    }
  }, [pullInputData, id, toStandardResponseFormat]); 

  const handleRunClick = useCallback(() => {
    // Pull inputs to the node
    let pulled_inputs = handlePullInputs();
    if (!pulled_inputs || pulled_inputs.length === 0)
      return;

    // Set status and created rejection callback
    setStatus('loading');
    setLastResponses([]);

    // Run stuff here! 
  }, [handlePullInputs, pingOutputNodes, setStatus, alertModal, status, showDrawer]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus('warning');
    }
  }, [data]);

  return (
    <BaseNode classNames="evaluator-node" nodeId={id} style={{backgroundColor: '#eee'}}>
      <NodeLabel title={data.title || 'Multi-Evaluator'} 
                  nodeId={id} 
                  icon={<IconAbacus size="16px" />} 
                  status={status}
                  alertModal={alertModal}
                  handleRunClick={handleRunClick}
                  runButtonTooltip="Run all evaluators over inputs" />

      <LLMResponseInspectorModal ref={inspectModal} jsonResponses={lastResponses} />
      <iframe style={{display: 'none'}} id={`${id}-iframe`}></iframe>

      <EvaluatorContainer name="Formatting" type="JavaScript">
        <CodeEvaluatorComponent code={"function evaluate(r) {\n\ttry {\n\t\tJSON.parse(r.text);\n\t\treturn true;\n\t} catch (e) {\n\t\treturn false;\n\t} \n}"} 
                                id={id} 
                                type={'evaluator'} 
                                progLang={'javascript'} />
      </EvaluatorContainer>
      <EvaluatorContainer name="Grammaticality" type="LLM" />
      <EvaluatorContainer name="Length" type="Python">
        <CodeEvaluatorComponent code={"def evaluate(r):\n\treturn len(r.text.split())"} 
                                id={id} 
                                type={'evaluator'} 
                                progLang={'python'} />
      </EvaluatorContainer>

      <Handle
          type="target"
          position="left"
          id="responseBatch"
          className="grouped-handle"
          style={{ top: '50%' }} />
      <Handle
          type="source"
          position="right"
          id="output"
          className="grouped-handle"
          style={{ top: '50%' }} />
      
      <div className="add-text-field-btn">
        <Menu withinPortal position="right-start" shadow="sm">
          <Menu.Target>
            <ActionIcon variant="outline" color="gray" size='sm'>
              <IconPlus size='12px' />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item icon={<IconTerminal size='14px' />}>JavaScript</Menu.Item>
            {IS_RUNNING_LOCALLY ? <Menu.Item icon={<IconTerminal size='14px' />}>Python</Menu.Item> : <></>}
            <Menu.Item icon={<IconRobot size='14px' />}>LLM</Menu.Item>
            {AI_SUPPORT_ENABLED ? <Menu.Divider /> : <></>}
            {AI_SUPPORT_ENABLED ? <Menu.Item icon={<IconSparkles size='14px' />}>Let an AI decide!</Menu.Item> : <></>}
          </Menu.Dropdown>
        </Menu>
      </div>

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

export default MultiEvalNode;