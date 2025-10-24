import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import { LoadingOverlay, Badge } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import useStore from "./store";
import InspectFooter from "./InspectFooter";
import { AlertModalContext } from "./AlertModal";
import AreYouSureModal, { AreYouSureModalRef } from "./AreYouSureModal";
import LLMResponseInspectorModal, {
  LLMResponseInspectorModalRef,
} from "./LLMResponseInspectorModal";
import RetrievalMethodListContainer, {
  RetrievalMethodSpec,
} from "./RetrievalMethodListComponent";
import { LLMResponse, TemplateVarInfo } from "./backend/typing";
import { FLASK_BASE_URL, dict_excluding_key } from "./backend/utils";

interface RetrievalNodeProps {
  id: string;
  data: {
    title?: string;
    methods?: RetrievalMethodSpec[];
    results?: Record<string, any>;
    refresh?: boolean;
  };
}

// Constants for handle positioning and styling
const HANDLE_Y_START = 60; // Adjust this value to move the first handle up/down
const HANDLE_Y_GAP = 30; // Adjust this value for spacing between handles
const HANDLE_X_OFFSET = "-14px"; // Nudge handle horizontally if needed (ReactFlow default is centered)

const handleStyle: React.CSSProperties = {
  background: "#555",
  position: "absolute", // Necessary for precise positioning relative to wrapper
  left: HANDLE_X_OFFSET,
};
const badgeStyle: React.CSSProperties = { textTransform: "none" };
const handleWrapperBaseStyle: React.CSSProperties = {
  // Common style for the div wrapping Badge + Handle
  position: "absolute",
  left: "10px", // Padding from the node's left edge
  display: "flex",
  alignItems: "center", // Vertically align Badge and Handle dot
  height: "20px", // Define height for alignment reference
};
const badgeWrapperStyle: React.CSSProperties = {
  // Style for the div specifically containing the Badge
  marginRight: "8px", // Space between Badge and Handle dot
};

