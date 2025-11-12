import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import { Badge } from "@mantine/core";
import { Status } from "./StatusIndicatorComponent";
import { AlertModalContext } from "./AlertModal";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import useStore from "./store";

import LLMResponseInspectorModal, {
  LLMResponseInspectorModalRef,
} from "./LLMResponseInspectorModal";
import InspectFooter from "./InspectFooter";
import { IconSearch, IconSortAscending } from "@tabler/icons-react";

import RerankMethodListContainer, {
  RerankMethodSpec,
} from "./RerankMethodListComponent";

import { TemplateVarInfo, LLMResponse } from "./backend/typing";
import { StringLookup } from "./backend/cache";
import { FLASK_BASE_URL } from "./backend/utils";
import { v4 as uuid } from "uuid";

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

interface RerankNodeProps {
  data: {
    title?: string;
    methods?: RerankMethodSpec[];
    refresh?: boolean;
  };
  id: string;
}

const RerankNode: React.FC<RerankNodeProps> = ({ data, id }) => {
  const nodeDefaultTitle = "Rerank Node";
  const nodeIcon = <IconSortAscending size={16} />;

  const pullInputData = useStore((s) => s.pullInputData);
  const setDataPropsForNode = useStore((s) => s.setDataPropsForNode);
  const pingOutputNodes = useStore((s) => s.pingOutputNodes);
  const apiKeys = useStore((s) => s.apiKeys);

  const showAlert = useContext(AlertModalContext);

  const [methodItems, setMethodItems] = useState<RerankMethodSpec[]>(
    data.methods || [],
  );
  const [status, setStatus] = useState<Status>(Status.NONE);
  const [jsonResponses, setJSONResponses] = useState<LLMResponse[]>([]);

  const inspectorRef = useRef<LLMResponseInspectorModalRef>(null);

  // On refresh
  useEffect(() => {
    if (data.refresh) {
      setDataPropsForNode(id, { refresh: false, fields: [], output: [] });
      setJSONResponses([]);
      setStatus(Status.NONE);
    }
  }, [data.refresh, id, setDataPropsForNode]);

  // Track changes in rerank methods
  const handleMethodItemsChange = useCallback(
    (newItems: RerankMethodSpec[], _oldItems: RerankMethodSpec[]) => {
      setMethodItems(newItems);
      setDataPropsForNode(id, { methods: newItems });
      if (status === Status.READY) setStatus(Status.WARNING);
    },
    [id, status, setDataPropsForNode],
  );

  // The main reranking function
  const runReranking = useCallback(async () => {
    const handleError = (msg: string, err?: any) => {
      console.error(msg, err);
      showAlert?.(msg);
      setStatus(Status.ERROR);
    };

    if (methodItems.length === 0) {
      handleError("No reranking methods selected!");
      return;
    }

    // 1) Pull data from upstream (chunks from ChunkNode or RetrievalNode, and query)
    let inputData: {
      chunks?: TemplateVarInfo[];
      query?: TemplateVarInfo[];
      text?: TemplateVarInfo[];
    } = {};

    try {
      inputData = pullInputData(["chunks", "query", "text"], id) as {
        chunks?: TemplateVarInfo[];
        query?: TemplateVarInfo[];
        text?: TemplateVarInfo[];
      };
    } catch (error) {
      handleError(
        "No input data found. Is a ChunkNode or RetrievalNode connected?",
        error,
      );
      return;
    }

    // Use chunks if available, otherwise fall back to text
    const documentsArr = inputData.chunks || inputData.text || [];
    const queryArr = inputData.query || [];

    if (documentsArr.length === 0) {
      handleError(
        "No documents found. Please attach a ChunkNode, RetrievalNode, or provide text.",
      );
      return;
    }

    // Validate that documents have valid text
    const validDocuments = documentsArr.filter(
      (doc) => doc && doc.text && StringLookup.get(doc.text),
    );

    if (validDocuments.length === 0) {
      handleError(
        "No valid documents with text found. Please check your input data.",
      );
      return;
    }

    setStatus(Status.LOADING);
    setJSONResponses([]);

    // We'll group by method name to call the reranker
    const allReranksByMethodName: Record<string, TemplateVarInfo[]> = {};
    const allResponsesByMethodName: Record<string, LLMResponse[]> = {};

    // Group methods by name
    const methodsByName = methodItems.reduce(
      (acc, method) => {
        if (!acc[method.name]) acc[method.name] = [];
        acc[method.name].push(method);
        return acc;
      },
      {} as Record<string, RerankMethodSpec[]>,
    );

    // 2) For each method and each query (if available)
    for (const [name, methods] of Object.entries(methodsByName)) {
      allReranksByMethodName[name] = [];
      allResponsesByMethodName[name] = [];

      // If we have queries, rerank for each query
      // Otherwise, rerank all documents together
      const queriesToProcess = queryArr.length > 0 ? queryArr : [null];

      for (const queryInfo of queriesToProcess) {
        const query =
          queryInfo && queryInfo.text
            ? StringLookup.get(queryInfo.text) || ""
            : "";

        for (const method of methods) {
          try {
            const formData = new FormData();
            formData.append("baseMethod", method.baseMethod);

            // Add documents as a JSON array
            const documents = validDocuments.map(
              (doc) => StringLookup.get(doc.text) || "",
            );
            formData.append("documents", JSON.stringify(documents));

            // Add query if available
            if (query) {
              formData.append("query", query);
            } else {
              console.warn(
                `Warning: No query found when preparing payload for reranking with method ${method.name}. Proceeding without 'query' component. Results will be suboptimal.`,
              );
            }

            // Add the user settings
            Object.entries(method.settings ?? {}).forEach(([k, v]) => {
              formData.append(k, String(v));
            });

            // Add API keys
            if (apiKeys) {
              formData.append("api_keys", JSON.stringify(apiKeys));
            }

            const res = await fetch(`${FLASK_BASE_URL}rerank`, {
              method: "POST",
              body: formData,
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Reranking request failed");
            }

            const json = await res.json();
            const rerankedResults =
              json.reranked_documents || json.results || [];

            // Process reranked results
            const methodSafe = method.methodType.replace(/\W+/g, "_");
            const querySafe = query
              ? query.slice(0, 20).replace(/\W+/g, "_")
              : "no_query";

            rerankedResults.forEach((result: any, index: number) => {
              const rId = uuid();

              // Extract text and score from result
              let resultText = "";
              let score = 0;

              if (typeof result === "string") {
                resultText = result;
                score = 1.0 - index / rerankedResults.length; // Synthetic score based on rank
              } else if (result.document || result.text) {
                resultText = result.document || result.text;
                score =
                  result.score ||
                  result.relevance_score ||
                  1.0 - index / rerankedResults.length;
              } else {
                resultText = String(result);
                score = 1.0 - index / rerankedResults.length;
              }

              // Create the reranked document object
              const rerankVar: TemplateVarInfo = {
                text: resultText,
                prompt: query || "N/A",
                fill_history: {
                  rerankMethod: `${method.methodType} (${method.name})`,
                  query: query || "N/A",
                  originalRank: index,
                  score: String(score),
                },
                llm: method.name,
                metavars: {
                  query: query || "N/A",
                  rerankMethod: method.methodType,
                  originalRank: index,
                  score: score,
                },
              };

              allReranksByMethodName[name].push(rerankVar);

              // LLMResponse for inspector
              const respObj: LLMResponse = {
                uid: rId,
                prompt: `Query: ${query || "N/A"} | Rank: ${index + 1} | Score: ${score.toFixed(3)}`,
                vars: {
                  query: query || "N/A",
                  rank: String(index + 1),
                  score: String(score.toFixed(3)),
                },
                responses: [resultText],
                llm: method.name,
                metavars: rerankVar.metavars || {},
              };

              allResponsesByMethodName[name].push(respObj);
            });
          } catch (err: any) {
            handleError(
              `Error reranking with ${method.name}: ${err.message}`,
              err,
            );
            return;
          }
        }
      }
    }

    // Combine results
    const allReranks = Object.values(allReranksByMethodName).flat();
    const allResponses = Object.values(allResponsesByMethodName).flat();

    // 3) Output data grouped by method
    const groupedOutput = Object.entries(allReranksByMethodName).reduce(
      (acc, [method, reranks]) => {
        acc[method] = reranks.map((rr) => ({
          rank: rr.metavars?.originalRank,
          query: rr.metavars?.query,
          score: rr.metavars?.score,
          method: rr.fill_history?.rerankMethod,
          text: rr.text,
        }));
        return acc;
      },
      {} as Record<string, any[]>,
    );

    setDataPropsForNode(id, {
      fields: allReranks,
      output: groupedOutput,
    });
    pingOutputNodes(id);

    setJSONResponses(allResponses);
    setStatus(Status.READY);
  }, [
    id,
    methodItems,
    pullInputData,
    setDataPropsForNode,
    showAlert,
    pingOutputNodes,
  ]);

  // Open inspector
  const openInspector = () => {
    if (jsonResponses.length > 0 && inspectorRef.current) {
      inspectorRef.current.trigger();
    }
  };

  return (
    <BaseNode nodeId={id} classNames="rerank-node">
      <NodeLabel
        title={data.title || nodeDefaultTitle}
        nodeId={id}
        icon={nodeIcon}
        status={status}
        handleRunClick={runReranking}
        runButtonTooltip="Perform reranking on input documents"
      />

      <div>
        {/* Labeled Handle for 'chunks' */}
        <div style={{ ...handleWrapperBaseStyle, top: `${HANDLE_Y_START}px` }}>
          <div style={badgeWrapperStyle}>
            <Badge color="green" size="md" radius="sm" style={badgeStyle}>
              chunks
            </Badge>
          </div>
          <Handle
            type="target"
            position={Position.Left}
            id="chunks"
            style={handleStyle}
          />
        </div>

        {/* Labeled Handle for 'query' */}
        <div
          style={{
            ...handleWrapperBaseStyle,
            top: `${HANDLE_Y_START + HANDLE_Y_GAP}px`,
          }}
        >
          <div style={badgeWrapperStyle}>
            <Badge color="indigo" size="md" radius="sm" style={badgeStyle}>
              query
            </Badge>
          </div>
          <Handle
            type="target"
            position={Position.Left}
            id="query"
            style={handleStyle}
          />
        </div>

        {/* Add margin top to push list below handles */}
        <div style={{ marginTop: `${HANDLE_Y_START + 1 * HANDLE_Y_GAP}px` }}>
          <RerankMethodListContainer
            initMethodItems={data.methods || []}
            onItemsChange={handleMethodItemsChange}
          />
        </div>
      </div>

      {jsonResponses && jsonResponses.length > 0 && (
        <InspectFooter
          onClick={openInspector}
          showDrawerButton={false}
          onDrawerClick={() => {
            // Do nothing
          }}
          isDrawerOpen={false}
          label={
            <>
              Inspect reranked docs <IconSearch size="12pt" />
            </>
          }
        />
      )}

      {/* The LLM Response Inspector */}
      <LLMResponseInspectorModal
        ref={inspectorRef}
        jsonResponses={jsonResponses}
        customLLMFieldName="Rerank Method"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ top: "50%" }}
      />
    </BaseNode>
  );
};

export default RerankNode;
