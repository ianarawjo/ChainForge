import { create } from "zustand";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  MarkerType,
  Connection,
} from "reactflow";
import { v4 as uuid } from "uuid";
import { escapeBraces } from "./backend/template";
import {
  deepcopy,
  transformDict,
  APP_IS_RUNNING_LOCALLY,
  llmResponseDataToString,
} from "./backend/utils";
import { DuplicateVariableNameError } from "./backend/errors";
import {
  Dict,
  LLMGroup,
  LLMSpec,
  PromptVarType,
  TemplateVarInfo,
  TabularDataColType,
  TabularDataRowType,
  JSONCompatible,
  LLMResponse,
} from "./backend/typing";
import { TogetherChatSettings } from "./ModelSettingSchemas";
import { NativeLLM } from "./backend/models";
import { StringLookup } from "./backend/cache";
import { saveGlobalConfig } from "./backend/backend";
const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

export interface SelectionContext {
  fieldId: string;
  start: number;
  end: number;
  anchorX: number;
  anchorY: number;
}

interface SelectionSlice {
  textSelection: SelectionContext | null;
  setTextSelection(sel: SelectionContext | null): void;
}

// Initial project settings
const initialAPIKeys = {};
const initialFlags = { aiSupport: true };
const initialLLMColors = {};

/** The color palette used for displaying info about different LLMs. */
const llmColorPalette = [
  "#44d044",
  "#f1b933",
  "#e46161",
  "#8888f9",
  "#33bef0",
  "#bb55f9",
  "#f7ee45",
  "#f955cd",
  "#26e080",
  "#2654e0",
  "#7d8191",
  "#bea5d1",
];

/** The color palette used for displaying variations of prompts and prompt variables (non-LLM differences).
 * Distinct from the LLM color palette in order to avoid confusion around what the data means.
 * Palette adapted from https://lospec.com/palette-list/sness by Space Sandwich */
const varColorPalette = [
  "#0bdb52",
  "#e71861",
  "#7161de",
  "#f6d714",
  "#80bedb",
  "#ffa995",
  "#a9b399",
  "#dc6f0f",
  "#8d022e",
  "#138e7d",
  "#c6924f",
  "#885818",
  "#616b6d",
];

/** All color palettes in ChainForge. Import to use elsewhere. */
export const colorPalettes = {
  llm: llmColorPalette,
  var: varColorPalette,
};

const refreshableOutputNodeTypes = new Set([
  "evaluator",
  "processor",
  "prompt",
  "inspect",
  "vis",
  "llmeval",
  "textfields",
  "chat",
  "simpleval",
  "join",
  "split",
]);

