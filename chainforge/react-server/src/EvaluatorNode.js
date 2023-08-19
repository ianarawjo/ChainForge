import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Handle } from 'react-flow-renderer';
import { Button, Code, Modal, Tooltip, Box, Text } from '@mantine/core';
import { Prism } from '@mantine/prism';
import { useDisclosure } from '@mantine/hooks';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import { IconTerminal, IconSearch, IconInfoCircle } from '@tabler/icons-react'
import LLMResponseInspectorModal from './LLMResponseInspectorModal';

// Ace code editor
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-xcode";
import "ace-builds/src-noconflict/ext-language_tools";
import fetch_from_backend from './fetch_from_backend';
import { APP_IS_RUNNING_LOCALLY } from './backend/utils';
import InspectFooter from './InspectFooter';

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

const EvaluatorNode = ({ data, id }) => {

  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const [status, setStatus] = useState('none');
  const nodes = useStore((state) => state.nodes);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For an info pop-up that explains the type of ResponseInfo
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] = useDisclosure(false);

  // For a way to inspect responses without having to attach a dedicated node
  const inspectModal = useRef(null);
  const [uninspectedResponses, setUninspectedResponses] = useState(false);

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
        setLastResponses(json.responses);
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
    
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map(e => e.source);
    if (input_node_ids.length === 0) {
        console.warn("No inputs for evaluator node.");
        return;
    }

    // Double-check that the code includes an 'evaluate' function:
    const find_evalfunc_regex = progLang === 'python' ? /def\s+evaluate\s*(.*):/ : /function\s+evaluate\s*(.*)/;
    if (codeText.search(find_evalfunc_regex) === -1) {
      const err_msg = `Could not find required function 'evaluate'. Make sure you have defined an 'evaluate' function.`;
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
      responses: input_node_ids,
      scope: 'response',
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

        console.log(json.responses);
        setLastResponses(json.responses);
        setCodeTextOnLastRun(codeTextOnRun);
        setLastRunSuccess(true);

        if (status !== 'ready')
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

  const default_header = (progLang === 'python') ? 
                          'Python Evaluator Node'
                          : 'JavaScript Evaluator Node';
  const node_header = data.title || default_header;

  return (
    <div className="evaluator-node cfnode">
      <NodeLabel title={node_header} 
                  nodeId={id} 
                  onEdit={hideStatusIndicator}
                  icon={<IconTerminal size="16px" />} 
                  status={status}
                  alertModal={alertModal}
                  handleRunClick={handleRunClick}
                  runButtonTooltip="Run evaluator over inputs"
                  customButtons={[
                    <Tooltip label='Info' key="eval-info">
                      <button onClick={openInfoModal} className='custom-button' style={{border:'none'}}>
                        <IconInfoCircle size='12pt' color='gray' style={{marginBottom: '-4px'}} />
                      </button>
                    </Tooltip>]}
                  />
      <LLMResponseInspectorModal ref={inspectModal} jsonResponses={lastResponses} />
      <Modal title={default_header} size='60%' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-5%'}}}>
        <Box m='lg' mt='xl'>
          <Text mb='sm'>To use a {default_header}, write a function <Code>evaluate</Code> that takes a single argument of class <Code>ResponseInfo</Code>.
          The function should return a 'score' for that response, which usually is a number or a boolean value (strings as categoricals are supported, but experimental).</Text>
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
          For more information on what's possible, see the <a href="https://github.com/ianarawjo/ChainForge/blob/main/GUIDE.md#python-evaluator-node" target='_blank'>documentation</a> or load some Example Flows.</Text>
        </Box>
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
        <div className="code-mirror-field-header">Define an <Code>evaluate</Code> func to map over each response:
        {/* &nbsp;<select name="mapscope" id="mapscope" onChange={handleOnMapScopeSelect}>
            <option value="response">response</option>
            <option value="batch">batch of responses</option>
        </select> */}
        </div>
        
        {/* <span className="code-style">response</span>: */}
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
                        showNotificationDot={uninspectedResponses} />
        ) : <></>}  
    </div>
  );
};

export default EvaluatorNode;