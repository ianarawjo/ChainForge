import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Handle } from 'reactflow';
import { Button, Code, Modal, Tooltip, Box, Text } from '@mantine/core';
import { Prism } from '@mantine/prism';
import { useDisclosure } from '@mantine/hooks';
import useStore from './store';
import BaseNode from "./BaseNode";
import NodeLabel from './NodeLabelComponent';
import { IconTerminal, IconSearch, IconInfoCircle } from '@tabler/icons-react';
import LLMResponseInspectorModal from './LLMResponseInspectorModal';

// Ace code editor
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-xcode";
import "ace-builds/src-noconflict/ext-language_tools";
import fetch_from_backend from './fetch_from_backend';
import { APP_IS_RUNNING_LOCALLY, stripLLMDetailsFromResponses, toStandardResponseFormat } from './backend/utils';
import InspectFooter from './InspectFooter';
import { escapeBraces } from './backend/template';
import LLMResponseInspectorDrawer from './LLMResponseInspectorDrawer';

// Whether we are running on localhost or not, and hence whether
// we have access to the Flask backend for, e.g., Python code evaluation.
const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

const _info_codeblock_js = `
class ResponseInfo {
  text: string;  // The text of the LLM response
  prompt: string  // The text of the prompt using to query the LLM
  llm: string | LLM  // The name of the LLM queried (the nickname in ChainForge)
  var: Dict  // A dictionary of arguments that filled in the prompt template used to generate the final prompt
  meta: Dict  // A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt

  // Methods
  toString(): string // returns this.text
  asMarkdownAST(): Tokens[]  // runs markdown-it .parse; returns list of markdown nodes
}`;

const _info_codeblock_py = `
class ResponseInfo:
  text: str  # The text of the LLM response
  prompt: str  # The text of the prompt using to query the LLM
  llm: str  # The name of the LLM queried (the nickname in ChainForge)
  var: dict  # A dictionary of arguments that filled in the prompt template used to generate the final prompt
  meta: dict  # A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt

  # Methods
  def __str__(self):
    return self.text
  
  def asMarkdownAST(self):
    # Returns markdown AST parsed with mistune
    ...
`;

// Code evaluator examples for info modal
const _info_example_py = `
def evaluate(response):
  # Return the length of the response (num of characters)
  return len(response.text);
`;
const _info_example_js = `
function evaluate(response) {
  // Return the length of the response (num of characters)
  return response.text.length;
}`;
const _info_example_var_py = `
def evaluate(response):
  country = response.var['country'];
  # do something with country here, such as lookup whether 
  # the correct capital is in response.text
  return ... # for instance, True or False
`;
const _info_example_var_js = `
function evaluate(response) {
  let country = response.var['country'];
  // do something with country here, such as lookup whether 
  // the correct capital is in response.text
  return ... // for instance, true or false
}`;

// Code processor examples for info modal
const _info_proc_example_py = `
def process(response):
  # Return the first 12 characters
  return response.text[:12]
`;
const _info_proc_example_js = `
function process(response) {
  // Return the first 12 characters
  return response.text.slice(0, 12);
}`;
const _info_proc_example_var_py = `
def process(response):
  # Find the index of the substring "ANSWER:"
  answer_index = response.text.find("ANSWER:")

  # If "ANSWER:" is in the text, return everything after it
  if answer_index != -1:
    return response.text[answer_index + len("ANSWER:"):]
  else: # return error message
    return "NOT FOUND"
`;
const _info_proc_example_var_js = `
function process(response) {
  // Find the index of the substring "ANSWER:"
  const answerIndex = response.text.indexOf("ANSWER:");

  // If "ANSWER:" is in the text, return everything after it
  if (answerIndex !== -1)
    return response.text.substring(answerIndex + "ANSWER:".length);
  else  // return error message
    return "NOT FOUND";
}`;

/**
 *  The Code Evaluator class supports users in writing JavaScript and Python functions that map across LLM responses.
 *  It has two modes: evaluator and processor mode. Evaluators annotate responses with scores; processors transform response objects themselves. 
 */
