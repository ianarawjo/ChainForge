import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { ActionIcon, Text, TextInput, Tooltip } from "@mantine/core";
import {
  IconEye,
  IconEyeOff,
  IconRefresh,
  IconWorldWww,
} from "@tabler/icons-react";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";
import useStore from "./store";
import NodeLabel from "./NodeLabelComponent";
import BaseNode from "./BaseNode";
import { TemplateVarInfo } from "./backend/typing";

export type IframeNodeData = {
  title?: string;
  url?: string;
  input?: string;
  refresh?: boolean;
  /** When false, the iframe is not mounted (saves load on heavy pages). Default true. */
  renderEmbed?: boolean;
};

function safeEmbedUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function firstOutputToUrlString(
  out: (string | TemplateVarInfo)[] | null,
): string | null {
  if (!out || out.length === 0) return null;
  const x = out[0];
  if (typeof x === "string") return x.trim();
  if (x && typeof x === "object" && "text" in x && x.text !== undefined) {
    const t = x.text;
    return typeof t === "string" ? t.trim() : String(t).trim();
  }
  return null;
}

type IframeNodeProps = NodeProps<IframeNodeData>;

/**
 * Embeds a web page on the canvas for reference. Resize the node to change the viewport.
 * The left target handle accepts a connection whose text output sets the iframe URL.
 */
const IframeNode: React.FC<IframeNodeProps> = ({ data, id, selected }) => {
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);
  const output = useStore((s) => s.output);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const [urlDraft, setUrlDraft] = useState(data.url ?? "");
  const [committedManual, setCommittedManual] = useState(data.url ?? "");
  const [reloadKey, setReloadKey] = useState(0);

  const urlEdge = useMemo(
    () => edges.find((e) => e.target === id && e.targetHandle === "url"),
    [edges, id],
  );

  const wiredUrl = useMemo(() => {
    if (!urlEdge) return null;
    const sh = urlEdge.sourceHandle ?? "output";
    const out = output(urlEdge.source, sh, id, "url");
    return firstOutputToUrlString(out);
  }, [urlEdge, output, id, nodes]);

  const isWired = Boolean(urlEdge);

  useEffect(() => {
    setUrlDraft(data.url ?? "");
    setCommittedManual(data.url ?? "");
  }, [data.url]);

  useEffect(() => {
    if (data.refresh) {
      setDataPropsForNode(id, { refresh: false });
      setReloadKey((k) => k + 1);
    }
  }, [data.refresh, id, setDataPropsForNode]);

  // While connected, upstream output overrides manual URL (persisted on the node).
  useEffect(() => {
    if (!isWired) return;
    const w = wiredUrl ?? "";
    setUrlDraft(w);
    setCommittedManual(w);
    if (w !== (data.url ?? "")) {
      setDataPropsForNode(id, { url: w });
    }
  }, [isWired, wiredUrl, id, setDataPropsForNode, data.url]);

  const effectiveCommitted = isWired ? wiredUrl ?? "" : committedManual;
  const embedSrc = useMemo(
    () => safeEmbedUrl(effectiveCommitted),
    [effectiveCommitted],
  );

  const commitManualUrl = useCallback(() => {
    if (isWired) return;
    const next = urlDraft.trim();
    setCommittedManual(next);
    setDataPropsForNode(id, { url: next });
    setReloadKey((k) => k + 1);
  }, [id, isWired, setDataPropsForNode, urlDraft]);

  const handleReload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const showEmbed = data.renderEmbed !== false;

  const toggleRenderEmbed = useCallback(() => {
    setDataPropsForNode(id, { renderEmbed: !showEmbed });
  }, [id, setDataPropsForNode, showEmbed]);

  return (
    <BaseNode classNames="iframe-node" nodeId={id}>
      <NodeResizer
        minWidth={240}
        minHeight={160}
        maxWidth={1200}
        maxHeight={900}
        isVisible={selected}
        lineStyle={{ borderColor: "var(--mantine-color-gray-5)" }}
      />
      <div className="iframe-node-inner">
        <NodeLabel
          title={data.title || "iFrame Node"}
          nodeId={id}
          icon={<IconWorldWww size="16px" />}
          customButtons={[
            <Tooltip
              key="iframe-preview-toggle"
              label={
                showEmbed
                  ? "Hide live preview (iframe not loaded)"
                  : "Show live preview"
              }
              withArrow
            >
              <button
                type="button"
                onClick={toggleRenderEmbed}
                className="close-button nodrag iframe-node-eye-toggle"
                aria-label={
                  showEmbed ? "Hide iframe preview" : "Show iframe preview"
                }
              >
                {showEmbed ? (
                  <IconEye size={14} stroke={1.5} />
                ) : (
                  <IconEyeOff size={14} stroke={1.5} />
                )}
              </button>
            </Tooltip>,
          ]}
        />
        <div className="iframe-node-url-chrome">
          <Tooltip
            label="Connect a node whose text output sets this URL"
            withArrow
          >
            <Text
              size="xs"
              c="dimmed"
              className="iframe-node-url-icon"
              component="span"
            >
              <IconWorldWww size="12pt" />
            </Text>
          </Tooltip>
          <TextInput
            className="iframe-node-url-field nodrag"
            placeholder={
              isWired ? "URL from connected node" : "Search or enter address"
            }
            value={isWired ? wiredUrl ?? "" : urlDraft}
            onChange={(e) => {
              if (!isWired) setUrlDraft(e.currentTarget.value);
            }}
            onBlur={commitManualUrl}
            onKeyDown={(e) => {
              if (!isWired && e.key === "Enter") commitManualUrl();
            }}
            readOnly={isWired}
            size="xs"
            variant="unstyled"
            styles={{
              root: { flex: 1, minWidth: 0 },
              input: {
                fontFamily:
                  'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                fontSize: 13,
              },
            }}
          />
          <Tooltip label="Reload embed" withArrow>
            <ActionIcon
              className="nodrag"
              variant="subtle"
              size="sm"
              onClick={handleReload}
              aria-label="Reload iframe"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
        <div className="iframe-node-frame-host">
          {embedSrc && showEmbed ? (
            <iframe
              key={`${embedSrc}-${reloadKey}`}
              title={data.title || "Embedded page"}
              src={embedSrc}
              className="iframe-node-frame"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : embedSrc && !showEmbed ? (
            <Text size="sm" c="dimmed" p="md" ta="center" className="nodrag">
              Live preview off — use the eye in the header to load this page.
            </Text>
          ) : (
            <Text size="sm" c="dimmed" p="md" ta="center" className="nodrag">
              {!effectiveCommitted.trim()
                ? isWired
                  ? "No URL yet from the connected node."
                  : "Enter a URL above, then press Enter or blur the field."
                : "Enter a valid http(s) URL."}
            </Text>
          )}
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="url"
        className="grouped-handle grouped-handle-url"
      />
    </BaseNode>
  );
};

export default IframeNode;
