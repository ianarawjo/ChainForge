import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import { Badge, Progress } from "@mantine/core";
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
import { FLASK_BASE_URL } from "./backend/utils";
import type { LinkedMethodGroup } from "./RetrievalMethodListComponent";
import { Status } from "./StatusIndicatorComponent";

interface RetrievalNodeProps {
  id: string;
  data: {
    title?: string;
    methods?: RetrievalMethodSpec[];
    results?: Record<string, any>;
    refresh?: boolean;
    linked_groups?: LinkedMethodGroup[];
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
  const [status, setStatus] = useState<Status>(Status.NONE);
  const [runTooltip, setRunTooltip] = useState<string>("Run Retrieval");
  const [confirmMessage, setConfirmMessage] = useState<string>("");
  const [results, setResults] = useState<Record<string, any>>(
    data.results || {},
  );
  const [jsonResponses, setJsonResponses] = useState<LLMResponse[]>([]);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [progressAnimated, setProgressAnimated] = useState(true);
  const pollIntervalRef = useRef<number | null>(null);

  // Fusion            // wire to the Fusion button
  const [linkedGroups, setLinkedGroups] = useState<LinkedMethodGroup[]>([]);

  // Refs
  const inspectorModalRef = useRef<LLMResponseInspectorModalRef>(null);
  const retrievalConfirmModalRef = useRef<AreYouSureModalRef>(null);

  // Every time we click run, this increments. If we click stop, we increment it
  // (invalidating the previous run) and reset the UI.
  const runIdRef = useRef(0);

  const handleStopClick = useCallback(() => {
    // Invalidate the current run by incrementing the ID
    runIdRef.current += 1;

    // Stop the progress polling immediately
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Reset UI State immediately
    setStatus(Status.NONE);
    setProgress(undefined);
    setProgressAnimated(false);
  }, []);

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
      if (status === Status.READY) {
        setStatus(Status.WARNING);
      }
    },
    [id, setDataPropsForNode, status],
  );

  // Confirmation modal for running retrieval
  const confirmAndRunRetrieval = () => {
    // Pull current input data to check counts
    const inputData = pullInputData(["chunks"], id) as { chunks?: any[] };
    const numChunks = inputData.chunks?.length || 0;

    // Check if an embedding model is active
    // We check if the baseMethod is 'vector' or if an embedding provider is set
    const hasEmbeddingModel = methodItems.some(
      (m) => m.baseMethod === "vector" || !!m.embeddingProvider,
    );

    // Construct the base message
    let msg =
      "⚠️ You're about to run all configured retrieval methods. This may create, load, or modify vector stores.";

    if (hasEmbeddingModel && numChunks > 100) {
      msg +=
        ` (🛑 High Volume Warning: You are running an embedding model on ${numChunks} ` +
        "chunks. This will generate embeddings for all chunks that haven't already been embedded in previous runs of the " +
        "retriever, which may be slow and incur costs.)";
    }

    setConfirmMessage(msg);
    retrievalConfirmModalRef.current?.trigger();
  };

  // Main retrieval function
  const runRetrieval = useCallback(async () => {
    if (methodItems.length === 0) {
      showAlert?.("Please add at least one retrieval method");
      return;
    }
    const currentRunId = runIdRef.current;

    // Setup UI for loading
    setStatus(Status.LOADING);
    setProgress(5); // Start at 5%
    setProgressAnimated(true);

    // Start Polling the "Faked" Endpoint
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const resp = await fetch(`${FLASK_BASE_URL}getRetrieveProgress`);
        if (currentRunId !== runIdRef.current) return;
        const data = await resp.json();

        let currentProgress = 0;
        if (typeof data === "number") {
          currentProgress = data;
        } else if (data && typeof data === "object") {
          // Sum all values in the object (assuming they are numbers representing % completion)
          const values = Object.values(data) as number[];
          currentProgress = values.reduce(
            (acc, val) => acc + (typeof val === "number" ? val : 0),
            0,
          );
        }

        // Clamp between 5 and 95 so it doesn't look finished until it actually is
        setProgress(Math.min(95, Math.max(5, currentProgress)));
      } catch (e) {
        console.warn("Could not fetch progress", e);
      }
    }, 500);

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
      if (!inputData.chunks || inputData.chunks.length === 0) {
        throw new Error("Input 'chunks' is missing or empty.");
      }
      if (!inputData.queries || inputData.queries.length === 0) {
        throw new Error("Input 'queries' is missing or empty.");
      }

      console.log("Chunks:", inputData.chunks);

      // Make the API request
      const response = await fetch(`${FLASK_BASE_URL}retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methods: formattedMethods,
          chunks: inputData.chunks,
          queries: inputData.queries,
          api_keys: apiKeys,
          fusion_enabled: linkedGroups.length > 0,
          linked_groups: linkedGroups.length > 0 ? linkedGroups : [],
        }),
      });

      if (currentRunId !== runIdRef.current) {
        console.log("Retrieval result ignored (stopped by user).");
        return;
      }

      if (!response.ok) {
        const body = await response.json();
        const message =
          body && typeof body.error === "string"
            ? body.error
            : `Retrieval failed: ${response.statusText}`;

        throw new Error(message);
      }

      // The response is now a flat array of objects
      const retrievalResults = await response.json();
      if (currentRunId !== runIdRef.current) return;

      // --- Hide individual members of fused groups; keep only the fused column ---
      const fusedMemberIds = new Set(
        (linkedGroups || []).flatMap((g) => g.methodKeys || []),
      );

      const filteredResults =
        linkedGroups.length > 0
          ? retrievalResults.filter((r: any) => {
              const mid = r?.metavars?.methodId;
              if (!mid) return true;
              if (typeof mid === "string" && mid.startsWith("group:"))
                return true; // fused rows
              return !fusedMemberIds.has(mid); // drop members of fused groups
            })
          : retrievalResults;

      console.warn("Retrieval results:", filteredResults);

      // Convert to proper LLMResponse objects
      const llmResponses: LLMResponse[] = filteredResults.map(
        (result: any) => ({
          uid: result.uid || `retrieval-${Date.now()}-${Math.random()}`,
          prompt: result.prompt,
          vars: result.vars || {},
          metavars: result.metavars || {},
          responses: [result.text],
          eval_res: result.eval_res || [],
          llm: result.vars.retrievalMethod || "Unknown", // We are abusing 'llm' to store the retrieval method
          // llm: result.llm || "Unknown Method",
        }),
      );

      // Set the responses for the inspector
      setJsonResponses(llmResponses);

      // Group results by method for the node's internal state
      const resultsByMethod: Record<string, any> = {};

      // Process each result to organize by method
      filteredResults.forEach((result: any) => {
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
              latency: result.metavars?.latency_ms,
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

      const outputForDownstream: TemplateVarInfo[] = filteredResults.map(
        (result: any) => ({
          text: result.text,
          prompt: result.prompt,
          fill_history: result.vars || {},
          metavars: result.metavars || {},
          llm: result.llm, // Should we call this 'method' instead?
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
      setStatus(Status.READY);
    } catch (error) {
      // Only show error if we weren't stopped
      if (currentRunId === runIdRef.current) {
        console.error("Detailed error:", error);
        showAlert?.(
          error instanceof Error ? error.message : "Retrieval failed",
        );
        setStatus(Status.ERROR);
      }
    } finally {
      // Only run cleanup if this is still the active run
      // (If we stopped, handleStopClick already cleaned up)
      if (currentRunId === runIdRef.current) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setProgress(100);
        setProgressAnimated(false);
        setTimeout(() => {
          // Check one last time before clearing UI
          if (currentRunId === runIdRef.current) {
            setProgress(undefined);
          }
        }, 2000);
      }
    }
  }, [
    methodItems,
    id,
    pullInputData,
    setDataPropsForNode,
    pingOutputNodes,
    showAlert,
    apiKeys,
    linkedGroups,
  ]);

  // Update stored data when methods change
  useEffect(() => {
    setDataPropsForNode(id, {
      methods: methodItems,
      results,
    });
  }, [id, methodItems, results, setDataPropsForNode]);

  const handleRunHover = useCallback(() => {
    if (status === Status.LOADING) return;

    try {
      // Pull data from inputs without processing (just to count)
      const inputData = pullInputData(["chunks", "queries"], id) as {
        chunks?: any[];
        queries?: any[];
      };

      const numChunks = inputData.chunks?.length || 0;
      const numQueries = inputData.queries?.length || 0;
      const numMethods = methodItems.length;

      if (numMethods === 0) {
        setRunTooltip("Please add a retrieval method first.");
      } else if (numChunks === 0 || numQueries === 0) {
        setRunTooltip("Connect 'chunks' and 'queries' inputs.");
      } else {
        setRunTooltip(
          `Will run ${numMethods} method(s) for ${numQueries} queries against ${numChunks} chunks.`,
        );
      }
    } catch (err) {
      console.error(err);
      setRunTooltip("Error checking inputs.");
    }
  }, [pullInputData, id, status, methodItems]);

  return (
    <BaseNode nodeId={id} classNames="retrieval-node">
      <NodeLabel
        title={data.title || nodeDefaultTitle}
        nodeId={id}
        icon={nodeIcon}
        status={status}
        isRunning={status === Status.LOADING} // Tells NodeLabel to show the Stop button
        handleRunClick={confirmAndRunRetrieval}
        handleStopClick={handleStopClick}
        handleRunHover={handleRunHover}
        runButtonTooltip={runTooltip}
      />

      <div>
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
            initLinkedGroups={data.linked_groups ?? []}
            initMethodItems={methodItems}
            onItemsChange={handleMethodsChange}
            onGroupsChange={(groups) => {
              setLinkedGroups(groups);
              setDataPropsForNode(id, { linked_groups: groups });
            }}
            methodResults={results}
          />
        </div>
      </div>

      {progress !== undefined && (
        <div style={{ paddingBottom: "12px" }}>
          <Progress
            size="md" // Define the height of the progress bar
            radius="xl" // Gives it fully rounded "pill" edges
            striped // Adds the diagonal stripes texture
            animate={progressAnimated} // Makes the stripes move
            sections={[
              {
                value: progress,
                color: "blue",
                tooltip: "Retrieving documents...",
              },
            ]}
          />
          {/* Add a small text label below */}
          <div
            style={{
              textAlign: "center",
              fontSize: "10px",
              color: "#666",
              marginTop: "4px",
            }}
          >
            {Math.round(progress)}%
          </div>
        </div>
      )}

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
          defaultTableColVar="retrievalMethod"
        />
      </React.Suspense>
      <AreYouSureModal
        ref={retrievalConfirmModalRef}
        title="Confirm Retrieval"
        message={confirmMessage}
        onConfirm={runRetrieval}
      />
    </BaseNode>
  );
};
export default RetrievalNode;