export const initLLMProviderMenu: (LLMSpec | LLMGroup)[] = [
  {
    group: "OpenAI",
    emoji: "🤖",
    items: [
      {
        name: "GPT-4o-mini",
        emoji: "🔬",
        model: "gpt-4o-mini",
        base_model: "gpt-4",
        temp: 1.0,
      },
      {
        name: "GPT-4.1",
        emoji: "🧑‍💻️",
        model: "gpt-4.1",
        base_model: "gpt-4",
        temp: 1.0,
      },
      {
        name: "GPT Image 1",
        emoji: "🖼",
        model: "gpt-image-1",
        base_model: "gpt-image-1",
        temp: 0.0,
      },
      {
        name: "GPT-4o",
        emoji: "🤖",
        model: "gpt-4o",
        base_model: "gpt-4",
        temp: 1.0,
      },
      {
        name: "o1",
        emoji: "⭕",
        model: "o1",
        base_model: "gpt-4",
        temp: 1.0,
      },
      {
        name: "o3-mini",
        emoji: "⭕",
        model: "o3-mini",
        base_model: "gpt-4",
        temp: 1.0,
      },
      {
        name: "GPT-3.5",
        emoji: "🤖",
        model: "gpt-3.5-turbo",
        base_model: "gpt-3.5-turbo",
        temp: 1.0,
      }, // The base_model designates what settings form will be used, and must be unique.
      {
        name: "Dall-E",
        emoji: "🖼",
        model: "dall-e-2",
        base_model: "dall-e",
        temp: 0.0,
      },
    ],
  },
  {
    group: "Claude",
    emoji: "📚",
    items: [
      {
        name: "Claude 3.7 Sonnet",
        emoji: "📚",
        model: "claude-3-7-sonnet-latest",
        base_model: "claude-v1",
        temp: 0.5,
      },
      {
        name: "Claude 3.5 Haiku",
        emoji: "📗",
        model: "claude-3-5-haiku-latest",
        base_model: "claude-v1",
        temp: 0.5,
      },
      {
        name: "Claude 3 Opus",
        emoji: "📙",
        model: "claude-3-opus-latest",
        base_model: "claude-v1",
        temp: 0.5,
      },
      {
        name: "Claude 2",
        emoji: "📓",
        model: "claude-2",
        base_model: "claude-v1",
        temp: 0.5,
      },
    ],
  },
  {
    group: "Gemini",
    emoji: "♊",
    items: [
      {
        name: "Gemini 2.5 Pro",
        emoji: "♊",
        model: "gemini-2.5-pro",
        base_model: "gemini-2.5",
        temp: 0.7,
      },
      {
        name: "Gemini 2.5 Flash",
        emoji: "⚡️",
        model: "gemini-2.5-flash",
        base_model: "gemini-2.5",
        temp: 0.7,
      },
      {
        name: "Gemini 2.5 Flash Lite",
        emoji: "💨",
        model: "gemini-2.5-flash-lite",
        base_model: "gemini-2.5",
        temp: 0.7,
      },
      {
        name: "Gemini 2.0 Flash",
        emoji: "⚡️",
        model: "gemini-2.0-flash",
        base_model: "gemini-2.5",
        temp: 0.7,
      },
    ],
  },
  {
    group: "DeepSeek",
    emoji: "🐋",
    items: [
      {
        name: "DeepSeek Chat",
        emoji: "🐋",
        model: "deepseek-chat",
        base_model: "deepseek",
        temp: 1.0,
      }, // The base_model designates what settings form will be used, and must be unique.
      {
        name: "DeepSeek Reasoner",
        emoji: "🐳",
        model: "deepseek-reasoner",
        base_model: "deepseek",
        temp: 1.0,
      },
    ],
  },
  {
    group: "HuggingFace",
    emoji: "🤗",
    items: [
      {
        name: "Mistral.7B",
        emoji: "🤗",
        model: "mistralai/Mistral-7B-Instruct-v0.1",
        base_model: "hf",
        temp: 1.0,
      },
      {
        name: "Falcon.7B",
        emoji: "🤗",
        model: "tiiuae/falcon-7b-instruct",
        base_model: "hf",
        temp: 1.0,
      },
    ],
  },
  {
    name: "Aleph Alpha",
    emoji: "💡",
    model: "luminous-base",
    base_model: "luminous-base",
    temp: 0.0,
  },
  {
    name: "Azure OpenAI",
    emoji: "🔷",
    model: "azure-openai",
    base_model: "azure-openai",
    temp: 1.0,
  },
  {
    group: "Bedrock",
    emoji: "🪨",
    items: [
      {
        name: "Anthropic Claude",
        emoji: "👨‍🏫",
        model: NativeLLM.Bedrock_Claude_3_Haiku,
        base_model: "br.anthropic.claude",
        temp: 0.9,
      },
      {
        name: "AI21 Jurassic 2",
        emoji: "🦖",
        model: NativeLLM.Bedrock_Jurassic_Ultra,
        base_model: "br.ai21.j2",
        temp: 0.9,
      },
      {
        name: "Amazon Titan",
        emoji: "🏛️",
        model: NativeLLM.Bedrock_Titan_Large,
        base_model: "br.amazon.titan",
        temp: 0.9,
      },
      {
        name: "Cohere Command Text 14",
        emoji: "📚",
        model: NativeLLM.Bedrock_Command_Text,
        base_model: "br.cohere.command",
        temp: 0.9,
      },
      {
        name: "Mistral Mistral",
        emoji: "💨",
        model: NativeLLM.Bedrock_Mistral_Mistral,
        base_model: "br.mistral.mistral",
        temp: 0.9,
      },
      {
        name: "Mistral Mixtral",
        emoji: "🌪️",
        model: NativeLLM.Bedrock_Mistral_Mixtral,
        base_model: "br.mistral.mixtral",
        temp: 0.9,
      },
      {
        name: "Meta Llama2 Chat",
        emoji: "🦙",
        model: NativeLLM.Bedrock_Meta_LLama2Chat_13b,
        base_model: "br.meta.llama2",
        temp: 0.9,
      },
      {
        name: "Meta Llama3 Instruct",
        emoji: "🦙",
        model: NativeLLM.Bedrock_Meta_LLama3Instruct_8b,
        base_model: "br.meta.llama3",
        temp: 0.9,
      },
    ],
  },
];