const CodeEvaluatorNode = ({ data, id, type: node_type }) => {

  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const pullInputData = useStore((state) => state.pullInputData);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);
  const [status, setStatus] = useState('none');
  const nodes = useStore((state) => state.nodes);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For an info pop-up that explains the type of ResponseInfo
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] = useDisclosure(false);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef(null);
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // The programming language for the editor. Also determines what 'execute'
  // function will ultimately be called.
  const [progLang, setProgLang] = useState(data.language || 'python');

  // The text in the code editor. 
  const [codeText, setCodeText] = useState(data.code);
  const [codeTextOnLastRun, setCodeTextOnLastRun] = useState(false);

  const [lastRunLogs, setLastRunLogs] = useState("");
  const [lastResponses, setLastResponses] = useState([]);
  const [lastRunSuccess, setLastRunSuccess] = useState(true);

  // On initialization
  useEffect(() => {

    if (!IS_RUNNING_LOCALLY && progLang === 'python') {
      // The user has loaded a Python evaluator node 
      // without access to the Flask backend on localhost. 
      // Warn them the evaluator won't function:
      console.warn('Loaded a Python evaluator node without access to Flask backend on localhost.')
      alertModal.current.trigger(
        "This flow contains a Python evaluator node, yet ChainForge does not appear to be running locally on your machine. \
        You will not be able to run Python code in the evaluator. If you want to write an evaluator to score responses, \
        we recommend that you use a JavaScript evaluator node instead. If you'd like to run the Python evaluator, \
        consider installing ChainForge locally.");
    }

    // Attempt to grab cache'd responses
    fetch_from_backend('grabResponses', {
      responses: [id],
    }).then(function(json) {
      if (json.responses && json.responses.length > 0) {
        // Store responses and set status to green checkmark
        setLastResponses(stripLLMDetailsFromResponses(json.responses));
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

  const handleCodeChange = (code) => {
    if (codeTextOnLastRun !== false) {
      const code_changed = code !== codeTextOnLastRun;
      if (code_changed && status !== 'warning')
        setStatus('warning');
      else if (!code_changed && status === 'warning')
        setStatus('ready');
    }
    setCodeText(code);
    setDataPropsForNode(id, {code: code});
  };

  const handleRunClick = () => {
    // Disallow running a Python evaluator node when not on localhost:
    if (!IS_RUNNING_LOCALLY && progLang === 'python') {
      alertModal.current.trigger(
        "Python code can only be evaluated when ChainForge is running locally on your machine (on localhost). \
        If you want to run an evaluator to score responses, we recommend that you use a JavaScript evaluator node \
        instead. If you'd like to run the Python evaluator, consider installing ChainForge locally.");
      return;
    }

    // Pull input data
    let pulled_inputs = pullInputData(["responseBatch"], id);
    if (!pulled_inputs || !pulled_inputs["responseBatch"]) {
      console.warn(`No inputs for code ${node_type} node.`);
      return;
    }
    // Convert to standard response format (StandardLLMResponseFormat)
    pulled_inputs = pulled_inputs["responseBatch"].map(toStandardResponseFormat);

    // Double-check that the code includes an 'evaluate' function:
    const find_func_regex = node_type === 'evaluator' ? (progLang === 'python' ? /def\s+evaluate\s*(.*):/ : /function\s+evaluate\s*(.*)/)
                                                      : (progLang === 'python' ? /def\s+process\s*(.*):/ : /function\s+process\s*(.*)/);
    if (codeText.search(find_func_regex) === -1) {
      const req_func_name = node_type === 'evaluator' ? 'evaluate' : 'process';
      const err_msg = `Could not find required function '${req_func_name}'. Make sure you have defined an '${req_func_name}' function.`;
      setStatus('error');
      alertModal.current.trigger(err_msg);
      return;
    }

    setStatus('loading');
    setLastRunLogs("");
    setLastResponses([]);

    const rejected = (err_msg) => {
      setStatus('error');
      alertModal.current.trigger(err_msg);
    };

    // const _llmItemsCurrState = getLLMsInPulledInputData(pulled_data);

    // Get all the Python script nodes, and get all the folder paths
    // NOTE: Python only!
    let script_paths = [];
    if (progLang === 'python') {
      const script_nodes = nodes.filter(n => n.type === 'script');
      script_paths = script_nodes.map(n => Object.values(n.data.scriptFiles).filter(f => f !== '')).flat();
    }

    // Run evaluator in backend
    const codeTextOnRun = codeText + '';
    const execute_route = (progLang === 'python') ? 'executepy' : 'executejs';
    fetch_from_backend(execute_route, {
      id: id,
      code: codeTextOnRun,
      responses: pulled_inputs,
      scope: 'response',
      process_type: node_type,
      script_paths: script_paths,
    }).then(function(json) {
        // Store any Python print output
        if (json?.logs) {
          let logs = json.logs;
          if (json.error)
            logs.push(json.error);
          setLastRunLogs(logs.join('\n   > '));
        }
    
        // Check if there's an error; if so, bubble it up to user and exit:
        if (!json || json.error) {
          setStatus('error');
          setLastRunSuccess(false);
          alertModal.current.trigger(json ? json.error : 'Unknown error encountered when requesting evaluations: empty response returned.');
          return;
        }
        
        // Ping any vis + inspect nodes attached to this node to refresh their contents:
        pingOutputNodes(id);
        setLastResponses(stripLLMDetailsFromResponses(json.responses));
        setCodeTextOnLastRun(codeTextOnRun);
        setLastRunSuccess(true);

        setDataPropsForNode(id, {fields: json.responses.map(
          resp_obj => resp_obj['responses'].map(r => {
            // Carry over the response text, prompt, prompt fill history (vars), and llm data
            let o = { text: escapeBraces(r), 
                      prompt: resp_obj['prompt'],
                      fill_history: resp_obj['vars'],
                      metavars: resp_obj['metavars'] || {},
                      llm: resp_obj['llm'] };

            // Carry over any chat history
            if (resp_obj['chat_history']) 
              o.chat_history = resp_obj['chat_history'];

            return o;
          })).flat()
        });

        if (status !== 'ready' && !showDrawer)
          setUninspectedResponses(true);
        
        setStatus('ready');
    }).catch((err) => rejected(err.message));
  };

  const hideStatusIndicator = () => {
    if (status !== 'none') { setStatus('none'); }
  };

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  /* Memoized variables for displaying the UI that depend on the node type (evaluator or processor) and the programming language. */
  const default_header = useMemo(() => {
    const capitalized_type = node_type.charAt(0).toUpperCase() + node_type.slice(1);
    if (progLang === 'python')
      return `Python ${capitalized_type} Node`;
    else
      return `JavaScript ${capitalized_type} Node`;
  }, [progLang, node_type]); 
  const node_header = data.title || default_header;
  const run_tooltip = useMemo(() => `Run ${node_type} over inputs`, [node_type]);
  const code_instruct_header = useMemo(() => {
    if (node_type === 'evaluator')
      return <div className="code-mirror-field-header">Define an <Code>evaluate</Code> func to map over each response:</div>;
    else 
      return <div className="code-mirror-field-header">Define a <Code>process</Code> func to map over each response:</div>;
  }, [node_type]);
  const code_info_modal = useMemo(() => {
    if (node_type === 'evaluator')
      return <Box m='lg' mt='xl'>
        <Text mb='sm'>To use a {default_header}, write a function <Code>evaluate</Code> that takes a single argument of class <Code>ResponseInfo</Code>.
        The function should return a \'score\' for that response, which usually is a number or a boolean value (strings as categoricals are supported, but experimental).</Text>
        <Text mt='sm' mb='sm'>
        For instance, here is an evaluator that returns the length of a response:</Text>
        <Prism language={progLang === 'python' ? 'py' : 'ts'}>
          {progLang === 'python' ? _info_example_py : _info_example_js}
        </Prism>
        <Text mt='md' mb='sm'>This function gets the text of the response via <Code>response.text</Code>, then calculates its length in characters. The full <Code>ResponseInfo</Code> class has the following properties and methods:</Text>
        <Prism language={progLang === 'python' ? 'py' : 'ts'}>
          {progLang === 'python' ? _info_codeblock_py : _info_codeblock_js}
        </Prism>
        <Text mt='md' mb='sm'>For instance, say you have a prompt template <Code>What is the capital of &#123;country&#125;?</Code> on a Prompt Node. 
          You want to get the input variable 'country', which filled the prompt that led to the current response. You can use<Code>response.var</Code>:</Text>
        <Prism language={progLang === 'python' ? 'py' : 'ts'}>
          {progLang === 'python' ? _info_example_var_py : _info_example_var_js}
        </Prism>
        <Text mt='md'>Note that you are allowed to define variables outside of the function, or define more functions, as long as a function called <Code>evaluate</Code> is defined. 
        For more information on what's possible, see the <a href="https://chainforge.ai/docs/" target='_blank'>documentation</a> or load some Example Flows.</Text>
      </Box>;
    else 
      return <Box m='lg' mt='xl'>
        <Text mb='sm'>To use a {default_header}, write a function <Code>process</Code> that takes a single argument of class <Code>ResponseInfo</Code>.
        The function should returned the <strong>transformed response text</strong>, as a string or number.</Text>
        <Text mt='sm' mb='sm'>
        For instance, here is a processor that simply returns the first 12 characters of the response:</Text>
        <Prism language={progLang === 'python' ? 'py' : 'ts'}>
          {progLang === 'python' ? _info_proc_example_py : _info_proc_example_js}
        </Prism>
        <Text mt='md' mb='sm'>This function gets the text of the response via <Code>response.text</Code>, then slices it until the 12th-indexed character. The full <Code>ResponseInfo</Code> class has the following properties and methods:</Text>
        <Prism language={progLang === 'python' ? 'py' : 'ts'}>
          {progLang === 'python' ? _info_codeblock_py : _info_codeblock_js}
        </Prism>
        <Text mt='md' mb='sm'>For another example, say you have a prompt that requests the LLM output in a consistent format, with "ANSWER:" at the end like Chain-of-Thought. 
          You want to get just the part after 'ANSWER:' Here's how you can do this:</Text>
        <Prism language={progLang === 'python' ? 'py' : 'ts'}>
          {progLang === 'python' ? _info_proc_example_var_py : _info_proc_example_var_js}
        </Prism>
        <Text mt='md'>Note that you are allowed to define variables outside of the function, or define more functions, as long as a function called <Code>process</Code> is defined. 
        For more information on what's possible, see the <a href="https://chainforge.ai/docs/" target='_blank'>documentation</a>. Finally, note that currently 
        you cannot change the response metadata itself (i.e., var, meta dictionaries); if you have a use case for that feature, raise an Issue on our GitHub.</Text>
      </Box>;
  }, [progLang, node_type])

  return (
    <BaseNode classNames="evaluator-node" nodeId={id}>
      <NodeLabel title={node_header} 
                  nodeId={id} 
                  onEdit={hideStatusIndicator}
                  icon={<IconTerminal size="16px" />} 
                  status={status}
                  alertModal={alertModal}
                  handleRunClick={handleRunClick}
                  runButtonTooltip={run_tooltip}
                  customButtons={[
                    <Tooltip label='Info' key="eval-info">
                      <button onClick={openInfoModal} className='custom-button' style={{border:'none'}}>
                        <IconInfoCircle size='12pt' color='gray' style={{marginBottom: '-4px'}} />
                      </button>
                    </Tooltip>]}
                  />
      <LLMResponseInspectorModal ref={inspectModal} jsonResponses={lastResponses} />
      <Modal title={default_header} size='60%' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-5%'}}}>
        {code_info_modal}
      </Modal>
      <iframe style={{display: 'none'}} id={`${id}-iframe`}></iframe>
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
      <div className="core-mirror-field">
        {code_instruct_header}
        <div className="ace-editor-container nodrag">
          <AceEditor
            mode={progLang}
            theme="xcode"
            onChange={handleCodeChange}
            value={data.code}
            name={"aceeditor_"+id}
            editorProps={{ $blockScrolling: true }}
            width='100%'
            height='100px'
            style={{minWidth:'310px'}}
            setOptions={{useWorker: false}}
            tabSize={2}
            onLoad={editorInstance => {  // Make Ace Editor div resizeable. 
              editorInstance.container.style.resize = "both";
              document.addEventListener("mouseup", e => (
                editorInstance.resize()
              ));
            }}
          />
        </div>
      </div>

      {(lastRunLogs && lastRunLogs.length > 0) ? 
        (<div className="eval-output-footer nowheel" style={{backgroundColor: (lastRunSuccess ? '#eee' : '#f19e9eb1')}}>
          <p style={{color: (lastRunSuccess ? '#999' : '#a10f0f')}}><strong>out:</strong> {lastRunLogs}</p>
        </div>)
        : (<></>)
      }

      { lastRunSuccess && lastResponses && lastResponses.length > 0 ? 
        (<InspectFooter label={<>Inspect results&nbsp;<IconSearch size='12pt'/></>} 
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

export default CodeEvaluatorNode;