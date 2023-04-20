// import logo from './logo.svg';
// import './App.css';

import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
} from 'react-flow-renderer';
// import axios from 'axios';
import TextFieldsNode from './TextFieldsNode'; // Import a custom node
import PromptNode from './PromptNode';
import EvaluatorNode from './EvaluatorNode';
import VisNode from './VisNode';
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
});

// import AnimatedConnectionLine from './AnimatedConnectionLine';

const nodeTypes = {
  textfields: TextFieldsNode, // Register the custom node
  prompt: PromptNode,
  evaluator: EvaluatorNode,
  vis: VisNode,
};

const connectionLineStyle = { stroke: '#ddd' };
const snapGrid = [16, 16];

const App = () => {

  // Get nodes, edges, etc. state from the Zustand store:
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore(selector, shallow);
  // const [nodes, setNodes] = useState(initialNodes);
  // const [edges, setEdges] = useState(initialEdges);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <ReactFlow
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        // connectionLineComponent={AnimatedConnectionLine}
        // connectionLineStyle={connectionLineStyle}
        snapToGrid={true}
        snapGrid={snapGrid}
      >
        <Background color="#aaa" gap={16} />
        <Controls />
      </ReactFlow>
      <button onClick={analyzeResponse} disabled={isAnalyzing}>
        {isAnalyzing ? 'Analyzing...' : 'Analyze Response'}
      </button>
    </div>
  );
};

export default App;
