import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import { Status } from "./StatusIndicatorComponent";
import { AlertModalContext } from "./AlertModal";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import useStore from "./store";

import LLMResponseInspectorModal, {
  LLMResponseInspectorModalRef,
} from "./LLMResponseInspectorModal";
import InspectFooter from "./InspectFooter";
import { IconSearch } from "@tabler/icons-react";

import ChunkMethodListContainer, {
  ChunkMethodSpec,
} from "./ChunkMethodListComponent";

import { TemplateVarInfo, LLMResponse } from "./backend/typing";
import { StringLookup } from "./backend/cache";
import { FLASK_BASE_URL } from "./backend/utils";

interface ChunkNodeProps {
  data: {
    title?: string;
    methods?: ChunkMethodSpec[];
    refresh?: boolean;
  };
  id: string;
}

const ChunkNode: React.FC<ChunkNodeProps> = ({ data, id }) => {
  const nodeDefaultTitle = "Chunk Node";
  const nodeIcon = "📄";

  const pullInputData = useStore((s) => s.pullInputData);
  const setDataPropsForNode = useStore((s) => s.setDataPropsForNode);
  const pingOutputNodes = useStore((s) => s.pingOutputNodes);

  const showAlert = useContext(AlertModalContext);

  const [methodItems, setMethodItems] = useState<ChunkMethodSpec[]>(
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

  // Track changes in chunk methods
  const handleMethodItemsChange = useCallback(
    (newItems: ChunkMethodSpec[], _oldItems: ChunkMethodSpec[]) => {
      setMethodItems(newItems);
      setDataPropsForNode(id, { methods: newItems });
      if (status === Status.READY) setStatus(Status.WARNING);
    },
    [id, status, setDataPropsForNode],
  );

  // Truncate string helper
  const truncateString = (str: string, maxLen = 25): string => {
    if (!str) return "";
    if (str.length <= maxLen) return str;
    return `${str.slice(0, 12)}...${str.slice(-10)}`;
  };

  // The main chunking function
  const runChunking = useCallback(async () => {
    const handleError = (msg: string, err?: any) => {
      console.error(msg, err);
      showAlert?.(msg);
      setStatus(Status.ERROR);
    };

    if (methodItems.length === 0) {
      handleError("No chunk methods selected!");
      return;
    }

    // 1) Pull text from upstream (the UploadNode)
    let inputData: { text?: TemplateVarInfo[] } = {};
    try {
      inputData = pullInputData(["text"], id) as { text?: TemplateVarInfo[] };
    } catch (error) {
      handleError("No input text found. Is UploadNode connected?", error);
      return;
    }
    const fileArr = inputData.text || [];
    if (fileArr.length === 0) {
      handleError(
        "No text found. Please attach an UploadNode or provide text.",
      );
      return;
    }

    setStatus(Status.LOADING);
    setJSONResponses([]);

    // We'll group by library to call your chunker
    const allChunksByMethodName: Record<string, TemplateVarInfo[]> = {};
    const allResponsesByMethodName: Record<string, LLMResponse[]> = {};

    // Group methods by library
    const methodsByName = methodItems.reduce(
      (acc, method) => {
        if (!acc[method.name]) acc[method.name] = [];
        acc[method.name].push(method);
        return acc;
      },
      {} as Record<string, ChunkMethodSpec[]>,
    );

    // 2) For each library and each doc
    for (const [name, methods] of Object.entries(methodsByName)) {
      allChunksByMethodName[name] = [];
      allResponsesByMethodName[name] = [];

      for (const fileInfo of fileArr) {
        const docTitle = fileInfo?.metavars?.filename || "Untitled";

        for (const method of methods) {
          try {
            const formData = new FormData();
            formData.append("baseMethod", method.baseMethod);
            formData.append("text", StringLookup.get(fileInfo.text) ?? "");

            // Add the user settings
            Object.entries(method.settings ?? {}).forEach(([k, v]) => {
              formData.append(k, String(v));
            });

            const res = await fetch(`${FLASK_BASE_URL}/chunk`, {
              method: "POST",
              body: formData,
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Chunking request failed");
            }

            const json = await res.json();
            const chunks = json.chunks as string[];

            // We'll build chunk IDs for each doc
            const methodSafe = method.methodType.replace(/\W+/g, "_");
            const libSafe = name.replace(/\W+/g, "_");

            chunks.forEach((cText, index) => {
              const cId = `${methodSafe}_${index}_${libSafe}`;

              // Create the chunk object
              const chunkVar: TemplateVarInfo = {
                text: cText,
                prompt: "",
                fill_history: {
                  chunkMethod: `${method.methodType} (${method.name})`,
                  docTitle,
                  chunkLibrary: name,
                  chunkId: index.toString(),
                },
                llm: undefined,
                metavars: {
                  docTitle,
                  chunkLibrary: name,
                  chunkId: index.toString(),
                },
              };

              allChunksByMethodName[name].push(chunkVar);

              // LLMResponse for inspector
              const respObj: LLMResponse = {
                uid: cId,
                prompt: `Doc: ${docTitle} | Chunk ID: ${truncateString(cId, 25)}`,
                vars: {
                  chunkId: index.toString(),
                  docTitle,
                  chunkLibrary: name,
                },
                responses: [cText],
                llm: method.name,
                metavars: chunkVar.metavars || {},
              };

              allResponsesByMethodName[name].push(respObj);
            });
          } catch (err: any) {
            handleError(
              `Error chunking "${docTitle}" with ${method.name}: ${err.message}`,
              err,
            );
            return;
          }
        }
      }
    }

    // Combine results
    const allChunks = Object.values(allChunksByMethodName).flat();
    const allResponses = Object.values(allResponsesByMethodName).flat();

    // 3) Output data grouped by library
    const groupedOutput = Object.entries(allChunksByMethodName).reduce(
      (acc, [lib, chunks]) => {
        acc[lib] = chunks.map((ch) => ({
          id: ch.metavars?.chunkId,
          docTitle: ch.metavars?.docTitle,
          method: ch.fill_history?.chunkMethod,
          text: ch.text,
        }));
        return acc;
      },
      {} as Record<string, any[]>,
    );

    setDataPropsForNode(id, {
      fields: allChunks,
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
    <BaseNode nodeId={id} classNames="chunk-node">
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "50%" }}
      />

      <NodeLabel
        title={data.title || nodeDefaultTitle}
        nodeId={id}
        icon={nodeIcon}
        status={status}
        handleRunClick={runChunking}
        runButtonTooltip="Perform chunking on input text"
      />

      <ChunkMethodListContainer
        initMethodItems={data.methods || []}
        onItemsChange={handleMethodItemsChange}
      />

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
              Inspect chunks <IconSearch size="12pt" />
            </>
          }
        />
      )}

      {/* The LLM Response Inspector */}
      <LLMResponseInspectorModal
        ref={inspectorRef}
        jsonResponses={jsonResponses}
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

export default ChunkNode;
