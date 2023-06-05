// import logo from './logo.svg';
// import './App.css';

import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useReactFlow,
  useViewport
} from 'react-flow-renderer';
import { Button, Menu } from '@mantine/core';
import { IconSettings, IconTextPlus, IconTerminal, IconCsv, IconSettingsAutomation } from '@tabler/icons-react';
import TextFieldsNode from './TextFieldsNode'; // Import a custom node
import PromptNode from './PromptNode';
import EvaluatorNode from './EvaluatorNode';
import VisNode from './VisNode';
import InspectNode from './InspectorNode';
import ScriptNode from './ScriptNode';
import AlertModal from './AlertModal';
import CsvNode from './CsvNode';
import GlobalSettingsModal from './GlobalSettingsModal';
import ExampleFlowsModal from './ExampleFlowsModal';
import './text-fields-node.css';

// State management (from https://reactflow.dev/docs/guides/state-management/)
import { shallow } from 'zustand/shallow';
import useStore, { BASE_URL } from './store';

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
};

const connectionLineStyle = { stroke: '#ddd' };
const snapGrid = [16, 16];

const App = () => {

  // Get nodes, edges, etc. state from the Zustand store:
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setNodes, setEdges, resetLLMColors } = useStore(selector, shallow);

  // For saving / loading
  const [rfInstance, setRfInstance] = useState(null);

  // For modal popup to set global settings like API keys
  const settingsModal = useRef(null);

  // For modal popup of example flows
  const examplesModal = useRef(null);

  // For displaying error messages to user
  const alertModal = useRef(null);

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
  const addEvalNode = (event) => {
    const { x, y } = getViewportCenter();
    addNode({ id: 'evalNode-'+Date.now(), type: 'evaluator', data: { code: "def evaluate(response):\n  return len(response.text)" }, position: {x: x-200, y:y-100} });
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

  const onClickExamples = () => {
    if (examplesModal && examplesModal.current)
      examplesModal.current.trigger();
  };
  const onClickSettings = () => {
    if (settingsModal && settingsModal.current) 
      settingsModal.current.trigger();
  };

  const handleError = (err) => {
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

  const saveFlow = useCallback(() => {
    if (!rfInstance) return;
    const flow = rfInstance.toObject();
    localStorage.setItem('chainforge-flow', JSON.stringify(flow));
  }, [rfInstance]);

  const loadFlow = async (flow) => {
    if (flow) {
      const { x = 0, y = 0, zoom = 1 } = flow.viewport;
      // setViewport({ x, y, zoom });
      resetLLMColors();
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []); 
    }
  };
  const loadFlowFromCache = async () => {
    loadFlow(JSON.parse(localStorage.getItem('chainforge-flow')));
  };

  // Export / Import (from JSON)
  const exportFlow = useCallback(() => {
    if (!rfInstance) return;

    // We first get the data of the flow
    const flow = rfInstance.toObject();

    // Then we grab all the relevant cache files from the backend
    const all_node_ids = nodes.map(n => n.id);
    fetch(BASE_URL + 'app/exportCache', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            'ids': all_node_ids,
        }),
    }).then(function(res) {
        return res.json();
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
    

    return fetch(BASE_URL + 'app/importCache', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            'files': cache_data,
        }),
    }, handleError).then(function(res) {
        return res.json();
    }, handleError).then(function(json) {
        if (!json || json.result === undefined)
          throw new Error('Request to import cache data was sent and received by backend server, but there was no response.');
        else if (json.error || json.result === false)
          throw new Error('Error importing cache data:' + json.error);
        // Done! 
    }, handleError).catch(handleError);
  };

  const importFlowFromJSON = (flowJSON) => {
    // Detect if there's no cache data
    if (!flowJSON.cache) {
      // Support for loading old flows w/o cache data:
      loadFlow(flowJSON);
      return;
    }

    // Then we need to extract the JSON of the flow vs the cache data
    const flow = flowJSON.flow;
    const cache = flowJSON.cache;

    // We need to send the cache data to the backend first,
    // before we can load the flow itself...
    importCache(cache).then(() => {
      // We load the ReactFlow instance last
      loadFlow(flow);
    }).catch(err => {
      // On an error, still try to load the flow itself:
      handleError("Error encountered when importing cache data:" + err.message + "\n\nTrying to load flow regardless...");
      loadFlow(flow);
    });
  };

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

  // Load flow from examples modal
  const onSelectExampleFlow = (filename) => {
    // Fetch the example flow data from the backend
    fetch(BASE_URL + 'app/fetchExampleFlow', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            'name': filename,
        }),
    }, handleError).then(function(res) {
        return res.json();
    }, handleError).then(function(json) {
        if (!json)
          throw new Error('Request to fetch example flow was sent to backend server, but there was no response.');
        else if (json.error || !json.data)
          throw new Error('Error importing example flow:' + json.error);
        
        // We have the data, import it:
        importFlowFromJSON(json.data);

    }, handleError).catch(handleError);
  };

  return (
    <div>
      <GlobalSettingsModal ref={settingsModal} />
      <AlertModal ref={alertModal} />
      <ExampleFlowsModal ref={examplesModal} onSelect={onSelectExampleFlow} />
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
          onInit={setRfInstance}
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
              <Menu.Item onClick={addEvalNode} icon={<IconTerminal size="16px" />}> Evaluator Node </Menu.Item>
              <Menu.Item onClick={addVisNode} icon={'📊'}> Vis Node </Menu.Item>
              <Menu.Item onClick={addInspectNode} icon={'🔍'}> Inspect Node </Menu.Item>
              <Menu.Item onClick={addCsvNode} icon={<IconCsv size="16px" />}> CSV Node </Menu.Item>
              <Menu.Item onClick={addScriptNode} icon={<IconSettingsAutomation size="16px" />}> Global Scripts </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Button onClick={exportFlow} size="sm" variant="outline" compact mr='xs'>Export</Button>
        <Button onClick={importFlowFromFile} size="sm" variant="outline" compact>Import</Button>
      </div>
      <div style={{position: 'fixed', right: '10px', top: '10px', zIndex: 8}}>
        <Button onClick={onClickExamples} size="sm" variant="outline" compact mr='xs' style={{float: 'left'}}> Example Flows </Button>
        <Button onClick={onClickSettings} size="sm" variant="outline" compact><IconSettings size={"100%"} /></Button>
      </div>
    </div>
  );
};

export default App;
