import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useViewport,
} from 'react-flow-renderer';

// Where the ChainForge Flask server is being hosted. 
export const BASE_URL = 'http://localhost:8000/';

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
  { id: uid('table'), type: 'table', data: {}, position: { x: 35, y: 250 } },
  { id: uid('vis'), type: 'vis', data: {}, position: { x: 1350, y: 250 } },
  { id: uid('inspect'), type: 'inspect', data: {}, position: { x:900, y:600 } },
];
const initialEdges = [];
const initialAPIKeys = {};
const initialLLMColors = {};

/** The color palette used for displaying info about different LLMs. */
const llmColorPalette = ['#44d044', '#f1b933', '#e46161', '#8888f9', '#33bef0', '#bb55f9', '#f7ee45', '#f955cd', '#26e080', '#2654e0', '#7d8191', '#bea5d1'];

/** The color palette used for displaying variations of prompts and prompt variables (non-LLM differences). 
 * Distinct from the LLM color palette in order to avoid confusion around what the data means.
 * Palette adapted from https://lospec.com/palette-list/sness by Space Sandwich */
const varColorPalette = ['#0bdb52', '#e71861', '#7161de', '#f6d714', '#80bedb', '#ffa995', '#a9b399', '#dc6f0f', '#8d022e', '#138e7d', '#c6924f', '#885818', '#616b6d'];

/** All color palettes in ChainForge. Import to use elsewhere. */
export const colorPalettes = {
  llm: llmColorPalette,
  var: varColorPalette,
}

// A global store of variables, used for maintaining state
// across ChainForge and ReactFlow components.
const useStore = create((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,

  // Keeping track of LLM API keys
  apiKeys: initialAPIKeys,
  setAPIKeys: (apiKeys) => {
    set({apiKeys: apiKeys});
  },

  // Keep track of LLM colors, to ensure color consistency across various plots and displays
  llmColors: initialLLMColors,

  // Gets the color for the model named 'llm_name' in llmColors; returns undefined if not found.
  getColorForLLM: (llm_name) => {  
    const colors = get().llmColors;
    if (llm_name in colors)
      return colors[llm_name];
    return undefined;
  },

  // Gets the color for the specified LLM. If not found, generates a new (ideally unique) color
  // and saves it to the llmColors dict. 
  getColorForLLMAndSetIfNotFound: (llm_name) => {
    let color = get().getColorForLLM(llm_name);
    if (color) return color;
    color = get().genUniqueLLMColor();
    get().setColorForLLM(llm_name, color);
    return color;
  },

  // Generates a unique color not yet used in llmColors (unless # colors is large)
  genUniqueLLMColor: () => {  
    const used_colors = new Set(Object.values(get().llmColors));
    const get_unused_color = (all_colors) => {
      for (let i = 0; i < all_colors.length; i++) {
        const color = all_colors[i];
        if (!used_colors.has(color))
          return color;
      }
      return undefined;
    };
    
    let unique_color = get_unused_color(llmColorPalette);
    if (unique_color) return unique_color;

    // If we've reached here, we've exhausted all colors in the LLM palette. As a backup,
    // we'll use the color palette for vars, and try that:
    unique_color = get_unused_color(varColorPalette);
    if (unique_color) return unique_color;

    // If we've reached here, we've run out of all predefined colors. 
    // Choose one to repeat, at random:
    const all_colors = llmColorPalette.concat(varColorPalette);
    return all_colors[Math.floor(Math.random() * all_colors.length)];
  },

  // Saves the color for the specified LLM
  setColorForLLM: (llm_name, color) => {
    get().llmColors[llm_name] = color;
  },

  // Resets (removes) all LLM colors
  resetLLMColors: () => {
    set({
      llmColors: []
    });
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
