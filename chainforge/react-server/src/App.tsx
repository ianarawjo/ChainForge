import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useContext,
  useMemo,
  useTransition,
  KeyboardEvent,
} from "react";
import ReactFlow, {
  Controls,
  Background,
  ReactFlowInstance,
  Node,
} from "reactflow";
import {
  Button,
  LoadingOverlay,
  Text,
  Box,
  List,
  Loader,
  Tooltip,
  Flex,
  useMantineColorScheme,
  Menu,
} from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { useContextMenu } from "mantine-contextmenu";
import {
  IconSettings,
  IconTextPlus,
  IconTerminal,
  IconSettingsAutomation,
  IconFileSymlink,
  IconRobot,
  IconRuler2,
  IconArrowMerge,
  IconArrowsSplit,
  IconForms,
  IconAbacus,
  IconDeviceFloppy,
  IconHeart,
  IconCheckbox,
  IconTransform,
} from "@tabler/icons-react";
import RemoveEdge from "./RemoveEdge";
import TextFieldsNode from "./TextFieldsNode"; // Import a custom node
import PromptNode from "./PromptNode";
import CodeEvaluatorNode from "./CodeEvaluatorNode";
import VisNode from "./VisNode";
import InspectNode from "./InspectorNode";
import ScriptNode from "./ScriptNode";
import { AlertModalContext } from "./AlertModal";
import ItemsNode from "./ItemsNode";
import TabularDataNode from "./TabularDataNode";
import JoinNode from "./JoinNode";
import SplitNode from "./SplitNode";
import CommentNode from "./CommentNode";
import GlobalSettingsModal, {
  GlobalSettingsModalRef,
} from "./GlobalSettingsModal";
import ExampleFlowsModal, { ExampleFlowsModalRef } from "./ExampleFlowsModal";
import LLMEvaluatorNode from "./LLMEvalNode";
import SimpleEvalNode from "./SimpleEvalNode";
import {
  getDefaultModelFormData,
  getDefaultModelSettings,
} from "./ModelSettingSchemas";
import { v4 as uuid } from "uuid";
import axios from "axios";
import LZString from "lz-string";
import { EXAMPLEFLOW_1 } from "./example_flows";
import MediaNode from "./MediaNode";

// Styling
import "reactflow/dist/style.css"; // reactflow
import "./styles.css"; // ChainForge CSS styling

// Lazy loading images
import "lazysizes";
import "lazysizes/plugins/attrchange/ls.attrchange";

// State management (from https://reactflow.dev/docs/guides/state-management/)
import { shallow } from "zustand/shallow";
import useStore, { StoreHandles } from "./store";
import StorageCache, { MediaLookup, StringLookup } from "./backend/cache";
import {
  APP_IS_RUNNING_LOCALLY,
  browserTabIsActive,
  FLASK_BASE_URL,
} from "./backend/utils";
import { Dict, JSONCompatible, LLMSpec } from "./backend/typing";
import {
  ensureUniqueFlowFilename,
  exportCache,
  exportFlowBundle,
  fetchEnvironAPIKeys,
  fetchExampleFlow,
  fetchOpenAIEval,
  importCache,
  importFlowBundle,
  saveFlowToLocalFilesystem,
} from "./backend/backend";

// Device / Browser detection
import {
  isMobile,
  isChrome,
  isFirefox,
  isEdgeChromium,
  isChromium,
} from "react-device-detect";
import MultiEvalNode from "./MultiEvalNode";
import FlowSidebar from "./FlowSidebar";
import NestedMenu, { NestedMenuItemProps } from "./NestedMenu";
import RequestClarificationModal, {
  RequestClarificationModalProps,
} from "./RequestClarificationModal";
import { useExportToWandB } from "./components/ExportToWandB"; // Import the new hook

const IS_ACCEPTED_BROWSER =
  (isChrome ||
    isChromium ||
    isEdgeChromium ||
    isFirefox ||
    (navigator as any)?.brave !== undefined) &&
  !isMobile;

// Whether we are running on localhost or not, and hence whether
// we have access to the Flask backend for, e.g., Python code evaluation.
const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

const SAVE_FLOW_FILENAME_TO_BROWSER_CACHE = (name: string) => {
  console.log("Saving flow filename", name);
  // Save the current filename of the user's working flow
  StorageCache.saveToLocalStorage("chainforge-cur-file", {
    flowFileName: name,
  });
};

const selector = (state: StoreHandles) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addNode: state.addNode,
  setNodes: state.setNodes,
  setEdges: state.setEdges,
  resetLLMColors: state.resetLLMColors,
  setAPIKeys: state.setAPIKeys,
  importState: state.importState,
  favorites: state.favorites,
  removeFavorite: state.removeFavorite,
});

// The initial LLM to use when new flows are created, or upon first load
const INITIAL_LLM = () => {
  if (!IS_RUNNING_LOCALLY) {
    // Prefer HF if running on server, as it's free.
    const falcon7b = {
      key: uuid(),
      name: "Mistral-7B",
      emoji: "🤗",
      model: "mistralai/Mistral-7B-Instruct-v0.1",
      base_model: "hf",
      temp: 1.0,
      settings: getDefaultModelSettings("hf"),
      formData: getDefaultModelFormData("hf"),
    } satisfies LLMSpec;
    falcon7b.formData.shortname = falcon7b.name;
    falcon7b.formData.model = falcon7b.model;
    return falcon7b;
  } else {
    // Prefer OpenAI for majority of local users.
    const chatgpt = {
      key: uuid(),
      name: "GPT3.5",
      emoji: "🤖",
      model: "gpt-3.5-turbo",
      base_model: "gpt-3.5-turbo",
      temp: 1.0,
      settings: getDefaultModelSettings("gpt-3.5-turbo"),
      formData: getDefaultModelFormData("gpt-3.5-turbo"),
    } satisfies LLMSpec;
    chatgpt.formData.shortname = chatgpt.name;
    chatgpt.formData.model = chatgpt.model;
    return chatgpt;
  }
};

const nodeTypes = {
  textfields: TextFieldsNode, // Register the custom node
  prompt: PromptNode,
  chat: PromptNode,
  simpleval: SimpleEvalNode,
  evaluator: CodeEvaluatorNode,
  llmeval: LLMEvaluatorNode,
  multieval: MultiEvalNode,
  vis: VisNode,
  inspect: InspectNode,
  script: ScriptNode,
  csv: ItemsNode,
  table: TabularDataNode,
  comment: CommentNode,
  join: JoinNode,
  split: SplitNode,
  processor: CodeEvaluatorNode,
  media: MediaNode,
};