const togetherModels = TogetherChatSettings.schema.properties.model
  .enum as string[];
const togetherGroups = () => {
  const groupNames: string[] = [];
  const groups: { [key: string]: LLMGroup } = {};
  togetherModels.forEach((model) => {
    const [groupName, modelName] = model.split("/");
    const spec: LLMSpec = {
      name: modelName,
      emoji: "🤝",
      model: "together/" + model,
      base_model: "together",
      temp: 0.9,
    };
    if (groupName in groups) {
      (groups[groupName].items as LLMSpec[]).push(spec);
    } else {
      groups[groupName] = {
        group: groupName,
        emoji: "🤝",
        items: [spec],
      };
      groupNames.push(groupName);
    }
  });
  return groupNames.map((name) => groups[name]);
};
const togetherLLMProviderMenu: LLMGroup = {
  group: "Together",
  emoji: "🤝",
  items: togetherGroups(),
};
initLLMProviderMenu.push(togetherLLMProviderMenu);

// Setup for when the app is running locally
if (IS_RUNNING_LOCALLY) {
  initLLMProviderMenu.push({
    name: "Ollama",
    emoji: "🦙",
    model: "ollama",
    base_model: "ollama",
    temp: 1.0,
  });
}

function flattenLLMGroup(group: LLMGroup): LLMSpec[] {
  return group.items.flatMap((item) =>
    "group" in item && "items" in item ? flattenLLMGroup(item) : item,
  );
}

function flattenLLMProviders(providers: (LLMSpec | LLMGroup)[]): LLMSpec[] {
  return providers.flatMap((item) =>
    "group" in item && "items" in item ? flattenLLMGroup(item) : item,
  );
}

export const initLLMProviders = flattenLLMProviders(initLLMProviderMenu);

// Favorites saved across sessions (nodes, models, etc)
export interface FavoritesStoreType {
  nodes: { name: string; value: Node; uid: string }[];
  models: { name: string; value: LLMSpec; uid: string }[];
}

export interface StoreHandles {
  // Nodes and edges
  nodes: Node[];
  edges: Edge[];

  // Helper functions for nodes and edges
  getNode: (id: string) => Node | undefined;
  addNode: (newnode: Node) => void;
  addEdge: (edge: Edge | Connection) => void;
  removeNode: (id: string) => void;
  deselectAllNodes: () => void;
  bringNodeToFront: (id: string) => void;
  duplicateNode: (id: string, offset?: { x?: number; y?: number }) => Node;
  setNodes: (newnodes: Node[]) => void;
  setEdges: (newedges: Edge[]) => void;
  removeEdge: (id: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection | Edge) => void;

  nodeContexts: Record<string, string>;
  setNodeContext: (nodeId: string, context: string) => void;
  setNodeTitle: (nodeId: string, newTitle: string) => void;
  deleteNodeByTitle: (title: string) => void;
  // The LLM providers available in the drop-down list
  AvailableLLMs: LLMSpec[];
  setAvailableLLMs: (specs: LLMSpec[]) => void;

  // API keys to LLM providers
  apiKeys: Dict<string>;
  setAPIKeys: (apiKeys: Dict<string>) => void;

  // Provider for genAI features
  aiFeaturesProvider: string;
  setAIFeaturesProvider: (llmProvider: string) => void;

  // Global settings (flags) from the settings menu
  globalSettings: Dict<JSONCompatible>;
  getGlobalSetting: (flag: string) => JSONCompatible;
  setGlobalSetting: (flag: string, val: JSONCompatible) => void;
  setGlobalSettings: (settings: Dict<JSONCompatible>) => void;

