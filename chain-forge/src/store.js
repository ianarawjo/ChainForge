import { create } from 'zustand';
import {
  // Connection,
  // Edge,
  // EdgeChange,
  // Node,
  // NodeChange,
  addEdge,
  // OnNodesChange,
  // OnEdgesChange,
  // OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from 'react-flow-renderer';

const initialNodes = [
  { id: 'promptNode', type: 'prompt', data: { prompt: 'Shorten the following paragraph {mod}:\n{paragraph}' }, position: { x: 250, y: 25 } },
  { id: 'analysisNode', type: 'evaluator', data: { code: "return response.txt.length;" }, position: { x: 150, y: 100 } },
  { id: 'textFieldsNode', type: 'textfields', data: { n: '10', paragraph: 'This is text' }, position: { x: 25, y: 25 } },
];

const initialEdges = [
  { id: 'e1-2', source: 'promptNode', target: 'analysisNode', interactionWidth: 100},
];

// TypeScript only
// type RFState = {
//   nodes: Node[];
//   edges: Edge[];
//   onNodesChange: OnNodesChange;
//   onEdgesChange: OnEdgesChange;
//   onConnect: OnConnect;
// };

// this is our useStore hook that we can use in our components to get parts of the store and call actions
const useStore = create((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
}));

export default useStore;