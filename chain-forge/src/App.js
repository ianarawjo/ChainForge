// import logo from './logo.svg';
// import './App.css';

import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useReactFlow,
  useViewport
} from 'react-flow-renderer';
// import axios from 'axios';
import TextFieldsNode from './TextFieldsNode'; // Import a custom node
import PromptNode from './PromptNode';
import EvaluatorNode from './EvaluatorNode';
import VisNode from './VisNode';
import InspectNode from './InspectorNode';
import ScriptNode from './ScriptNode';
import './text-fields-node.css';

// State management (from https://reactflow.dev/docs/guides/state-management/)
import { shallow } from 'zustand/shallow';
import useStore from './store';

const selector = (state) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addNode: state.addNode,
  setNodes: state.setNodes,
  setEdges: state.setEdges,
});

// import AnimatedConnectionLine from './AnimatedConnectionLine';

const nodeTypes = {
  textfields: TextFieldsNode, // Register the custom node
  prompt: PromptNode,
  evaluator: EvaluatorNode,
  vis: VisNode,
  inspect: InspectNode,
  script: ScriptNode
};

const connectionLineStyle = { stroke: '#ddd' };
const snapGrid = [16, 16];

const App = () => {

  // Get nodes, edges, etc. state from the Zustand store:
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setNodes, setEdges } = useStore(selector, shallow);

  // For saving / loading
  const [rfInstance, setRfInstance] = useState(null);

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
    const flow = rfInstance.toObject();
    downloadJSON(flow, `flow-${Date.now()}.json`);
  }, [rfInstance]);
  const importFlow = async (event) => {

    // Create an input element with type "file" and accept only JSON files
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    // Handle file selection
    input.addEventListener("change", function(event) {

      const file = event.target.files[0];
      const reader = new FileReader();

      // Handle file load event
      reader.addEventListener("load", function() {
        try {
          loadFlow(JSON.parse(reader.result));
        } catch (error) {
          console.error("Error parsing JSON file:", error);
        }
      });

      // Read the selected file as text
      reader.readAsText(file);
    });

    // Trigger the file selector
    input.click();
  };

  return (
    <div>
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
        <button onClick={addTextFieldsNode}>Add text fields node</button>
        <button onClick={addPromptNode}>Add prompt node</button>
        <button onClick={addEvalNode}>Add evaluator node</button>
        <button onClick={addVisNode}>Add vis node</button>
        <button onClick={addInspectNode}>Add inspect node</button>
        <button onClick={addScriptNode}>Add script node</button>
        <button onClick={saveFlow} style={{marginLeft: '12px'}}>Save</button>
        <button onClick={loadFlowFromCache}>Load</button>
        <button onClick={exportFlow} style={{marginLeft: '12px'}}>Export</button>
        <button onClick={importFlow}>Import</button>
      </div>
    </div>
  );
};

export default App;
