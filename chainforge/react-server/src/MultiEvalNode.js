import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Handle } from "reactflow";
import { NativeSelect, TextInput, Flex, Text, Group, Box, Select, ActionIcon, Menu, Tooltip, Card, rem, Input, Code, Progress, Collapse, Button, Alert } from "@mantine/core";
import { useDisclosure } from '@mantine/hooks';
import { IconAbacus, IconArrowDown, IconCaretDown, IconChevronDown, IconChevronRight, IconDots, IconHash, IconInfoCircle, IconPlus, IconRobot, IconRuler2, IconSearch, IconSparkles, IconTerminal, IconTrash, IconX } from "@tabler/icons-react";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorModal from "./LLMResponseInspectorModal";
import useStore from "./store";
import { APP_IS_RUNNING_LOCALLY, stripLLMDetailsFromResponses, toStandardResponseFormat } from "./backend/utils";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";
import { CodeEvaluatorComponent } from "./CodeEvaluatorNode";
import { LLMEvaluatorComponent } from "./LLMEvalNode";
import { GatheringResponsesRingProgress } from "./LLMItemButtonGroup";

const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

const TEST_EVAL_COMPS = [
  {name: 'Formatting', type: 'javascript', state: { code: "function evaluate(r) {\n\ttry {\n\t\tJSON.parse(r.text);\n\t\treturn true;\n\t} catch (e) {\n\t\treturn false;\n\t} \n}" }},
  {name: 'Grammaticality', type: 'llm', state: { prompt: "Is this grammatical?", format: "bin" }},
  {name: 'Length', type: 'python', state: { code: "def evaluate(r):\n\treturn len(r.text.split())" }}
];
const EVAL_TYPE_PRETTY_NAME = {
  'python': 'Python',
  'javascript': 'JavaScript',
  'llm': 'LLM',
};

/** A wrapper for a single evaluator, that can be renamed */
const EvaluatorContainer = ({name, type: evalType, padding, onDelete, children}) => {
  const [opened, { toggle }] = useDisclosure(false);
  const _padding = useMemo(() => padding ?? "0px", [padding]);
  const [title, setTitle] = useState(name ?? "Criteria");

  return (
    <Card withBorder shadow="sm" mb='xs' radius="md" style={{cursor: 'default'}}>
      <Card.Section withBorder pl='8px'>
        <Group justify="space-between">
          <Group justify="flex-start" spacing='0px'>
            <Button onClick={toggle} variant="subtle" color="gray" p='0px' m='0px'>
              {opened ? <IconChevronDown size='14pt'/> : <IconChevronRight size='14pt'/>}
            </Button>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Criteria name" variant="unstyled" size="sm" classNames="nodrag nowheel" styles={{input: {padding: '0px', height: '14pt', minHeight: '0pt', fontWeight: '500'}}} />
          </Group>
          <Group spacing='4px' ml="auto">
            <Text color='#bbb' size="sm" mr='6px'>{evalType}</Text>
            <GatheringResponsesRingProgress progress={{success: 30, error: 0}} />
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
                <Menu.Item icon={<IconTrash size='14px' />} color="red" onClick={onDelete}>Delete</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Card.Section>

      <Card.Section p={opened ? _padding : "0px"}>
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

  /** Store evaluators as array of JSON serialized state:
   * {  name: <string>  // the user's nickname for the evaluator, which displays as the title of the banner
   *    type: 'python' | 'javascript' | 'llm'  // the type of evaluator
   *    state: <dict>  // the internal state necessary for that specific evaluator component (e.g., a prompt for llm eval, or code for code eval)
   * }
  */
  const [evaluators, setEvaluators] = useState(data.evaluators ?? TEST_EVAL_COMPS);

  // Add an evaluator to the end of the list
  const addEvaluator = useCallback((name, type, state) => {
    setEvaluators(evaluators.concat({name, type, state}));
  }, [setEvaluators, evaluators]);

  // Sync evaluator state to stored state of this node
  const syncEvaluatorsState = useCallback(() => {
    setDataPropsForNode(id, { evaluators: evaluators });
  }, [evaluators, setDataPropsForNode, id]);

  // Generate UI for the evaluator state
  const evaluatorComponents = useMemo(() => 
    evaluators.map((e, idx) => {
      let component;
      if (e.type === 'python' || e.type === 'javascript') {
        component = <CodeEvaluatorComponent code={e.state?.code} progLang={e.type} type='evaluator' id={id} />;
      } else if (e.type === 'llm') {
        component = <LLMEvaluatorComponent prompt={e.state?.prompt} grader={e.state?.grader} format={e.state?.format} id={id} showUserInstruction={false} />;
      } else {
        console.error(`Unknown evaluator type ${e.type} inside multi-evaluator node. Cannot display evaluator UI.`);
        component = <Alert>Error: Unknown evaluator type {e.type}</Alert>;
      }
      return <EvaluatorContainer name={e.name} 
                                 key={`${e.name}-${idx}`}
                                 type={EVAL_TYPE_PRETTY_NAME[e.type]} 
                                 onDelete={() => setEvaluators(evaluators.filter((_, i) => i !== idx))}
                                 padding={e.type === 'llm' ? "8px" : undefined}>
        {component}
      </EvaluatorContainer>;
  }), [evaluators, id]);


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
    // TODO

  }, [handlePullInputs, pingOutputNodes, setStatus, alertModal, status, showDrawer]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  // Something changed upstream
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

      {evaluatorComponents}

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
            <Menu.Item icon={<IconTerminal size='14px' />}
                       onClick={() => addEvaluator(`Criteria ${evaluators.length+1}`, 'javascript', { code: 'function evaluate(r) {\n\treturn r.text.length;\n}' })} >
              JavaScript
            </Menu.Item>
            {IS_RUNNING_LOCALLY ? 
              <Menu.Item icon={<IconTerminal size='14px' />}
                         onClick={() => addEvaluator(`Criteria ${evaluators.length+1}`, 'python', { code: 'def evaluate(r):\n\treturn len(r.text)' })} >
                Python
              </Menu.Item> : <></>}
            <Menu.Item icon={<IconRobot size='14px' />}
                       onClick={() => addEvaluator(`Criteria ${evaluators.length+1}`, 'llm', { prompt: '', format: 'bin' })} >
              LLM
            </Menu.Item>
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