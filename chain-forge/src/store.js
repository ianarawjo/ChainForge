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
  { id: 'promptNode', type: 'prompt', data: { prompt: 'Shorten the following paragraph {mod}:\n{paragraph}' }, position: { x: 430, y: 250 } },
  { id: 'analysisNode', type: 'evaluator', data: { code: "return len(response)" }, position: { x: 850, y: 150 } },
  { id: 'textFieldsNode', type: 'textfields', data: {}, position: { x: 25, y: 150 } },
  { id: 'textFieldsNode2', type: 'textfields', data: {}, position: { x: 25, y: 300 } },
  { id: 'visNode', type: 'vis', data: {}, position: { x: 1350, y: 250 } },
  { id: 'inspectNode', type: 'inspect', data: {}, position: { x:0, y:0 } },
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
  inputEdgesForNode: (sourceNodeId) => {
    return get().edges.filter(e => e.target == sourceNodeId);
  },
  output: (sourceNodeId, sourceHandleKey) => {
    // Get the source node
    const src_node = get().getNode(sourceNodeId);
    if (src_node) {
        // Get the data related to that handle:
        if ("fields" in src_node.data) {
          return Object.values(src_node.data["fields"]);
        }
        // NOTE: This assumes it's on the 'data' prop, with the same id as the handle:
        else return src_node.data[sourceHandleKey];
    } else {
        console.error("Could not find node with id", sourceNodeId);
        return null;
    }
  },
  getNode: (id) => get().nodes.find(n => n.id == id),
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
    
    if (connection.target === 'visNode' || connection.target === 'inspectNode') {
      set({
        nodes: (nds => 
          nds.map(n => {
            if (n.id === connection.target) {
              n.data = { input: connection.source };
            }
            return n;
          })
        )(get().nodes)
      });
        // (node) => {
        // if (node.id == connection.target) {
        //   node.data['input'] = connection.source;
        // }
        // return node;
    }

    set({
      edges: addEdge(connection, get().edges),
    });
  },
}));

export default useStore;