const nodeEmojis = {
  textfields: <IconTextPlus size={16} />,
  prompt: "💬",
  chat: "🗣",
  simpleval: <IconRuler2 size={16} />,
  evaluator: <IconTerminal size={16} />,
  llmeval: <IconRobot size={16} />,
  multieval: <IconAbacus size={16} />,
  vis: "📊",
  inspect: "🔍",
  script: <IconSettingsAutomation size={16} />,
  csv: <IconForms size={16} />,
  table: "🗂️",
  comment: "✏️",
  join: <IconArrowMerge size={16} />,
  split: <IconArrowsSplit size={16} />,
  media: "📺",
  exportCforge: "💾",
  exportWandB: (
    <img
      src="wandb-logo.png"
      alt="W&B"
      style={{ width: "16px", height: "16px", objectFit: "contain" }}
    />
  ),
};

const edgeTypes = {
  default: RemoveEdge,
};

// Try to get a GET param in the URL, representing the shared flow.
// Returns undefined if not found.
const getSharedFlowURLParam = () => {
  // Get the current URL
  const curr_url = new URL(window.location.href);

  // Get the search parameters from the URL
  const params = new URLSearchParams(curr_url.search);

  // Try to retrieve an 'f' parameter (short for flow)
  const shared_flow_uid = params.get("f");

  if (shared_flow_uid) {
    // Check if it's a base36 string:
    const is_base36 = /^[0-9a-z]+$/i;
    if (shared_flow_uid.length > 1 && is_base36.test(shared_flow_uid))
      return shared_flow_uid;
  }
  return undefined;
};

const getWindowSize = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});
const getWindowCenter = () => {
  const { width, height } = getWindowSize();
  return { centerX: width / 2.0, centerY: height / 2.0 };
};

// const connectionLineStyle = { stroke: '#ddd' };
const snapGrid: [number, number] = [16, 16];