const RetrievalNode: React.FC<RetrievalNodeProps> = ({ id, data }) => {
  const nodeDefaultTitle = "Retrieval Node";
  const nodeIcon = "🎯";

  // Store hooks
  const pullInputData = useStore((s) => s.pullInputData);
  const setDataPropsForNode = useStore((s) => s.setDataPropsForNode);
  const pingOutputNodes = useStore((s) => s.pingOutputNodes);
  const apiKeys = useStore((s) => s.apiKeys);

  // Context
  const showAlert = useContext(AlertModalContext);

  // State
  const [methodItems, setMethodItems] = useState<RetrievalMethodSpec[]>(
    data.methods || [],
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any>>(
    data.results || {},
  );
  const [jsonResponses, setJsonResponses] = useState<LLMResponse[]>([]);

  // Refs
  const inspectorModalRef = useRef<LLMResponseInspectorModalRef>(null);
  const retrievalConfirmModalRef = useRef<AreYouSureModalRef>(null);

  // Reset on refresh
  useEffect(() => {
    if (data.refresh) {
      setDataPropsForNode(id, {
        refresh: false,
        results: {},
        output: [],
      });
      setResults({});
      setJsonResponses([]);
    }
  }, [data.refresh, id, setDataPropsForNode]);

  // Handle method changes
  const handleMethodsChange = useCallback(
    (newItems: RetrievalMethodSpec[]) => {
      setMethodItems(newItems);
      setDataPropsForNode(id, { methods: newItems });
    },
    [id, setDataPropsForNode],
  );

  // Confirmation modal for running retrieval
  const confirmAndRunRetrieval = () => {
    retrievalConfirmModalRef.current?.trigger();
  };

  // Main retrieval function
  const runRetrieval = useCallback(async () => {
    if (methodItems.length === 0) {
      showAlert?.("Please add at least one retrieval method");
      return;
    }
    setLoading(true);

    try {
      // Get input data from connected nodes
      const inputData = pullInputData(["chunks", "queries"], id) as {
        chunks?: any[];
        queries?: any[];
      };

      // Format methods for the API request
      const formattedMethods = methodItems.map((method) => ({
        id: method.key,
        baseMethod: method.baseMethod,
        methodName: method.methodName,
        library: method.library,
        embeddingProvider: method.embeddingProvider,
        settings: method.settings || {},
      }));

      // Updated error checks for clarity
      //       if (!inputData.chunks || inputData.chunks.length === 0) {
      //         throw new Error("Input 'chunks' is missing or empty.");
      //       }
      if (!inputData.queries || inputData.queries.length === 0) {
        throw new Error("Input 'queries' is missing or empty.");
      }

      console.log("Chunks:", inputData.chunks);

      // Make the API request
      const response = await fetch(`${FLASK_BASE_URL}/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methods: formattedMethods,
          chunks: inputData.chunks,
          queries: inputData.queries,
          api_keys: apiKeys,
        }),
      });

      if (!response.ok) {
        throw new Error(`Retrieval failed: ${response.statusText}`);
      }

      // The response is now a flat array of objects
      const retrievalResults = await response.json();

      console.warn("Retrieval results:", retrievalResults);

      // Convert to proper LLMResponse objects
      const llmResponses: LLMResponse[] = retrievalResults.map(
        (result: any) => {
          const vars = {
            ...(result.vars || {}),
            chunkMethod:
              result.chunkMethod ??
              result.vars?.chunkMethod ??
              result.metavars?.chunkMethod,
          };
          return {
            uid: result.uid || `retrieval-${Date.now()}-${Math.random()}`,
            prompt: result.prompt,
            vars,
            metavars: result.metavars || {},
            responses: [result.text],
            eval_res: result.eval_res || [],
            llm: vars.retrievalMethod || "Unknown",
          };
        },
      );

      // Set the responses for the inspector
      setJsonResponses(llmResponses);

      // Group results by method for the node's internal state
      const resultsByMethod: Record<string, any> = {};

      // Process each result to organize by method
      retrievalResults.forEach((result: any) => {
        // Extract method info using nullish coalescing for safety
        const methodId = result.metavars?.methodId ?? "unknown_method";

        if (!resultsByMethod[methodId]) {
          resultsByMethod[methodId] = {
            retrieved: {},
            metavars: {
              retrievalMethod: result.vars?.retrievalMethod ?? "Unknown Method",
              retrievalMethodSignature:
                result.metavars?.retrievalMethodSignature,
              embeddingModel: result.metavars?.embeddingModel,
            },
          };
        }

        // Group by query
        const query = result.prompt;
        if (!resultsByMethod[methodId].retrieved[query]) {
          resultsByMethod[methodId].retrieved[query] = [];
        }

        // Add this result to the appropriate query group
        resultsByMethod[methodId].retrieved[query].push({
          text: result.text,
          similarity: result.eval_res?.items[0]?.similarity,
          docTitle: result.metavars?.docTitle,
          chunkId: result.metavars?.chunkId,
        });
      });

      // Update results state
      setResults(resultsByMethod);

      const outputForDownstream: TemplateVarInfo[] = retrievalResults.map(
        (result: any) => ({
          text: result.text,
          prompt: result.prompt,
          fill_history: dict_excluding_key(
            result.fill_history
              ? result.fill_history
              : {
                  ...(result.vars || {}),
                  ...(result.metavars || {}),
                  chunkMethod:
                    result.chunkMethod ??
                    result.vars?.chunkMethod ??
                    result.metavars?.chunkMethod,
                },
            "__input",
          ),
          metavars: result.metavars || {},
          llm: result.llm,
          uid: result.uid || `chunk-${Date.now()}-${Math.random()}`,
        }),
      );

      // Update node data
      setDataPropsForNode(id, {
        methods: methodItems,
        results: resultsByMethod,
        output: outputForDownstream,
      });

      // Notify downstream nodes
      pingOutputNodes(id);
    } catch (error) {
      console.error("Detailed error:", error);
      showAlert?.(error instanceof Error ? error.message : "Retrieval failed");
    } finally {
      setLoading(false);
    }
  }, [
    methodItems,
    id,
    pullInputData,
    setDataPropsForNode,
    pingOutputNodes,
    showAlert,
    apiKeys,
  ]);

  // Update stored data when methods change
  useEffect(() => {
    setDataPropsForNode(id, {
      methods: methodItems,
      results,
    });
  }, [id, methodItems, results, setDataPropsForNode]);

  return (
    <BaseNode nodeId={id} classNames="retrieval-node">
      <NodeLabel
        title={data.title || nodeDefaultTitle}
        nodeId={id}
        icon={nodeIcon}
        status={undefined}
        handleRunClick={confirmAndRunRetrieval}
        runButtonTooltip="Run Retrieval"
      />

      <div>
        <LoadingOverlay visible={loading} />

        {/* Labeled Handle for 'queries' */}
        <div style={{ ...handleWrapperBaseStyle, top: `${HANDLE_Y_START}px` }}>
          <div style={badgeWrapperStyle}>
            <Badge color="indigo" size="md" radius="sm" style={badgeStyle}>
              queries
            </Badge>
          </div>
          <Handle
            type="target"
            position={Position.Left}
            id="queries"
            style={handleStyle} // Style applies to the handle dot
          />
        </div>

        {/* Labeled Handle for 'chunks' */}
        <div
          style={{
            ...handleWrapperBaseStyle,
            top: `${HANDLE_Y_START + HANDLE_Y_GAP}px`,
          }}
        >
          <div style={badgeWrapperStyle}>
            <Badge color="indigo" size="md" radius="sm" style={badgeStyle}>
              chunks
            </Badge>
          </div>
          <Handle
            type="target"
            position={Position.Left}
            id="chunks"
            style={handleStyle} // Style applies to the handle dot
          />
        </div>

        {/* Add margin top to push list below handles */}
        <div style={{ marginTop: `${HANDLE_Y_START + 1 * HANDLE_Y_GAP}px` }}>
          <RetrievalMethodListContainer
            initMethodItems={methodItems}
            onItemsChange={handleMethodsChange}
          />
        </div>
      </div>

      <InspectFooter
        onClick={() => inspectorModalRef.current?.trigger()}
        showDrawerButton={false}
        onDrawerClick={() => undefined}
        isDrawerOpen={false}
        label={
          <>
            Inspect results <IconSearch size="12pt" />
          </>
        }
      />

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ top: "50%" }} // Keep output handle centered vertically
      />

      <React.Suspense fallback={null}>
        <LLMResponseInspectorModal
          ref={inspectorModalRef}
          jsonResponses={jsonResponses}
          customLLMFieldName="Retrieval Method"
          ignoreAndHideLLMField={true}
          ignoreAndHideEvalResField={true}
        />
      </React.Suspense>
      <AreYouSureModal
        ref={retrievalConfirmModalRef}
        title="Confirm Retrieval"
        message={`⚠️ You're about to run all configured retrieval methods.\n\n
          Some methods may create, load, or modify vector stores, which could:\n 
          Overwrite existing data\n or append new data.
          Make sure your settings and input data are correct before proceeding.`}
        onConfirm={runRetrieval}
      />
    </BaseNode>
  );
};
export default RetrievalNode;
