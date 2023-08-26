import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from 'react-flow-renderer';
import { escapeBraces } from './backend/template';
import { filterDict } from './backend/utils';
import { APP_IS_RUNNING_LOCALLY } from './backend/utils';

// Initial project settings
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

const refreshableOutputNodeTypes = new Set(['evaluator', 'prompt', 'inspect', 'vis', 'llmeval', 'textfields', 'chat', 'simpleval']);

export let initLLMProviders = [
  { name: "GPT3.5", emoji: "🤖", model: "gpt-3.5-turbo", base_model: "gpt-3.5-turbo", temp: 1.0 },  // The base_model designates what settings form will be used, and must be unique.
  { name: "GPT4", emoji: "🥵", model: "gpt-4", base_model: "gpt-4", temp: 1.0 },
  { name: "Claude", emoji: "📚", model: "claude-2", base_model: "claude-v1", temp: 0.5 },
  { name: "PaLM2", emoji: "🦬", model: "chat-bison-001", base_model: "palm2-bison", temp: 0.7 },
  { name: "Azure OpenAI", emoji: "🔷", model: "azure-openai", base_model: "azure-openai", temp: 1.0 },
  { name: "HuggingFace", emoji: "🤗", model: "tiiuae/falcon-7b-instruct", base_model: "hf", temp: 1.0 },
];
if (APP_IS_RUNNING_LOCALLY()) {
  initLLMProviders.push({ name: "Dalai (Alpaca.7B)", emoji: "🦙", model: "alpaca.7B", base_model: "dalai", temp: 0.5 });
}

// A global store of variables, used for maintaining state
// across ChainForge and ReactFlow components.
const useStore = create((set, get) => ({
  nodes: [],
  edges: [],

  // Available LLMs in ChainForge, in the format expected by LLMListItems.
  AvailableLLMs: [...initLLMProviders],
  setAvailableLLMs: (llmProviderList) => {
    set({AvailableLLMs: llmProviderList});
  },

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
  pingOutputNodes: (sourceNodeId) => {
    const out_nodes = get().outputEdgesForNode(sourceNodeId).map(e => e.target);
    out_nodes.forEach(n => {
        const node = get().getNode(n);
        if (node && refreshableOutputNodeTypes.has(node.type)) {
            get().setDataPropsForNode(node.id, { refresh: true });
        }
    });
  },
  output: (sourceNodeId, sourceHandleKey) => {
    // Get the source node
    const src_node = get().getNode(sourceNodeId);
    if (src_node) {

      // If the source node has tabular data, use that:
      if (src_node.type === 'table') {
        if ("rows" in src_node.data && "columns" in src_node.data) {
          const rows = src_node.data.rows;
          const columns = src_node.data.columns;

          // The sourceHandleKey is the key of the column in the table that we're interested in:
          const src_col = columns.find(c => c.header === sourceHandleKey);
          if (src_col !== undefined) {

            // Construct a lookup table from column key to header name, 
            // as the 'metavars' dict should be keyed by column *header*, not internal key:
            let col_header_lookup = {};
            columns.forEach(c => {
              col_header_lookup[c.key] = c.header;
            });

            // Extract all the data for every row of the source column, appending the other values as 'meta-vars':
            return rows.map(row => {
              const row_keys = Object.keys(row);

              // Check if this is an 'empty' row (with all empty strings); if so, skip it:
              if (row_keys.every(key => key === '__uid' || !row[key] || row[key].trim() === ""))
                return undefined;

              const row_excluding_col = {};
              row_keys.forEach(key => {
                if (key !== src_col.key && key !== '__uid')
                  row_excluding_col[col_header_lookup[key]] = row[key];
              });
              return {
                // We escape any braces in the source text before they're passed downstream.
                // This is a special property of tabular data nodes: we don't want their text to be treated as prompt templates.
                text: escapeBraces((src_col.key in row) ? row[src_col.key] : ""),
                metavars: row_excluding_col,
                associate_id: row.__uid, // this is used by the backend to 'carry' certain values together
              }
            }).filter(r => r !== undefined);
          } else {
            console.error(`Could not find table column with source handle name ${sourceHandleKey}`);
            return null;
          }
        }
      } else {
        // Get the data related to that handle:
        if ("fields" in src_node.data) {
          if (Array.isArray(src_node.data["fields"]))
            return src_node.data["fields"];
          else {
            // We have to filter over a special 'fields_visibility' prop, which 
            // can select what fields get output:
            if ("fields_visibility" in src_node.data)
              return Object.values(filterDict(src_node.data["fields"], 
                                              fid => src_node.data["fields_visibility"][fid] !== false));
            else  // return all field values
              return Object.values(src_node.data["fields"]);
          }
        }
        // NOTE: This assumes it's on the 'data' prop, with the same id as the handle:
        else return src_node.data[sourceHandleKey];
      }
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
    
    if (target.type === 'vis' || target.type === 'inspect' || target.type === 'simpleval') {
      get().setDataPropsForNode(target.id, { input: connection.source });
    }

    // Ping target node to fresh if necessary
    if (target && refreshableOutputNodeTypes.has(target.type)) {
      get().setDataPropsForNode(target.id, { refresh: true });
    }

    connection.interactionWidth = 100;
    connection.markerEnd = {type: 'arrow', width: '22px', height: '22px'};

    set({
      edges: addEdge(connection, get().edges) // get().edges.concat(connection)
    });
  },
}));

export default useStore;