const App = () => {
  // Get nodes, edges, etc. state from the Zustand store:
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode: addNodeToStore,
    setNodes,
    setEdges,
    resetLLMColors,
    setAPIKeys,
    importState,
    favorites,
    removeFavorite,
  } = useStore(selector, shallow);

  // Color theme (dark or light mode)
  const { colorScheme } = useMantineColorScheme();

  // For saving / loading flows
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [autosavingInterval, setAutosavingInterval] = useState<
    NodeJS.Timeout | undefined
  >(undefined);

  // The 'name' of the current flow, to use when saving/loading
  const [flowFileName, setFlowFileName] = useState(`flow-${Date.now()}`);
  const safeSetFlowFileName = useCallback(async (newName: string) => {
    const uniqueName = await ensureUniqueFlowFilename(newName);
    setFlowFileName(uniqueName);
    SAVE_FLOW_FILENAME_TO_BROWSER_CACHE(uniqueName);
  }, []);
  const setFlowFileNameAndCache = useCallback((newName: string) => {
    setFlowFileName(newName);
    SAVE_FLOW_FILENAME_TO_BROWSER_CACHE(newName);
  }, []);

  // For 'share' button
  const clipboard = useClipboard({ timeout: 1500 });
  const [waitingForShare, setWaitingForShare] = useState(false);

  // Offload intensive computation to redraw and avoid blocking UI
  const [isSaving, startSaveTransition] = useTransition();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // For modal popup to set global settings like API keys
  const settingsModal = useRef<GlobalSettingsModalRef>(null);

  // For modal popup of example flows
  const examplesModal = useRef<ExampleFlowsModalRef>(null);

  // For an info pop-up that welcomes new users
  // const [welcomeModalOpened, { open: openWelcomeModal, close: closeWelcomeModal }] = useDisclosure(false);

  // For displaying alerts
  const showAlert = useContext(AlertModalContext);

  // For displaying a pending 'loading' status
  const [isLoading, setIsLoading] = useState(true);

  // Context menu for "Add Node +" list
  const { hideContextMenu } = useContextMenu();

  const handleError = useCallback(
    (err: Error | string) => {
      const msg = typeof err === "string" ? err : err.message;
      setIsLoading(false);
      setWaitingForShare(false);
      if (showAlert) showAlert(msg);
      console.error(msg);
    },
    [showAlert],
  );

  // Use the custom hook for Weights & Biases export
  const { handleExportToWandB: callExportToWandBFunc, ProjectNameModal } =
    useExportToWandB({
      showAlert: showAlert || (() => {}), // Ensure showAlert is a function
      rfInstance,
      nodes,
      handleError,
    });

  const exportMenuItems = useMemo(() => {
    // All initial nodes available in ChainForge
    const initNodes = [
      {
        // Menu.Label
        key: "To File",
      },
      {
        key: "cforge",
        title: ".cforge",
        icon: nodeEmojis.exportCforge,
        tooltip: "Export to .cforge file",
        onClick: () => exportFlow(),
      },
      {
        key: "divider",
      },
      {
        // Menu.Label
        key: "Platforms",
      },
      {
        key: "wandb",
        title: "W&B Weave",
        icon: nodeEmojis.exportWandB,
        tooltip: "Export to weights and biases weave platform",
        onClick: () => callExportToWandBFunc(), // Corrected call
      },
    ] as NestedMenuItemProps[];
    return initNodes;
  }, [callExportToWandBFunc]);
  // Add Nodes list
  const addNodesMenuItems = useMemo(() => {
    // All initial nodes available in ChainForge
    const initNodes = [
      {
        // Menu.Label
        key: "Input Data",
      },
      {
        key: "textfields",
        title: "Text Fields Node",
        icon: nodeEmojis.textfields,
        tooltip:
          "Specify input text to prompt or chat nodes. You can also declare variables in brackets {} to chain TextFields together.",
        onClick: () => addNode("textFieldsNode", "textfields"),
      },
      {
        key: "table",
        title: "Tabular Data Node",
        icon: nodeEmojis.table,
        tooltip:
          "Import or create a spreadhseet of data to use as input to prompt or chat nodes. Import accepts xlsx, csv, and jsonl.",
        onClick: () => addNode("table"),
      },
      {
        key: "csv",
        title: "Items Node",
        icon: nodeEmojis.csv,
        tooltip:
          "Specify inputs as a comma-separated list of items. Good for specifying lots of short text values. An alternative to TextFields node.",
        onClick: () => addNode("csvNode", "csv"),
      },
      {
        key: "media",
        title: "Media Node",
        icon: nodeEmojis.media,
        tooltip: "Add image data with corresponding metadata.",
        onClick: () => addNode("media", "media"),
      },
      {
        key: "divider",
      },
      {
        // Menu.Label
        key: "Prompters",
      },
      {
        key: "prompt",
        title: "Prompt Node",
        icon: nodeEmojis.prompt,
        tooltip:
          "Prompt one or multiple LLMs. Specify prompt variables in brackets {}.",
        onClick: () => addNode("promptNode", "prompt", { prompt: "" }),
      },
      {
        key: "chat",
        title: "Chat Turn Node",
        icon: nodeEmojis.chat,
        tooltip:
          "Start or continue a conversation with chat models. Attach Prompt Node output as past context to continue chatting past the first turn.",
        onClick: () => addNode("chatTurn", "chat", { prompt: "" }),
      },
      {
        key: "divider",
      },
      {
        // Menu.Label
        key: "Evaluators and Processors",
      },
      {
        key: "Evaluators",
        title: "Evaluators",
        icon: <IconCheckbox size={16} color="green" />,
        items: [
          {
            key: "simpleval",
            title: "Simple Evaluator",
            icon: nodeEmojis.simpleval,
            tooltip:
              "Evaluate responses with a simple check (no coding required).",
            onClick: () => addNode("simpleEval", "simpleval"),
          },
          {
            key: "evaluator-javascript",
            title: "JavaScript Evaluator",
            icon: nodeEmojis.evaluator,
            tooltip: "Evaluate responses by writing JavaScript code.",
            onClick: () =>
              addNode("evalNode", "evaluator", {
                language: "javascript",
                code: "function evaluate(response) {\n  return response.text.length;\n}",
              }),
          },
          {
            key: "evaluator-python",
            title: "Python Evaluator",
            icon: nodeEmojis.evaluator,
            tooltip: "Evaluate responses by writing Python code.",
            onClick: () =>
              addNode("evalNode", "evaluator", {
                language: "python",
                code: "def evaluate(response):\n  return len(response.text)",
              }),
          },
          {
            key: "llmeval",
            title: "LLM Evaluation",
            icon: nodeEmojis.llmeval,
            tooltip:
              "Evaluate responses with an LLM. (Note that LLM evaluators should be used with caution and always double-checked.)",
            onClick: () => addNode("llmeval"),
          },
          {
            key: "multieval",
            title: "Multi-Evaluator",
            icon: nodeEmojis.multieval,
            tooltip:
              "Evaluate responses across multiple criteria (multiple code and/or LLM evaluators).",
            onClick: () => addNode("multieval"),
          },
        ],
      },
      {
        key: "Processors",
        title: "Processors",
        icon: <IconTransform size={16} color="#f05f0c" />,
        items: [
          {
            key: "join",
            title: "Join Node",
            icon: nodeEmojis.join,
            tooltip:
              "Concatenate responses or input data together before passing into later nodes, within or across variables and LLMs.",
            onClick: () => addNode("join"),
          },
          {
            key: "split",
            title: "Split Node",
            icon: nodeEmojis.split,
            tooltip:
              "Split responses or input data by some format. For instance, you can split a markdown list into separate items.",
            onClick: () => addNode("split"),
          },
          {
            key: "processor-javascript",
            title: "JavaScript Processor",
            icon: nodeEmojis.evaluator,
            tooltip:
              "Transform responses by mapping a JavaScript function over them.",
            onClick: () =>
              addNode("process", "processor", {
                language: "javascript",
                code: "function process(response) {\n  return response.text;\n}",
              }),
          },
          {
            key: "processor-python",
            title: "Python Processor",
            icon: nodeEmojis.evaluator,
            tooltip:
              "Transform responses by mapping a Python function over them.",
            onClick: () =>
              addNode("process", "processor", {
                language: "python",
                code: "def process(response):\n  return response.text;",
              }),
          },
        ],
      },
      {
        key: "divider",
      },
      {
        // Menu.Label
        key: "Visualizers",
      },
      {
        key: "vis",
        title: "Vis Node",
        icon: nodeEmojis.vis,
        tooltip:
          "Plot evaluation results. (Attach an evaluator or scorer node as input.)",
        onClick: () => addNode("visNode", "vis", {}),
      },
      {
        key: "inspect",
        title: "Inspect Node",
        icon: nodeEmojis.inspect,
        tooltip:
          "Used to inspect responses from prompter or evaluation nodes, without opening up the pop-up view.",
        onClick: () => addNode("inspectNode", "inspect"),
      },
      {
        key: "divider",
      },
      {
        // Menu.Label
        key: "Misc",
      },
      {
        key: "comment",
        title: "Comment Node",
        icon: nodeEmojis.comment,
        tooltip: "Make a comment about your flow.",
        onClick: () => addNode("comment"),
      },
      {
        key: "script",
        title: "Global Python Scripts",
        icon: nodeEmojis.script,
        tooltip:
          "Specify directories to load as local packages, so they can be imported in your Python evaluator nodes (add to sys path).",
        onClick: () => addNode("scriptNode", "script"),
      },
    ] as NestedMenuItemProps[];

    // Add favorite nodes to the menu
    const favoriteNodes = favorites?.nodes?.map(({ name, value, uid }, idx) => {
      const type = value.type ?? "";
      const emoji =
        type in nodeEmojis ? nodeEmojis[type as keyof typeof nodeEmojis] : "❤️";
      return {
        key: uid,
        title: name,
        icon: emoji,
        tooltip: `Add ${name} to the flow`,
        onClick: () => addNodeFromFavorite(name, value),
        onTrash: (closeMenu) => {
          removeFavorite("nodes", uid);
          closeMenu();
        },
      } as NestedMenuItemProps;
    });

    if (favoriteNodes && favoriteNodes.length > 0) {
      initNodes.splice(0, 0, {
        key: "Favorites",
        title: "Favorites",
        icon: <IconHeart size={16} color="red" />,
        items: favoriteNodes,
      });
      initNodes.splice(1, 0, {
        key: "divider",
      });
    }

    // <Menu.Label>Favorites</Menu.Label>
    // <Menu.Divider />

    return initNodes;
  }, [favorites]);

  // Helper
  const getViewportCenter = useCallback(() => {
    const { centerX, centerY } = getWindowCenter();
    if (rfInstance === null) return { x: centerX, y: centerY };
    // Support Zoom
    const { x, y, zoom } = rfInstance.getViewport();
    return { x: -(x / zoom) + centerX / zoom, y: -(y / zoom) + centerY / zoom };
  }, [rfInstance]);

  const addNode = useCallback(
    (
      id: string,
      type?: string,
      data?: Dict,
      offsetX?: number,
      offsetY?: number,
    ) => {
      const { x, y } = getViewportCenter();
      addNodeToStore({
        id: `${id}-` + uuid(),
        type: type ?? id,
        data: data ?? {},
        position: {
          x: x - 200 + (offsetX || 0),
          y: y - 100 + (offsetY || 0),
        },
      });
    },
    [addNodeToStore, getViewportCenter],
  );

  // Add a node from a user's saved favorite
  const addNodeFromFavorite = useCallback(
    (name: string, value: Node) => {
      const data = { ...value.data };
      if (data.title === undefined) data.title = name;
      addNode(value.type ?? "favorite", value.type, data);
    },
    [addNode],
  );

  const onClickExamples = () => {
    if (examplesModal && examplesModal.current) examplesModal.current.trigger();
  };
  const onClickSettings = () => {
    if (settingsModal && settingsModal.current) settingsModal.current.trigger();
  };

  /**
   * SAVING / LOADING, IMPORT / EXPORT (from JSON)
   */
  const downloadJSON = (jsonData: JSONCompatible, filename: string) => {
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

  // Export flow to JSON
  const exportFlow = useCallback(
    (
      flowData?: unknown,
      saveToLocalFilesystem?: string,
      hideErrorAlert?: boolean,
      onError?: () => void,
    ) => {
      if (!rfInstance && !flowData) return;

      // We first get the data of the flow, if we haven't already
      const flow = flowData ?? rfInstance?.toObject();

      // Then we grab all the relevant cache files from the backend
      const all_node_ids = nodes.map((n) => n.id);
      return exportCache(all_node_ids)
        .then(function (cacheData) {
          // Now we append the cache file data to the flow
          const flow_and_cache = {
            flow,
            cache: cacheData,
          };

          // Save!
          const name = `${saveToLocalFilesystem ?? flowFileName}`;
          const flowFile = `${name}.cforge`;
          if (saveToLocalFilesystem !== undefined)
            // No need to export media files if we're saving locally
            return saveFlowToLocalFilesystem(
              flow_and_cache,
              flowFile,
              saveToLocalFilesystem !== "__autosave",
            );
          else if (MediaLookup.hasAnyMedia() && IS_RUNNING_LOCALLY)
            // There are media files and we're running locally,
            // so we need to export a self-contained .cfzip bundle instead
            exportFlowBundle(flow_and_cache, name);
          // No media files or we're on the browser, so
          // we can export a .cforge file (JSON). Media files
          // should be included in the cache data under __media.
          else downloadJSON(flow_and_cache as any, flowFile);
        })
        .catch((err) => {
          if (onError) onError();
          if (hideErrorAlert) console.error(err);
          else handleError(err);
        });
    },
    [rfInstance, nodes, flowFileName, handleError],
  );

  // Save the current flow to localStorage for later recall. Useful to getting
  // back progress upon leaving the site / browser crash / system restart.
  const saveFlow = useCallback(
    (
      rf_inst?: ReactFlowInstance,
      fileName?: string,
      hideErrorAlert?: boolean,
    ) => {
      const rf = rf_inst ?? rfInstance;
      if (!rf) return;

      setShowSaveSuccess(false);

      startSaveTransition(() => {
        // Get current flow state
        const flow = rf.toObject();

        const saveToLocalStorage = () => {
          // This line only saves the front-end state. Cache files
          // are not pulled or overwritten upon loading from localStorage.
          StorageCache.saveToLocalStorage("chainforge-flow", flow);

          // Attempt to save the current back-end state,
          // in the StorageCache. (This does LZ compression to save space.)
          StorageCache.saveToLocalStorage("chainforge-state");
        };

        const onFlowSaved = () => {
          console.log("Flow saved!");
          setShowSaveSuccess(true);
          setTimeout(() => {
            setShowSaveSuccess(false);
          }, 1000);
        };

        // If running locally, aattempt to save a copy of the flow to the lcoal filesystem,
        // so it shows up in the list of saved flows.
        if (IS_RUNNING_LOCALLY) {
          // SAVE TO LOCAL FILESYSTEM (only), and if that fails, try to save to localStorage
          exportFlow(
            flow,
            fileName ?? flowFileName,
            hideErrorAlert,
            saveToLocalStorage,
          )?.then(onFlowSaved);
        } else {
          // SAVE TO BROWSER LOCALSTORAGE
          saveToLocalStorage();
          onFlowSaved();
        }
      });
    },
    [rfInstance, exportFlow, flowFileName],
  );

  // Keyboard save handler
  const handleCtrlSave = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        // User has pressed Ctrl+S. Save the current state:
        saveFlow();
      }
    },
    [saveFlow],
  );

  // Initialize auto-saving
  const initAutosaving = useCallback(
    (rf_inst: ReactFlowInstance, reinit?: boolean) => {
      if (autosavingInterval !== undefined) {
        // Autosaving interval already set
        if (reinit)
          clearInterval(autosavingInterval); // reinitialize interval, clearing the current one
        else return; // do nothing
      }
      console.log("Init autosaving");

      // Autosave the flow to localStorage every minute:
      const interv = setInterval(() => {
        // Check the visibility of the browser tab --if it's not visible, don't autosave
        if (!browserTabIsActive()) return;

        // Start a timer, in case the saving takes a long time
        const startTime = Date.now();

        // Save the flow to localStorage, and (if running locally) a copy to the filesystem
        saveFlow(rf_inst, "__autosave", true); // surpress error alerts when autosaving

        // Check how long the save took
        const duration = Date.now() - startTime;
        if (duration > 1500) {
          // If the operation took longer than 1.5 seconds, that's not good.
          // Although this function is called async inside setInterval,
          // calls to localStorage block the UI in JavaScript, freezing the screen.
          // We smart-disable autosaving here when we detect it's starting the freeze the UI:
          console.warn(
            "Autosaving disabled. The time required to save to localStorage exceeds 1 second. This can happen when there's a lot of data in your flow. Make sure to export frequently to save your work.",
          );
          clearInterval(interv);
          setAutosavingInterval(undefined);
        }
      }, 60000); // 60000 milliseconds = 1 minute
      setAutosavingInterval(interv);
    },
    [autosavingInterval, saveFlow, flowFileName],
  );

  // Triggered when user confirms 'New Flow' button
  const resetFlow = useCallback(
    (name?: string | null) => {
      resetLLMColors();

      const uid = (id: string) => `${id}-${Date.now()}`;
      const starting_nodes = [
        {
          id: uid("prompt"),
          type: "prompt",
          data: {
            prompt: "",
            n: 1,
            llms: [INITIAL_LLM()],
          },
          position: { x: 450, y: 200 },
        },
        {
          id: uid("textfields"),
          type: "textfields",
          data: {},
          position: { x: 80, y: 270 },
        },
      ];

      setNodes(starting_nodes);
      setEdges([]);

      StorageCache.clear();
      MediaLookup.clear();

      // New flow filename
      if (name == null) name = `flow-${Date.now()}`;
      setFlowFileNameAndCache(name);

      if (rfInstance) rfInstance.setViewport({ x: 200, y: 80, zoom: 1 });
    },
    [setNodes, setEdges, resetLLMColors, rfInstance],
  );

  const loadFlow = useCallback(
    async (flow?: Dict, rf_inst?: ReactFlowInstance | null) => {
      if (flow === undefined) return;
      if (rf_inst) {
        if (flow.viewport)
          rf_inst.setViewport({
            x: flow.viewport.x || 0,
            y: flow.viewport.y || 0,
            zoom: flow.viewport.zoom || 1,
          });
        else rf_inst.setViewport({ x: 0, y: 0, zoom: 1 });
      }
      resetLLMColors();

      // First, clear the ReactFlow state entirely
      // NOTE: We need to do this so it forgets any node/edge ids, which might have cross-over in the loaded flow.
      setNodes([]);
      setEdges([]);

      // After a delay, load in the new state.
      setTimeout(() => {
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);

        // Save flow that user loaded to autosave cache, in case they refresh the browser
        StorageCache.saveToLocalStorage("chainforge-flow", flow);

        // Cancel loading spinner
        setIsLoading(false);
      }, 10);

      // Start auto-saving, if it's not already enabled
      if (rf_inst) initAutosaving(rf_inst, true);
    },
    [resetLLMColors, setNodes, setEdges, initAutosaving],
  );

  const importGlobalStateFromCache = useCallback(() => {
    importState(StorageCache.getAllMatching((key) => key.startsWith("r.")));
  }, [importState]);

  // Find the autosaved flow, if it exists, returning
  // whether it exists and the location ("browser" or "filesystem") that it exists at.
  const autosavedFlowExists = useCallback(async () => {
    if (IS_RUNNING_LOCALLY) {
      // If running locally, we try to fetch a flow autosaved on the user's local machine first:
      try {
        const response = await axios.get(
          `${FLASK_BASE_URL}api/flowExists/__autosave`,
        );
        const autosave_file_exists = response.data.exists as boolean;
        if (autosave_file_exists)
          return { exists: autosave_file_exists, location: "filesystem" };
      } catch (error) {
        // Soft fail, continuing onwards to checking localStorage instead
      }
    }

    return {
      exists: window.localStorage.getItem("chainforge-flow") !== null,
      location: "browser",
    };
  }, []);

  // Import data to the cache stored on the local filesystem (in backend)
  const handleImportCache = useCallback(
    (cache_data: Dict<Dict>) =>
      importCache(cache_data)
        .then(importGlobalStateFromCache)
        .catch(handleError),
    [handleError, importGlobalStateFromCache],
  );

  const importFlowFromJSON = useCallback(
    (flowJSON: Dict, rf_inst?: ReactFlowInstance | null) => {
      const rf = rf_inst ?? rfInstance;

      setIsLoading(true);

      // Delay briefly, to ensure there's time for
      // the isLoading spinner to appear:
      setTimeout(() => {
        // Detect if there's no cache data
        if (!flowJSON.cache) {
          // Support for loading old flows w/o cache data:
          loadFlow(flowJSON, rf);
          StringLookup.restoreFrom([]); // manually clear the string lookup table
          MediaLookup.clear(); // manually clear the media lookup table
          return;
        }

        // Then we need to extract the JSON of the flow vs the cache data
        const flow = flowJSON.flow;
        const cache = flowJSON.cache;

        // We need to send the cache data to the backend first,
        // before we can load the flow itself...
        handleImportCache(cache)
          .then(() => {
            // We load the ReactFlow instance last
            loadFlow(flow, rf);
          })
          .catch((err) => {
            // On an error, still try to load the flow itself:
            handleError(
              "Error encountered when importing cache data:" +
                err.message +
                "\n\nTrying to load flow regardless...",
            );
            loadFlow(flow, rf);
          });
      }, 100);
    },
    [rfInstance, handleImportCache, loadFlow],
  );

  // Import a ChainForge flow from a file
  const importFlowFromFile = useCallback(async () => {
    // Create an input element with type "file" and accept only JSON files
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cforge, .json, .cfzip, .zip";

    // Handle file selection
    input.addEventListener(
      "change",
      // @ts-expect-error The event is correctly typed here, but for some reason TS doesn't pick up on it.
      function (event: React.ChangeEvent<HTMLInputElement>) {
        // Start loading spinner
        setIsLoading(false);

        const files = event.target.files;
        if (!files || typeof files !== "object" || files.length === 0) {
          console.error("No files found to load.");
          return;
        }

        // We only support one file at a time
        const file = files[0];

        if (file.name.endsWith(".cfzip") || file.name.endsWith(".zip")) {
          // Read a ChainForge bundled zip file
          importFlowBundle(file)
            .then(({ flow, flowName }) => {
              // NOTE: At this point, any media files have either been
              // imported to the backend, or are in the MediaLookup cache.

              // Import the flow JSON data to the front-end
              importFlowFromJSON(flow);

              // Set the name to the filename, for consistent saving
              safeSetFlowFileName(flowName);
            })
            .catch((err) => {
              handleError(
                "Critical error encountered when importing ChainForge flow bundle:" +
                  err.message,
              );
            });
        } else {
          // Read a .cforge JSON file
          const reader = new window.FileReader();
          const fileName = file.name
            ?.replace(".cforge", "")
            .replace(".json", "");

          // Handle file load event
          reader.addEventListener("load", function () {
            try {
              if (typeof reader.result !== "string")
                throw new Error(
                  "File could not be read: Unknown format or empty.",
                );

              // We try to parse the JSON response
              const flow_and_cache = JSON.parse(reader.result);

              // Import it to React Flow and import cache data on the backend
              importFlowFromJSON(flow_and_cache);

              // Set the name to the filename, for consistent saving
              safeSetFlowFileName(fileName);
            } catch (error) {
              handleError(error as Error);
            }
          });

          // Read the selected file as text
          reader.readAsText(file);
        }
      },
    );

    // Trigger the file selector
    input.click();
  }, [importFlowFromJSON, handleError, safeSetFlowFileName]);

  // Downloads the selected OpenAI eval file (preconverted to a .cforge flow)
  const importFlowFromOpenAIEval = (evalname: string) => {
    setIsLoading(true);

    fetchOpenAIEval(evalname).then(importFlowFromJSON).catch(handleError);
  };

  const loadFlowFromAutosave = useCallback(
    async (rf_inst: ReactFlowInstance, fromFilesystem?: boolean) => {
      if (fromFilesystem) {
        // From local filesystem
        let response;
        try {
          // Fetch the flow
          response = await axios.get(`${FLASK_BASE_URL}api/flows/__autosave`);
        } catch (error) {
          console.error(
            "Error encountered when loading autosave from local filesystem:",
            error,
          );

          // Clear out the flow name, if set, so that it doesn't overwrite
          setFlowFileNameAndCache(`flow-${Date.now()}`);
          // Soft fail
          return;
        }

        // Attempt to load flow into the UI
        try {
          importFlowFromJSON(response.data, rf_inst);
          console.log("Loaded flow from autosave on local machine.");
        } catch (error) {
          handleError(error as Error);
        }
      } else {
        // From browser localStorage
        const saved_flow = StorageCache.loadFromLocalStorage(
          "chainforge-flow",
          false,
        ) as Dict;
        if (saved_flow) {
          StorageCache.loadFromLocalStorage("chainforge-state", true);
          importGlobalStateFromCache();
          loadFlow(saved_flow, rf_inst);
        }
      }
    },
    [
      importGlobalStateFromCache,
      loadFlow,
      importFlowFromJSON,
      handleError,
      setFlowFileNameAndCache,
    ],
  );

  // Load flow from examples modal
  const onSelectExampleFlow = (name: string, example_category?: string) => {
    // Trigger the 'loading' modal
    setIsLoading(true);

    // Detect a special category of the example flow, and use the right loader for it:
    if (example_category === "openai-eval") {
      importFlowFromOpenAIEval(name);
      setFlowFileNameAndCache(`flow-${Date.now()}`);
      return;
    }

    // Fetch the example flow data from the backend
    fetchExampleFlow(name)
      .then(function (flowJSON) {
        // We have the data, import it:
        importFlowFromJSON(flowJSON);
        setFlowFileNameAndCache(`flow-${Date.now()}`);
      })
      .catch(handleError);
  };

  // When the user clicks the 'New Flow' button
  const [requestFlowNameOpened, setRequestFlowNameOpened] = useState(false);
  const [requestFlowNameProps, setRequestFlowNameProps] = useState<
    Partial<RequestClarificationModalProps>
  >({});
  const requestClarificationModal = useMemo(
    () => (
      <RequestClarificationModal
        opened={requestFlowNameOpened}
        title={requestFlowNameProps.title ?? ""}
        question={requestFlowNameProps.question ?? ""}
        desc={requestFlowNameProps.desc}
        onSubmit={requestFlowNameProps.onSubmit ?? (() => {})}
        validator={(answer) => {
          // Ensure the filename contains only valid characters
          const invalidChars = /[<>:"/\\|?*\x00-\x1F.]/g;
          if (!answer || invalidChars.test(answer)) {
            return "Flow name contains invalid characters.";
          } else if (answer && answer.length >= 255) {
            return "Flow name too long. Must be less than 255 characters.";
          }
          return null;
        }}
      />
    ),
    [requestFlowNameProps, requestFlowNameOpened],
  );
  const onClickNewFlow = useCallback(() => {
    setRequestFlowNameProps({
      title: "Create a new flow",
      question: "What do you want to name your new flow?",
      desc: "Any unsaved changes to your existing flow will be lost.",
      onSubmit: (answer) => {
        if (answer == null) {
          // User canceled; do nothing
          setRequestFlowNameOpened(false);
          return;
        }
        setRequestFlowNameOpened(false);
        resetFlow(answer); // Set the callback if user confirms action
      },
    });
    setRequestFlowNameOpened(true);
  }, [resetFlow]);

  // When the user clicks the 'Share Flow' button
  const onClickShareFlow = useCallback(async () => {
    if (IS_RUNNING_LOCALLY) {
      handleError(
        new Error(
          "Cannot upload flow to server database when running locally: Feature only exists on hosted version of ChainForge.",
        ),
      );
      return;
    } else if (waitingForShare === true) {
      handleError(
        new Error(
          "A share request is already in progress. Wait until the current share finishes before clicking again.",
        ),
      );
      return;
    }

    // Helper function
    function isFileSizeLessThan5MB(json_str: string) {
      const encoder = new TextEncoder();
      const encodedString = encoder.encode(json_str);
      const fileSizeInBytes = encodedString.length;
      const fileSizeInMB = fileSizeInBytes / (1024 * 1024); // Convert bytes to megabytes
      return fileSizeInMB < 5;
    }

    setWaitingForShare(true);

    // Package up the current flow:
    const flow = rfInstance?.toObject();
    const all_node_ids = nodes.map((n) => n.id);
    const cforge_data = await exportCache(all_node_ids)
      .then(function (cacheData) {
        // Now we append the cache file data to the flow
        return {
          flow,
          cache: cacheData,
        };
      })
      .catch(handleError);

    if (!cforge_data) return;

    // Compress the data and check it's compressed size < 5MB:
    const compressed = LZString.compressToUTF16(JSON.stringify(cforge_data));
    if (!isFileSizeLessThan5MB(compressed)) {
      handleError(
        new Error(
          "Flow filesize exceeds 5MB. You can only share flows up to 5MB or less. But, don't despair! You can still use 'Export Flow' to share your flow manually as a .cforge file.",
        ),
      );
      return;
    }

    // Try to upload the compressed cforge data to the server:
    fetch("/db/shareflow.php", {
      method: "POST",
      body: compressed,
    })
      .then((r) => r.text())
      .then((uid) => {
        if (!uid) {
          throw new Error("Received no response from server.");
        } else if (uid.startsWith("Error")) {
          // Error encountered during the query; alert the user
          // with the error message:
          throw new Error(uid);
        }

        // Share completed!
        setWaitingForShare(false);

        // The response should be a uid we can put in a GET request.
        // Generate the link:
        const base_url = new URL(
          window.location.origin + window.location.pathname,
        ); // the current address e.g., https://chainforge.ai/play
        const get_params = new URLSearchParams(base_url.search);
        // Add the 'f' parameter
        get_params.set("f", uid); // set f=uid
        // Update the URL with the modified search parameters
        base_url.search = get_params.toString();
        // Get the modified URL
        const get_url = base_url.toString();

        // Copies the GET URL to user's clipboard
        // and updates the 'Share This' button state:
        clipboard.copy(get_url);
      })
      .catch((err) => {
        handleError(err);
      });
  }, [
    rfInstance,
    nodes,
    IS_RUNNING_LOCALLY,
    handleError,
    clipboard,
    waitingForShare,
  ]);

  // Run once upon ReactFlow initialization
  const onInit = useCallback(
    (rf_inst: ReactFlowInstance) => {
      setRfInstance(rf_inst);

      if (IS_RUNNING_LOCALLY) {
        // If we're running locally, try to fetch API keys from Python os.environ variables in the locally running Flask backend:
        fetchEnvironAPIKeys()
          .then((api_keys) => {
            setAPIKeys(api_keys);
          })
          .catch((err) => {
            // Soft fail
            console.warn(
              "Warning: Could not fetch API key environment variables from Flask server. Error:",
              err.message,
            );
          });

        // We also need to fetch the current flowFileName
        // Attempt to get the last working filename on component mount
        const last_working_flow_filename = StorageCache.loadFromLocalStorage(
          "chainforge-cur-file",
        );
        if (
          last_working_flow_filename &&
          typeof last_working_flow_filename === "object" &&
          "flowFileName" in last_working_flow_filename
        ) {
          // Use last working flow name
          setFlowFileName(last_working_flow_filename.flowFileName as string);
        }
      } else {
        // Check if there's a shared flow UID in the URL as a GET param
        // If so, we need to look it up in the database and attempt to load it:
        const shared_flow_uid = getSharedFlowURLParam();
        if (shared_flow_uid !== undefined) {
          try {
            // The format passed a basic smell test;
            // now let's query the server for a flow with that UID:
            fetch("/db/get_sharedflow.php", {
              method: "POST",
              body: shared_flow_uid,
            })
              .then((r) => r.text())
              .then((response) => {
                if (!response || response.startsWith("Error")) {
                  // Error encountered during the query; alert the user
                  // with the error message:
                  throw new Error(response || "Unknown error");
                }

                // Attempt to parse the response as a compressed flow + import it:
                const cforge_json = JSON.parse(
                  LZString.decompressFromUTF16(response),
                );
                importFlowFromJSON(cforge_json, rf_inst);
              })
              .catch(handleError);
          } catch (err) {
            // Soft fail
            setIsLoading(false);
            console.error(err);
          }

          // Since we tried to load from the shared flow ID, don't try to load from autosave
          return;
        }
      }

      // Attempt to load an autosaved flow, if one exists:
      autosavedFlowExists().then(({ exists, location }) => {
        if (!exists) {
          // Load an interesting default starting flow for new users
          importFlowFromJSON(EXAMPLEFLOW_1, rf_inst);

          // Open a welcome pop-up
          // openWelcomeModal();
        } else if (location === "browser") {
          loadFlowFromAutosave(rf_inst, false);
        } else if (location === "filesystem") {
          loadFlowFromAutosave(rf_inst, true);
        }
      });

      // Turn off loading wheel
      setIsLoading(false);
    },
    [
      setAPIKeys,
      handleError,
      importFlowFromJSON,
      autosavedFlowExists,
      loadFlowFromAutosave,
    ],
  );

  useEffect(() => {
    // Cleanup the autosaving interval upon component unmount:
    return () => {
      clearInterval(autosavingInterval); // Clear the interval when the component is unmounted
    };
  }, []);

  const reactFlowUI = useMemo(() => {
    return (
      <div
        id="cf-root-container"
        style={{ display: "flex", height: "100vh" }}
        onPointerDown={hideContextMenu}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: colorScheme === "light" ? "#eee" : "#222",
            flexGrow: "1",
          }}
        >
          <ReactFlow
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodes={nodes}
            edges={edges}
            // @ts-expect-error Node types won't perfectly fit unless we explicitly extend from RF's types; ignoring this for now.
            nodeTypes={nodeTypes}
            // @ts-expect-error Edge types won't perfectly fit unless we explicitly extend from RF's types; ignoring this for now.
            edgeTypes={edgeTypes}
            zoomOnPinch={false}
            zoomOnScroll={false}
            panOnScroll={true}
            disableKeyboardA11y={true}
            deleteKeyCode={[]}
            // connectionLineComponent={AnimatedConnectionLine}
            // connectionLineStyle={connectionLineStyle}
            snapToGrid={true}
            snapGrid={snapGrid}
            onInit={onInit}
            onError={() => {
              // Suppress ReactFlow warnings spamming the console.
              // console.log(err);
            }}
          >
            <Background color="#999" gap={16} />
            <Controls showZoom={true} />
          </ReactFlow>
        </div>
      </div>
    );
  }, [
    onNodesChange,
    onEdgesChange,
    onConnect,
    nodes,
    edges,
    onInit,
    hideContextMenu,
  ]);

  const saveMessage = useMemo(() => {
    if (isSaving) return "Saving...";
    else if (showSaveSuccess) return "Success!";
    else if (IS_RUNNING_LOCALLY) return "Save to local disk";
    else return "Save to local cache";
  }, [isSaving, showSaveSuccess]);

  const flowSidebar = useMemo(() => {
    if (!IS_RUNNING_LOCALLY) return undefined;
    return (
      <FlowSidebar
        currentFlow={flowFileName}
        onLoadFlow={(flowData, name) => {
          if (name !== undefined) {
            setFlowFileNameAndCache(name);
          }
          if (flowData !== undefined) {
            try {
              importFlowFromJSON(flowData);
            } catch (error) {
              console.error(error);
              setIsLoading(false);
              if (showAlert) showAlert(error as Error);
            }
          }
        }}
      />
    );
  }, [flowFileName, importFlowFromJSON, showAlert, setFlowFileNameAndCache]);

  // Export to Weights & Biases handler (stub for now)
  const handleExportToWandB = useCallback(() => {
    // TODO: Implement actual export logic to Weights & Biases
    alert("Export to Weights & Biases is not yet implemented.");
  }, []);

  if (!IS_ACCEPTED_BROWSER) {
    return (
      <Box maw={600} mx="auto" mt="40px">
        <Text m="xl" size={"11pt"}>
          {"We're sorry, but it seems like "}
          {isMobile
            ? "you are viewing ChainForge on a mobile device"
            : "your current browser isn't supported by the current version of ChainForge"}{" "}
          😔. We want to provide you with the best experience possible, so we
          recommend {isMobile ? "viewing ChainForge on a desktop browser" : ""}{" "}
          using one of our supported browsers listed below:
        </Text>
        <List m="xl" size={"11pt"}>
          <List.Item>Google Chrome</List.Item>
          <List.Item>Mozilla Firefox</List.Item>
          <List.Item>Microsoft Edge (Chromium)</List.Item>
          <List.Item>Brave</List.Item>
        </List>

        <Text m="xl" size={"11pt"}>
          These browsers offer enhanced compatibility with ChainForge&apos;s
          features. Don&apos;t worry, though! We&apos;re working to expand our
          browser support to ensure everyone can enjoy our platform. 😊
        </Text>
        <Text m="xl" size={"11pt"}>
          If you have any questions or need assistance, please don&apos;t
          hesitate to reach out on our{" "}
          <a href="https://github.com/ianarawjo/ChainForge/issues">GitHub</a> by{" "}
          <a href="https://github.com/ianarawjo/ChainForge/issues">
            opening an Issue.
          </a>
          &nbsp; (If you&apos;re a web developer, consider forking our
          repository and making a{" "}
          <a href="https://github.com/ianarawjo/ChainForge/pulls">
            Pull Request
          </a>{" "}
          to support your particular browser.)
        </Text>
      </Box>
    );
  } else
    return (
      <div onKeyDown={handleCtrlSave}>
        <GlobalSettingsModal ref={settingsModal} />
        <LoadingOverlay visible={isLoading} overlayBlur={1} />
        {requestClarificationModal}
        <ExampleFlowsModal
          ref={examplesModal}
          handleOnSelect={onSelectExampleFlow}
        />
        {ProjectNameModal}
        {flowSidebar}

        {/* <Modal title={'Welcome to ChainForge'} size='400px' opened={welcomeModalOpened} onClose={closeWelcomeModal} yOffset={'6vh'} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-80px'}}}>
        <Box m='lg' mt='xl'>
          <Text>To get started, click the Settings icon in the top-right corner.</Text>
        </Box>
      </Modal> */}

        {reactFlowUI}

        <div
          id="custom-controls"
          style={{
            position: "fixed",
            left: IS_RUNNING_LOCALLY ? "44px" : "10px",
            top: "10px",
            zIndex: 8,
          }}
        >
          <Flex>
            <NestedMenu
              items={addNodesMenuItems}
              button={(toggleMenu) => (
                <Button
                  size="sm"
                  variant={colorScheme === "light" ? "gradient" : "filled"}
                  color={colorScheme === "light" ? "blue" : "gray"}
                  compact
                  mr="sm"
                  onClick={toggleMenu}
                >
                  Add Node +
                </Button>
              )}
            />
            <NestedMenu
              items={exportMenuItems}
              button={(toggleMenu) => (
                <Button
                  size="sm"
                  variant={colorScheme === "light" ? "gradient" : "filled"}
                  color={colorScheme === "light" ? "blue" : "gray"}
                  compact
                  mr="sm"
                  onClick={toggleMenu}
                >
                  Export
                </Button>
              )}
            />
            <Button
              onClick={importFlowFromFile}
              size="sm"
              variant="outline"
              color={colorScheme === "light" ? "blue" : "gray"}
              bg={colorScheme === "light" ? "#eee" : "#222"}
              compact
            >
              Import
            </Button>
            <Tooltip label={saveMessage} withArrow>
              <Button
                variant="outline"
                ml="sm"
                size="sm"
                compact
                onClick={() => saveFlow()}
                color={colorScheme === "light" ? "blue" : "gray"}
                bg={colorScheme === "light" ? "#eee" : "#222"}
                loading={isSaving}
                disabled={isLoading || isSaving}
                leftIcon={
                  <IconDeviceFloppy
                    fill={colorScheme === "light" ? "#dde" : "#222"}
                  />
                }
                styles={{
                  leftIcon: {
                    marginRight: "3px",
                  },
                }}
              >
                Save
              </Button>
            </Tooltip>
          </Flex>
        </div>
        <div
          style={{ position: "fixed", right: "10px", top: "10px", zIndex: 8 }}
        >
          {IS_RUNNING_LOCALLY ? (
            <></>
          ) : (
            <Button
              onClick={onClickShareFlow}
              size="sm"
              variant="outline"
              compact
              color={
                clipboard.copied
                  ? "teal"
                  : colorScheme === "light"
                    ? "blue"
                    : "gray"
              }
              mr="xs"
              style={{ float: "left" }}
            >
              {waitingForShare ? (
                <Loader size="xs" mr="4px" />
              ) : (
                <IconFileSymlink size="16px" />
              )}
              {clipboard.copied
                ? "Link copied!"
                : waitingForShare
                  ? "Sharing..."
                  : "Share"}
            </Button>
          )}
          <Button
            onClick={onClickNewFlow}
            size="sm"
            variant="outline"
            color={colorScheme === "light" ? "blue" : "gray"}
            bg={colorScheme === "light" ? "#eee" : "#222"}
            compact
            mr="xs"
            style={{ float: "left" }}
          >
            {" "}
            New Flow{" "}
          </Button>
          <Button
            onClick={onClickExamples}
            size="sm"
            variant="filled"
            color={colorScheme === "light" ? "blue" : "gray"}
            compact
            mr="xs"
            style={{ float: "left" }}
          >
            {" "}
            Example Flows{" "}
          </Button>
          <Button
            onClick={onClickSettings}
            size="sm"
            variant={colorScheme === "light" ? "gradient" : "filled"}
            color={colorScheme === "light" ? "blue" : "gray"}
            compact
          >
            <IconSettings size={"90%"} />
          </Button>
        </div>
        <div
          style={{
            position: "fixed",
            right: "10px",
            bottom: "20px",
            zIndex: 8,
          }}
        >
          <a
            href="https://forms.gle/qhr7T2Fe8gYJF16fA"
            target="_blank"
            style={{ color: "#666", fontSize: "11pt" }}
            rel="noreferrer"
          >
            Send us feedback
          </a>
        </div>
      </div>
    );
};

export default App;
