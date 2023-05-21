import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useViewport,
} from 'react-flow-renderer';

// We need to create a unique ID using the current date,
// because of the way ReactFlow saves and restores states. 
const uid = (id) => `${id}-${Date.now()}`;

// Initial project settings
const initprompt = uid('prompt');
const initeval = uid('eval');
const initialNodes = [
  { id: initprompt, type: 'prompt', data: { prompt: 'Who invented the lightbulb?', n: 1 }, position: { x: 430, y: 250 } },
  { id: initeval, type: 'evaluator', data: { code: "def evaluate(response):\n  return len(response.text)" }, position: { x: 850, y: 150 } },
  { id: uid('textfields'), type: 'textfields', data: {}, position: { x: 25, y: 150 } },
  { id: uid('vis'), type: 'vis', data: {}, position: { x: 1350, y: 250 } },
  { id: uid('inspect'), type: 'inspect', data: {}, position: { x:900, y:600 } },
];
const initialEdges = [];
const initialAPIKeys = {};

export const BASE_URL = 'http://localhost:8000/';

// this is our useStore hook that we can use in our components to get parts of the store and call actions
const useStore = create((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  apiKeys: initialAPIKeys,
  setAPIKeys: (apiKeys) => {
    set({apiKeys: apiKeys});
  },
  inputEdgesForNode: (sourceNodeId) => {
    return get().edges.filter(e => e.target == sourceNodeId);
  },
  outputEdgesForNode: (sourceNodeId) => {
    return get().edges.filter(e => e.source == sourceNodeId);
  },
  output: (sourceNodeId, sourceHandleKey) => {
    // Get the source node
    const src_node = get().getNode(sourceNodeId);
    if (src_node) {
        // Get the data related to that handle:
        if ("fields" in src_node.data) {
          if (Array.isArray(src_node.data["fields"]))
            return src_node.data["fields"];
          else
            return Object.values(src_node.data["fields"]);
        }
        // NOTE: This assumes it's on the 'data' prop, with the same id as the handle:
        else return src_node.data[sourceHandleKey];
    } else {
        console.error("Could not find node with id", sourceNodeId);
        return null;
    }
  },
  setDataPropsForNode: (id, data_props) => {
    set({
      nodes: (nds => 
        nds.map(n => {
          if (n.id === id) {
            for (const key of Object.keys(data_props))
              n.data[key] = data_props[key];
            n.data = JSON.parse(JSON.stringify(n.data));  // deep copy json
          }
          return n;
        })
      )(get().nodes)
    });
  },
  getNode: (id) => get().nodes.find(n => n.id === id),
  addNode: (newnode) => {
    set({
      nodes: get().nodes.concat(newnode)
    });
  },
  removeNode: (id) => {
    set({
      nodes: get().nodes.filter(n => n.id !== id)
    });
  },
  setNodes: (newnodes) => {
    set({
      nodes: newnodes
    });
  },
  setEdges: (newedges) => {
    set({
      edges: newedges
    });
  },
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
    console.log(connection, get().edges);
    
    // Get the target node information
    const target = get().getNode(connection.target);
    
    if (target.type === 'vis' || target.type === 'inspect') {
      get().setDataPropsForNode(target.id, { input: connection.source });
    }

    connection.interactionWidth = 100;
    connection.markerEnd = {type: 'arrow', width: '22px', height: '22px'};

    set({
      edges: addEdge(connection, get().edges) // get().edges.concat(connection)
    });
  },
}));

export default useStore;