  // Favorites
  favorites: FavoritesStoreType;
  setFavorites: (favorites: FavoritesStoreType) => void;
  getFavorites: <K extends keyof FavoritesStoreType>(
    key: K,
  ) => FavoritesStoreType[K];
  refreshFavoriteModelsMenu: () => void;
  saveFavorite: <K extends keyof FavoritesStoreType>(
    key: K,
    name: string,
    value: FavoritesStoreType[K][number]["value"],
  ) => void;
  saveFavoriteNode: (nodeId: string, name: string) => void;
  saveFavoriteModel: (name: string, spec: LLMSpec) => void;
  removeFavorite: <K extends keyof FavoritesStoreType>(
    key: K,
    uid: string,
  ) => void;

  // Flow-specific state
  state: Dict;
  setState: (key: string, val: any) => void;
  importState: (state: Dict) => void;
  exportGradesAndNotes: (
    responses: LLMResponse[],
  ) => { grade: boolean; note?: string; response: string }[];

  // The color to represent a specific LLM, to be globally consistent
  llmColors: Dict<string>;
  getColorForLLM: (llm_name: string) => string | undefined;
  getColorForLLMAndSetIfNotFound: (llm_name: string) => string;
  genUniqueLLMColor: () => string;
  setColorForLLM: (llm_name: string, color: string) => void;
  resetLLMColors: () => void;

  // Getting inputs and outputs of nodes
  inputEdgesForNode: (sourceNodeId: string) => Edge[];
  outputEdgesForNode: (sourceNodeId: string) => Edge[];
  pingOutputNodes: (sourceNodeId: string) => void;
  getImmediateInputNodeTypes: (
    targetHandles: string[],
    node_id: string,
  ) => string[];

  // Set data for a specific node
  setDataPropsForNode: (
    id: string,
    data_props: Dict<string | boolean | number | null | Dict>,
  ) => void;

