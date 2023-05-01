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
};

const connectionLineStyle = { stroke: '#ddd' };
const snapGrid = [16, 16];

const App = () => {

  // Get nodes, edges, etc. state from the Zustand store:
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setNodes, setEdges } = useStore(selector, shallow);

  // const [nodes, setNodes] = useState(initialNodes);
  // const [edges, setEdges] = useState(initialEdges);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // For saving / loading
  const [rfInstance, setRfInstance] = useState(null);

  // const onNodesChange = useCallback(
  //   (changes) => setNodes((ns) => applyNodeChanges(changes, ns)),
  //   []
  // );
  // const onEdgesChange = useCallback(
  //   (changes) => setEdges((es) => applyEdgeChanges(changes, es)),
  //   []
  // );
  // const onConnect = useCallback((connection) => setEdges((eds) => addEdge(connection, eds)));

  const analyzeResponse = async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);

    // Replace with the API endpoint for your LLM
    const API_ENDPOINT = 'https://your-api-endpoint';

    // Obtain the prompt from the promptNode
    const promptNode = nodes.find((el) => el.id === 'promptNode');
    const prompt = promptNode.data.label;

    console.log("Here's where I would request responses from the LLM for prompt:", prompt)

    // try {
    //   const response = await axios.post(API_ENDPOINT, { prompt });
    //   const analysisResult = response.data;

    //   // Update the analysisNode with the result
    //   const newElements = elements.map((el) => {
    //     if (el.id === 'analysisNode') {
    //       return { ...el, data: { ...el.data, label: analysisResult } };
    //     }
    //     return el;
    //   });

    //   setElements(newElements);
    // } catch (error) {
    //   console.error('Error analyzing response:', error);
    // }

    setIsAnalyzing(false);
  };

  const handleDrag = (event) => {
    console.log(event);
  };

  const getWindowSize = () => ({width: window.innerWidth, height: window.innerHeight});
  const getWindowCenter = () => {
    const { width, height } = getWindowSize();
    return ({centerX: width/2.0, centerY: height/2.0});
  }
  const getViewportCenter = () => {
    const { centerX, centerY } = getWindowCenter();
    const { x, y, zoom } = rfInstance.getViewport();
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

  // Saving / loading
  const saveFlow = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      localStorage.setItem('chainforge-flow', JSON.stringify(flow));
    }
  }, [rfInstance]);
  const loadFlow = () => {
    const restoreFlow = async () => {
      const flow = JSON.parse(localStorage.getItem('chainforge-flow'));
      console.log(flow.nodes);

      if (flow) {
        const { x = 0, y = 0, zoom = 1 } = flow.viewport;
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
        // setViewport({ x, y, zoom });
      }
    };

    restoreFlow();
  };

  return (
    <div>
      <div style={{ height: '100vh', width: '100%', backgroundColor: '#eee' }}>
        <ReactFlow
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrag={handleDrag}
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
        <button onClick={saveFlow} style={{marginLeft: '12px'}}>Save</button>
        <button onClick={loadFlow}>Load</button>
      </div>
    </div>
  );
};

export default App;
