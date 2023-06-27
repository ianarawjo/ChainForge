// import logo from './logo.svg';
// import './App.css';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useReactFlow,
  useViewport,
  setViewport,
} from 'react-flow-renderer';
import { Button, Menu, LoadingOverlay } from '@mantine/core';
import { IconSettings, IconTextPlus, IconTerminal, IconCsv, IconSettingsAutomation } from '@tabler/icons-react';
import TextFieldsNode from './TextFieldsNode'; // Import a custom node
import PromptNode from './PromptNode';
import EvaluatorNode from './EvaluatorNode';
import VisNode from './VisNode';
import InspectNode from './InspectorNode';
import ScriptNode from './ScriptNode';
import AlertModal from './AlertModal';
import CsvNode from './CsvNode';
import TabularDataNode from './TabularDataNode';
import GlobalSettingsModal from './GlobalSettingsModal';
import ExampleFlowsModal from './ExampleFlowsModal';
import AreYouSureModal from './AreYouSureModal';
import './text-fields-node.css';

// State management (from https://reactflow.dev/docs/guides/state-management/)
import { shallow } from 'zustand/shallow';
import useStore from './store';
import fetch_from_backend from './fetch_from_backend';

const selector = (state) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addNode: state.addNode,
  setNodes: state.setNodes,
  setEdges: state.setEdges,
  resetLLMColors: state.resetLLMColors,
});

// import AnimatedConnectionLine from './AnimatedConnectionLine';

const nodeTypes = {
  textfields: TextFieldsNode, // Register the custom node
  prompt: PromptNode,
  evaluator: EvaluatorNode,
  vis: VisNode,
  inspect: InspectNode,
  script: ScriptNode,
  csv: CsvNode,
  table: TabularDataNode,
};

// const connectionLineStyle = { stroke: '#ddd' };
const snapGrid = [16, 16];
let saveIntervalInitialized = false;