  // Rasterize data output from nodes ("pull" the data out)
  // NOTE: If targetNodeId and targetHandleKey are provided, the function will
  // delete the edge if the source node does not exist.
  output: (
    sourceNodeId: string,
    sourceHandleKey: string,
    targetNodeId?: string,
    targetHandleKey?: string,
  ) => (string | TemplateVarInfo)[] | null;
  pullInputData: (
    _targetHandles: string[],
    node_id: string,
  ) => Dict<string[] | TemplateVarInfo[]>;
}
type FullStore = StoreHandles & SelectionSlice;
// A global store of variables, used for maintaining state
// across ChainForge and ReactFlow components.
const useStore = create<FullStore>((set, get) => ({
  nodes: [],
  edges: [],
  textSelection: null,
  setTextSelection: (sel) => set({ textSelection: sel }),
  // Available LLMs in ChainForge, in the format expected by LLMListItems.
  AvailableLLMs: [...initLLMProviders],
  setAvailableLLMs: (llmProviderList) => {
    set({ AvailableLLMs: llmProviderList });
  },

  aiFeaturesProvider: "OpenAI",
  setAIFeaturesProvider: (llmProvider) => {
    set({ aiFeaturesProvider: llmProvider });
  },
  nodeContexts: {} as Record<string, string>,
  setNodeContext: (nodeId: string, context: string) => {
    set((state) => ({
      nodeContexts: { ...state.nodeContexts, [nodeId]: context },
    }));
  },
  setNodeTitle: (nodeId: string, newTitle: string) =>
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (node) node.data = { ...node.data, title: newTitle };
      return { nodes: state.nodes.map((n) => (n.id === nodeId ? node! : n)) };
    }),
  deleteNodeByTitle: (title: string) => {
    const st = useStore.getState();
    Object.values(st.nodes).forEach((n: any) => {
      if (n.data?.title === title) st.removeNode?.(n.id);
    });
  },

  // Keeping track of LLM API keys
  apiKeys: initialAPIKeys,
  setAPIKeys: (apiKeys) => {
    // Filter out any empty or incorrectly formatted API key values:
    const new_keys = transformDict(
      apiKeys,
      (key) =>
        (typeof apiKeys[key] === "string" && apiKeys[key].length > 0) ||
        key === "OpenAI_BaseURL",
    );
    // Only update API keys present in the new array; don't delete existing ones:
    set({ apiKeys: { ...get().apiKeys, ...new_keys } });
  },

  // Favorites (nodes, models, etc)
  favorites: {
    nodes: [],
    models: [],
  },
  setFavorites: (favorites: FavoritesStoreType) => {
    if (
      !favorites ||
      typeof favorites !== "object" ||
      Object.keys(favorites).length < 2
    )
      return;
    set({ favorites });
    get().refreshFavoriteModelsMenu();
  },
  getFavorites: <K extends keyof FavoritesStoreType>(key: K) => {
    return get().favorites[key];
  },
  refreshFavoriteModelsMenu: () => {
    const favorites = get().favorites;

    // Refresh the LLM menu to include the new model
    const favoritesMenuIdx = initLLMProviderMenu.findIndex(
      (item: LLMGroup | LLMSpec) =>
        "group" in item && item.group === "Favorites",
    );

    if (favorites.models.length === 0) {
      if (favoritesMenuIdx !== -1)
        // If there are no more favorites, remove the menu
        initLLMProviderMenu.splice(favoritesMenuIdx, 1);
      return;
    }

    // Otherwise, update the menu with the new favorites
    if (favoritesMenuIdx === -1) {
      initLLMProviderMenu.splice(0, 0, {
        group: "Favorites",
        emoji: "♥️",
        items: get().favorites.models.map((model) => model.value),
      });
    } else {
      (initLLMProviderMenu[favoritesMenuIdx] as LLMGroup).items =
        get().favorites.models.map((model) => model.value);
    }
  },
  saveFavorite: <K extends keyof FavoritesStoreType>(
    key: K,
    name: string,
    value: FavoritesStoreType[K][number]["value"],
  ) => {
    const favorites = { ...get().favorites };
    if (favorites[key] === undefined) favorites[key] = [];
    favorites[key].push({
      name,
      value: value as any,
      // The uid for a 'model' should be its uuid, if it's set. Otherwise, give it one:
      uid:
        key === "models" && "key" in value && value.key !== undefined
          ? value.key
          : uuid(),
    }); // add to end of array

    set({ favorites });

    // Push update to backend
    if (IS_RUNNING_LOCALLY)
      saveGlobalConfig("favorites", favorites as Dict<any>);
  },
  saveFavoriteNode: (nodeId: string, name: string) => {
    // Get the data for the node
    const node = get().getNode(nodeId);
    if (!node) return;

    // Store the node in the favorites list
    get().saveFavorite("nodes", name, node);
  },
  saveFavoriteModel: (name: string, spec: LLMSpec) => {
    // Store the model in the favorites list and refresh the menus
    get().saveFavorite("models", name, spec);
    get().refreshFavoriteModelsMenu();
  },
  removeFavorite: <K extends keyof FavoritesStoreType>(key: K, uid: string) => {
    const favorites = { ...get().favorites };
    console.log("Removing favorite", key, uid);
    const idx = favorites[key].findIndex((item) => item.uid === uid);
    if (idx !== -1) {
      favorites[key].splice(idx, 1);
    }
    set({ favorites });

    // Push update to backend
    if (IS_RUNNING_LOCALLY)
      saveGlobalConfig("favorites", favorites as Dict<any>);

    // Refresh models list if model favorite was removed
    if (key === "models") {
      get().refreshFavoriteModelsMenu();
    }
  },

  // Flags to toggle on or off features across the application
  globalSettings: initialFlags,
  getGlobalSetting: (flagName) => {
    return get().globalSettings[flagName] ?? false;
  },
  setGlobalSetting: (flagName, flagValue) => {
    const flags = { ...get().globalSettings };
    flags[flagName] = flagValue;
    set({ globalSettings: flags });
  },
  setGlobalSettings: (settings: Dict<JSONCompatible>) => {
    set({ globalSettings: settings });
  },

  // State shared across the application, for forcing redraws upon change.
  state: {},
  setState: (key, value) => {
    set((st) => ({
      ...st,
      state: {
        ...st.state,
        [key]: value,
      },
    }));
  },
  importState: (state) => {
    set((st) => ({
      ...st,
      state,
    }));
  },
  exportGradesAndNotes: (responses: LLMResponse[]) => {
    const state = get().state;
    const res: { grade: boolean; note?: string; response: string }[] = [];
    responses.forEach((r) => {
      const uid = r.uid;
      if (r.uid === undefined || r.responses?.length === 0) return;
      const gradeKey = `r.${uid}.grade`;
      const noteKey = `r.${uid}.note`;
      const grade = state[gradeKey];
      const note = state[noteKey];
      if (grade === undefined) return;
      res.push({
        grade: grade?.[0],
        note: note?.[0],
        response: llmResponseDataToString(r.responses[0]),
      }); // TODO: support multiple responses when n>1
    });
    return res;
  },

  // Keep track of LLM colors, to ensure color consistency across various plots and displays
  llmColors: initialLLMColors,

  // Gets the color for the model named 'llm_name' in llmColors; returns undefined if not found.
  getColorForLLM: (llm_name) => {
    const colors = get().llmColors;
    if (llm_name in colors) return colors[llm_name];
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
    const get_unused_color = (all_colors: string[]) => {
      for (let i = 0; i < all_colors.length; i++) {
        const color = all_colors[i];
        if (!used_colors.has(color)) return color;
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
      llmColors: {},
    });
  },

  inputEdgesForNode: (sourceNodeId) => {
    return get().edges.filter((e) => e.target === sourceNodeId);
  },
  outputEdgesForNode: (sourceNodeId) => {
    return get().edges.filter((e) => e.source === sourceNodeId);
  },
  pingOutputNodes: (sourceNodeId) => {
    const out_nodes = get()
      .outputEdgesForNode(sourceNodeId)
      .map((e) => e.target);
    out_nodes.forEach((n) => {
      const node = get().getNode(n);
      if (
        node?.type !== undefined &&
        refreshableOutputNodeTypes.has(node.type)
      ) {
        get().setDataPropsForNode(node.id, { refresh: true });
      }
    });
  },
  output: (sourceNodeId, sourceHandleKey, targetNodeId, targetHandleKey) => {
    // Get the source node
    const src_node = get().getNode(sourceNodeId);
    if (!src_node) {
      console.error("Could not find node with id", sourceNodeId);
      if (targetNodeId !== undefined && targetHandleKey !== undefined) {
        // If the source node doesn't exist, delete the edge if it exists
        const edges = get().edges.filter(
          (e) =>
            e.source === sourceNodeId &&
            e.target === targetNodeId &&
            e.targetHandle === targetHandleKey,
        );
        if (edges.length > 0) {
          console.warn("Removing invalid edge...");
          edges.forEach((e) => {
            get().removeEdge(e.id);
          });
        }
      }
      return null;
    }

    // If the source node has tabular data, use that:
    if (src_node.type === "table" || src_node.type === "media") {
      if (
        ("sel_rows" in src_node.data || "rows" in src_node.data) &&
        "columns" in src_node.data
      ) {
        const rows: TabularDataRowType[] =
          src_node.data.sel_rows ?? src_node.data.rows;
        const columns: TabularDataColType[] = src_node.data.columns;

        // The sourceHandleKey is the key of the column in the table that we're interested in:
        const src_col = columns.find((c) => c.header === sourceHandleKey);
        if (src_col !== undefined) {
          // Construct a lookup table from column key to header name,
          // as the 'metavars' dict should be keyed by column *header*, not internal key:
          const col_header_lookup: Dict<string> = {};
          columns.forEach((c) => {
            col_header_lookup[c.key] = c.header;
          });

          // Extract all the data for every row of the source column, appending the other values as 'meta-vars':
          return rows
            .map((row) => {
              const row_keys = Object.keys(row);

              // Check if this is an 'empty' row (with all empty strings); if so, skip it:
              if (
                row_keys.every(
                  (key) =>
                    key === "__uid" ||
                    !row[key] ||
                    ((typeof row[key] === "string" ||
                      typeof row[key] === "number") &&
                      StringLookup.get(row[key])?.trim() === ""),
                )
              )
                return undefined;

              const row_excluding_col: Dict<string> = {};
              row_keys.forEach((key) => {
                if (key !== src_col.key && key !== "__uid")
                  row_excluding_col[col_header_lookup[key]] = (
                    StringLookup.get(row[key]) ?? "(string lookup failed)"
                  ).toString();
              });
              const key_name =
                src_node.type === "media" && sourceHandleKey === "Image"
                  ? "image"
                  : "text";
              return {
                // We escape any braces in the source text before they're passed downstream.
                // This is a special property of tabular data nodes: we don't want their text to be treated as prompt templates.
                [key_name]: escapeBraces(
                  src_col.key in row
                    ? (
                        StringLookup.get(row[src_col.key]) ??
                        "(string lookup failed)"
                      ).toString()
                    : "",
                ),
                metavars: row_excluding_col,
                associate_id: row.__uid, // this is used by the backend to 'carry' certain values together
              };
            })
            .filter((r) => r !== undefined);
        } else {
          console.error(
            `Could not find table column with source handle name ${sourceHandleKey}`,
          );
          return null;
        }
      }
    } else {
      // Get the data related to that handle:
      if ("fields" in src_node.data) {
        if (Array.isArray(src_node.data.fields)) return src_node.data.fields;
        else {
          // We have to filter over a special 'fields_visibility' prop, which
          // can select what fields get output:
          if ("fields_visibility" in src_node.data)
            return Object.values(
              transformDict(
                src_node.data.fields,
                // eslint-disable-next-line
                (fid) => src_node.data.fields_visibility[fid] !== false,
                undefined,
                undefined,
              ),
            );
          // return all field values
          else
            return Object.values(
              transformDict(
                src_node.data.fields,
                undefined,
                undefined,
                undefined,
              ),
            );
        }
      }
      // NOTE: This assumes it's on the 'data' prop, with the same id as the handle:
      else return src_node.data[sourceHandleKey];
    }
  },

  // Get the types of nodes attached immediately as input to the given node
  getImmediateInputNodeTypes: (_targetHandles, node_id) => {
    const getNode = get().getNode;
    const edges = get().edges;
    const inputNodeTypes: string[] = [];
    edges.forEach((e) => {
      if (
        e.target === node_id &&
        typeof e.targetHandle === "string" &&
        _targetHandles.includes(e.targetHandle)
      ) {
        const src_node = getNode(e.source);
        if (src_node && src_node.type !== undefined)
          inputNodeTypes.push(src_node.type);
      }
    });
    return inputNodeTypes;
  },

  // Pull all inputs needed to request responses.
  // Returns [prompt, vars dict]
  pullInputData: (_targetHandles, node_id) => {
    // Functions/data from the store:
    const getNode = get().getNode;
    const output = get().output;
    const edges = get().edges;

    // Helper function to store collected data in dict:
    const store_data = (
      _texts: PromptVarType[],
      _varname: string,
      _data: Dict<PromptVarType[]>,
    ) => {
      if (_varname in _data) _data[_varname] = _data[_varname].concat(_texts);
      else _data[_varname] = _texts;
    };

    // Pull data from each source recursively:
    const pulled_data = {};
    const get_outputs = (
      varnames: string[],
      nodeId: string,
      var_history: Set<string>,
    ) => {
      varnames.forEach((varname) => {
        // Check for duplicate variable names
        if (var_history.has(String(varname).toLowerCase()))
          throw new DuplicateVariableNameError(varname);

        // Add to unique name tally
        var_history.add(String(varname).toLowerCase());

        // Find the relevant edge(s):
        edges.forEach((e) => {
          if (e.target === nodeId && e.targetHandle === varname) {
            // Get the immediate output:
            const out =
              e.sourceHandle != null
                ? output(e.source, e.sourceHandle, e.target, e.targetHandle)
                : undefined;
            if (!out || !Array.isArray(out) || out.length === 0) return;

            // Check the format of the output. Can be str or dict with 'text' and more attrs:
            if (typeof out[0] === "object") {
              out.forEach((obj) => store_data([obj], varname, pulled_data));
            } else {
              // Save the list of strings from the pulled output under the var 'varname'
              store_data(out, varname, pulled_data);
            }

            // Get any vars that the output depends on, and recursively collect those outputs as well:
            const n_vars = getNode(e.source)?.data?.vars;
            if (n_vars && Array.isArray(n_vars) && n_vars.length > 0)
              get_outputs(n_vars, e.source, var_history);
          }
        });
      });
    };
    get_outputs(_targetHandles, node_id, new Set<string>());

    return pulled_data;
  },

  /**
   * Sets select 'data' properties for node 'id'. This updates global state, and forces re-renders. Use sparingly.
   * @param {*} id The id of the node to set 'data' properties for.
   * @param {*} data_props The properties to set on the node's 'data'.
   */
  setDataPropsForNode: (id: string, data_props: Dict) => {
    const _set = (nds: Node[]) =>
      nds.map((n) => {
        if (n.id === id) {
          for (const key of Object.keys(data_props))
            n.data[key] = data_props[key];
          n.data = deepcopy(n.data);
        }
        return n;
      });
    set({
      nodes: _set(get().nodes),
    });
  },
  getNode: (id) => get().nodes.find((n) => n.id === id),
  addNode: (newnode) => {
    // Make sure we select the added node.
    // This will float it to the top.
    get().deselectAllNodes();
    newnode.selected = true;

    // Add the node to the internal state
    set({
      nodes: get().nodes.concat(newnode),
    });
  },
  removeNode: (nodeId: string) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    set((state) => {
      // remove from nodes
      return { nodes: state.nodes.filter((n) => n.id !== nodeId) };
    });
    if (node?.type === "textfields") {
    } else {
      const param = node?.data?.title || node?.id;
      const listeners = (get() as any)._listeners;
      if (listeners && Array.isArray(listeners)) {
        listeners.forEach(
          (l: (event: string, nodeId: string, param: string) => void) =>
            l("nodeRemoved", nodeId, param),
        );
      }
    }
  },

  deselectAllNodes: () => {
    // Deselect all nodes
    set({
      nodes: get().nodes.map((n) => {
        n.selected = false;
        return n;
      }),
    });
  },
  bringNodeToFront: (id) => {
    set({
      nodes: get().nodes.map((n) => {
        n.selected = n.id === id;
        return n;
      }),
    });
  },
  duplicateNode: (id, offset) => {
    const nodes = get().nodes;
    const node = nodes.find((n) => n.id === id);
    if (!node) {
      // console.error(`Could not duplicate node: No node found with id ${id}`);
      return undefined;
    }
    // Deep copy node data
    const dup = JSON.parse(JSON.stringify(node));
    // Shift position
    dup.position.x += offset && offset.x !== undefined ? offset.x : 0;
    dup.position.y += offset && offset.y !== undefined ? offset.y : 0;
    // Change id to new unique id
    dup.id = `${dup.type}-${Date.now()}`;
    // Return the duplicated node (does not add it to ReactFlow nodes; use addNode for that!)
    return dup;
  },
  setNodes: (newnodes) => {
    set({
      nodes: newnodes,
    });
  },
  addEdge: (edge) =>
    set((state) => ({
      edges: addEdge(edge, state.edges),
    })),
  setEdges: (newedges) => {
    set({
      edges: newedges,
    });
  },
  removeEdge: (id) => {
    set({
      edges: applyEdgeChanges([{ id, type: "remove" }], get().edges),
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
    const target = connection.target
      ? get().getNode(connection.target)
      : undefined;
    if (target === undefined) return;

    if (
      target.type === "vis" ||
      target.type === "inspect" ||
      target.type === "simpleval"
    ) {
      get().setDataPropsForNode(target.id, { input: connection.source });
    }

    // Ping target node to fresh if necessary
    if (
      typeof target?.type === "string" &&
      refreshableOutputNodeTypes.has(target.type)
    ) {
      get().setDataPropsForNode(target.id, { refresh: true });
    }

    connection = connection as Edge;
    connection.interactionWidth = 40;
    connection.animated = true;
    connection.markerEnd = { type: MarkerType.Arrow, width: 22, height: 22 }; // 22px
    connection.type = "default";

    set({
      edges: addEdge(connection, get().edges), // get().edges.concat(connection)
    });
  },
}));

export default useStore;