const App = () => {

  // Get nodes, edges, etc. state from the Zustand store:
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setNodes, setEdges, resetLLMColors } = useStore(selector, shallow);

  // For saving / loading
  const [rfInstance, setRfInstance] = useState(null);
  const [autosavingInterval, setAutosavingInterval] = useState(null);

  // For modal popup to set global settings like API keys
  const settingsModal = useRef(null);

  // For modal popup of example flows
  const examplesModal = useRef(null);

  // For confirmation popup
  const confirmationModal = useRef(null);
  const [confirmationDialogProps, setConfirmationDialogProps] = useState({
    title: 'Confirm action', message: 'Are you sure?', onConfirm: () => {}
  });

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For displaying a pending 'loading' status
  const [isLoading, setIsLoading] = useState(true);

  // Helper 
  const getWindowSize = () => ({width: window.innerWidth, height: window.innerHeight});
  const getWindowCenter = () => {
    const { width, height } = getWindowSize();
    return ({centerX: width/2.0, centerY: height/2.0});
  }
  const getViewportCenter = () => {
    const { centerX, centerY } = getWindowCenter();
    const { x, y } = rfInstance.getViewport();
    return ({x: -x+centerX, y:-y+centerY});
  }

  const addTextFieldsNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'textFieldsNode-'+Date.now(), type: 'textfields', data: {}, position: {x: x-200, y:y-100} });
  };
  const addPromptNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'promptNode-'+Date.now(), type: 'prompt', data: { prompt: '' }, position: {x: x-200, y:y-100} });
  };
  const addEvalNode = (progLang) => {
    const { x, y } = getViewportCenter();
    let code = "";
    if (progLang === 'python') 
      code = "def evaluate(response):\n  return len(response.text)";
    else if (progLang === 'javascript')
      code = "function evaluate(resp) {\n  return resp.text.length;\n}";
    addNode({ id: 'evalNode-'+Date.now(), type: 'evaluator', data: { language: progLang, code: code }, position: {x: x-200, y:y-100} });
  };
  const addVisNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'visNode-'+Date.now(), type: 'vis', data: {}, position: {x: x-200, y:y-100} });
  };
  const addInspectNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'inspectNode-'+Date.now(), type: 'inspect', data: {}, position: {x: x-200, y:y-100} });
  };
  const addScriptNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'scriptNode-'+Date.now(), type: 'script', data: {}, position: {x: x-200, y:y-100} });
  };
  const addCsvNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'csvNode-'+Date.now(), type: 'csv', data: {}, position: {x: x-200, y:y-100} });
  };
  const addTabularDataNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'table-'+Date.now(), type: 'table', data: {}, position: {x: x-200, y:y-100} });
  };

  const onClickExamples = () => {
    if (examplesModal && examplesModal.current)
      examplesModal.current.trigger();
  };
  const onClickSettings = () => {
    if (settingsModal && settingsModal.current) 
      settingsModal.current.trigger();
  };

  const handleError = (err) => {
    setIsLoading(false);
    if (alertModal.current)
      alertModal.current.trigger(err.message);
    console.error(err.message);
  };

  /** 
   * SAVING / LOADING, IMPORT / EXPORT (from JSON)
  */
  const downloadJSON = (jsonData, filename) => {
    // Convert JSON object to JSON string
    const jsonString = JSON.stringify(jsonData, null, 2);
  
    // Create a Blob object from the JSON string
    const blob = new Blob([jsonString], { type: "application/json" });
  
    // Create a temporary download link
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = filename;
  
    // Add the link to the DOM (it's not visible)
    document.body.appendChild(downloadLink);
  
    // Trigger the download by programmatically clicking the temporary link
    downloadLink.click();
  
    // Remove the temporary link from the DOM and revoke the URL
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);
  };

  // Save the current flow to localStorage for later recall. Useful to getting
  // back progress upon leaving the site / browser crash / system restart.
  const saveFlow = useCallback((rf_inst) => {
    const rf = rf_inst || rfInstance;
    if (!rf) return;
    // NOTE: This currently only saves the front-end state. Cache files
    // are not pulled or overwritten upon loading from localStorage. 
    const flow = rf.toObject();
    localStorage.setItem('chainforge-flow', JSON.stringify(flow));
    console.log('Flow saved!');
  }, [rfInstance]);

  // Triggered when user confirms 'New Flow' button
  const resetFlow = useCallback(() => {
    resetLLMColors();

    const uid = (id) => `${id}-${Date.now()}`;
    const starting_nodes = [
      { id: uid('prompt'), type: 'prompt', data: { prompt: 'Why is the sky blue?', n: 1 }, position: { x: 450, y: 200 } },
      { id: uid('textfields'), type: 'textfields', data: {}, position: { x: 80, y: 270 } },
    ];

    setNodes(starting_nodes);
    setEdges([]);
    if (rfInstance)
      rfInstance.setViewport({x: 200, y: 80, zoom: 1});
  }, [setNodes, setEdges, resetLLMColors, rfInstance]);

  const loadFlow = async (flow, rf_inst) => {
    if (flow) {
      if (rf_inst) {
        if (flow.viewport)
          rf_inst.setViewport({x: flow.viewport.x || 0, y: flow.viewport.y || 0, zoom: 1});
        else
          rf_inst.setViewport({x:0, y:0, zoom:1});
      }
      resetLLMColors();
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []); 

      // Save flow that user loaded to autosave cache, in case they refresh the browser
      localStorage.setItem('chainforge-flow', JSON.stringify(flow));
    }
  };
  const autosavedFlowExists = () => {
    return localStorage.getItem('chainforge-flow') !== null;
  };
  const loadFlowFromAutosave = async (rf_inst) => {
    const saved_flow = localStorage.getItem('chainforge-flow');
    if (saved_flow)
      loadFlow(JSON.parse(saved_flow), rf_inst);
  };

  // Export / Import (from JSON)
  const exportFlow = useCallback(() => {
    if (!rfInstance) return;

    // We first get the data of the flow
    const flow = rfInstance.toObject();

    // Then we grab all the relevant cache files from the backend
    const all_node_ids = nodes.map(n => n.id);
    fetch_from_backend('exportCache', {
      'ids': all_node_ids,
    }).then(function(json) {
        if (!json || !json.files)
          throw new Error('Request was sent and received by backend server, but there was no response.');
        
        // Now we append the cache file data to the flow
        const flow_and_cache = {
          flow: flow, 
          cache: json.files,
        };

        // Save!
        downloadJSON(flow_and_cache, `flow-${Date.now()}.cforge`);
    });
  }, [rfInstance, nodes]);

  // Import data to the cache stored on the local filesystem (in backend)
  const importCache = (cache_data) => {
    return fetch_from_backend('importCache', {
      'files': cache_data,
    }, handleError).then(function(json) {
        if (!json || json.result === undefined)
          throw new Error('Request to import cache data was sent and received by backend server, but there was no response.');
        else if (json.error || json.result === false)
          throw new Error('Error importing cache data:' + json.error);
        // Done! 
    }, handleError).catch(handleError);
  };

  const importFlowFromJSON = useCallback((flowJSON) => {
    // Detect if there's no cache data
    if (!flowJSON.cache) {
      // Support for loading old flows w/o cache data:
      loadFlow(flowJSON, rfInstance);
      return;
    }

    // Then we need to extract the JSON of the flow vs the cache data
    const flow = flowJSON.flow;
    const cache = flowJSON.cache;

    // We need to send the cache data to the backend first,
    // before we can load the flow itself...
    importCache(cache).then(() => {
      // We load the ReactFlow instance last
      loadFlow(flow, rfInstance);
    }).catch(err => {
      // On an error, still try to load the flow itself:
      handleError("Error encountered when importing cache data:" + err.message + "\n\nTrying to load flow regardless...");
      loadFlow(flow, rfInstance);
    });
  }, [rfInstance]);

  // Import a ChainForge flow from a file
  const importFlowFromFile = async () => {
    // Create an input element with type "file" and accept only JSON files
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cforge, .json";

    // Handle file selection
    input.addEventListener("change", function(event) {

      const file = event.target.files[0];
      const reader = new FileReader();

      // Handle file load event
      reader.addEventListener("load", function() {
        try {
          // We try to parse the JSON response
          const flow_and_cache = JSON.parse(reader.result);

          // Import it to React Flow and import cache data on the backend
          importFlowFromJSON(flow_and_cache);

        } catch (error) {
          handleError(error);
        }
      });

      // Read the selected file as text
      reader.readAsText(file);
    });

    // Trigger the file selector
    input.click();
  };

  // Downloads the selected OpenAI eval file (preconverted to a .cforge flow)
  const importFlowFromOpenAIEval = (evalname) => {
    fetch_from_backend('fetchOpenAIEval', {
      name: evalname,
    }, handleError).then(function(json) {
      // Close the loading modal
      setIsLoading(false);

      // Detect any issues with the response
      if (!json) {
        handleError('Request was sent and received by backend server, but there was no response.');
        return undefined;
      } else if (json.error || !json.data) {
        handleError(json.error || 'Unknown error when fetching file for OpenAI eval from backend server.');
        return undefined;
      }

      // Import the JSON to React Flow and import cache data on the backend
      importFlowFromJSON(json.data);
    }).catch(handleError);
  };

  // Load flow from examples modal
  const onSelectExampleFlow = (name, example_category) => {
    // Trigger the 'loading' modal
    setIsLoading(true);

    // Detect a special category of the example flow, and use the right loader for it:
    if (example_category === 'openai-eval') {
      importFlowFromOpenAIEval(name);
      return;
    }
    
    // Fetch the example flow data from the backend
    fetch_from_backend('fetchExampleFlow', {
      'name': name,
    }, handleError).then(function(json) {
        // Close the loading modal
        setIsLoading(false);

        if (!json)
          throw new Error('Request to fetch example flow was sent to backend server, but there was no response.');
        else if (json.error || !json.data)
          throw new Error('Error importing example flow:' + json.error);
        
        // We have the data, import it:
        importFlowFromJSON(json.data);

    }, handleError).catch(handleError);
  };

  // When the user clicks the 'New Flow' button
  const onClickNewFlow = useCallback(() => {
    setConfirmationDialogProps({
      title: 'Create a new flow',
      message: 'Are you sure? Any unexported changes to your existing flow will be lost.',
      onConfirm: () => resetFlow(), // Set the callback if user confirms action
    });

    // Trigger the 'are you sure' modal:
    if (confirmationModal && confirmationModal.current)
      confirmationModal.current.trigger();
  }, [confirmationModal, resetFlow, setConfirmationDialogProps]);

  // Run once upon ReactFlow initialization
  const onInit = (rf_inst) => {
    setRfInstance(rf_inst);

    // Autosave the flow to localStorage every minute:
    console.log('set autosaving interval');
    const interv = setInterval(() => saveFlow(rf_inst), 60000); // 60000 milliseconds = 1 minute
    setAutosavingInterval(interv);

    // Attempt to load an autosaved flow, if one exists:
    if (autosavedFlowExists())
      loadFlowFromAutosave(rf_inst);
    else {
      // Create a default starting flow for new users
      // NOTE: We need to create a unique ID using the current date,
      //       because of the way ReactFlow saves and restores states. 
      const uid = (id) => `${id}-${Date.now()}`;
      setNodes([
        { id: uid('prompt'), type: 'prompt', data: { prompt: 'What is the opening sentence of Pride and Prejudice?', n: 1 }, position: { x: 450, y: 200 } },
        { id: uid('eval'), type: 'evaluator', data: { code: "def evaluate(response):\n  return len(response.text)" }, position: { x: 820, y: 150 } },
        { id: uid('textfields'), type: 'textfields', data: {}, position: { x: 80, y: 270 } },
        { id: uid('vis'), type: 'vis', data: {}, position: { x: 1200, y: 250 } },
        { id: uid('inspect'), type: 'inspect', data: {}, position: { x:820, y:400 } },
      ]);
    }

    // Turn off loading wheel
    setIsLoading(false);
  };

  useEffect(() => {
    // Cleanup the autosaving interval upon component unmount:
    return () => {
      clearInterval(autosavingInterval); // Clear the interval when the component is unmounted
    };
  }, []);

  return (
    <div>
      <GlobalSettingsModal ref={settingsModal} />
      <AlertModal ref={alertModal} />
      <LoadingOverlay visible={isLoading} overlayBlur={1} />
      <ExampleFlowsModal ref={examplesModal} onSelect={onSelectExampleFlow} />
      <AreYouSureModal ref={confirmationModal} title={confirmationDialogProps.title} message={confirmationDialogProps.message} onConfirm={confirmationDialogProps.onConfirm} />
      <div style={{ height: '100vh', width: '100%', backgroundColor: '#eee' }}>
        <ReactFlow
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          zoomOnPinch={false}
          zoomOnScroll={false}
          panOnScroll={true}
          // connectionLineComponent={AnimatedConnectionLine}
          // connectionLineStyle={connectionLineStyle}
          snapToGrid={true}
          snapGrid={snapGrid}
          onInit={onInit}
        >
          <Background color="#999" gap={16} />
          <Controls showZoom={true} />
        </ReactFlow>
      </div>
      <div id="custom-controls" style={{position: 'fixed', left: '10px', top: '10px', zIndex:8}}>
        <Menu transitionProps={{ transition: 'pop-top-left' }}
                          position="top-start"
                          width={220}
                          closeOnClickOutside={true}
                      >
          <Menu.Target>
              <Button size="sm" variant="gradient" compact mr='sm'>Add Node +</Button>
          </Menu.Target>
          <Menu.Dropdown>
              <Menu.Item onClick={addTextFieldsNode} icon={<IconTextPlus size="16px" />}> TextFields </Menu.Item>
              <Menu.Item onClick={addPromptNode} icon={'💬'}> Prompt Node </Menu.Item>
              <Menu.Item onClick={() => addEvalNode('javascript')} icon={<IconTerminal size="16px" />}> JavaScript Evaluator Node </Menu.Item>
              <Menu.Item onClick={() => addEvalNode('python')} icon={<IconTerminal size="16px" />}> Python Evaluator Node </Menu.Item>
              <Menu.Item onClick={addVisNode} icon={'📊'}> Vis Node </Menu.Item>
              <Menu.Item onClick={addInspectNode} icon={'🔍'}> Inspect Node </Menu.Item>
              <Menu.Item onClick={addCsvNode} icon={<IconCsv size="16px" />}> CSV Node </Menu.Item>
              <Menu.Item onClick={addTabularDataNode} icon={'🗂️'}> Tabular Data Node </Menu.Item>
              <Menu.Item onClick={addScriptNode} icon={<IconSettingsAutomation size="16px" />}> Global Scripts </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Button onClick={exportFlow} size="sm" variant="outline" compact mr='xs'>Export</Button>
        <Button onClick={importFlowFromFile} size="sm" variant="outline" compact>Import</Button>
      </div>
      <div style={{position: 'fixed', right: '10px', top: '10px', zIndex: 8}}>
        <Button onClick={onClickNewFlow} size="sm" variant="outline" compact mr='xs' style={{float: 'left'}}> New Flow </Button>
        <Button onClick={onClickExamples} size="sm" variant="outline" compact mr='xs' style={{float: 'left'}}> Example Flows </Button>
        <Button onClick={onClickSettings} size="sm" variant="outline" compact><IconSettings size={"90%"} /></Button>
      </div>
    </div>
  );
};

export default App;
