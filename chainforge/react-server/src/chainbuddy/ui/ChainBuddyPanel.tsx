/**
 * ChainBuddy's chat panel, in the bottom-right corner of the canvas. The one
 * piece of ChainBuddy the app mounts (inside <ReactFlow>, see App.tsx).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Panel, useReactFlow } from "reactflow";
import MarkdownIt from "markdown-it";
import {
  ActionIcon,
  Alert,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import {
  IconMessageChatbot,
  IconPlayerStop,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Proposal, StoreCanvas } from "../adapters/canvas";
import { useChainBuddyModel } from "../adapters/settings";
import { createFlowTools } from "../flowApi/tools";
import { INSTRUCTIONS, NODE_DOCS } from "../knowledge";
import { createOpenAICompatibleClient } from "../model/openaiCompatible";
import { AgentMessage } from "../model/types";
import { AgentEvent, runAgent } from "../runtime/agentLoop";
import ProposalCard from "./ProposalCard";
import "./chainbuddy.css";

// html: false escapes any HTML in model output, so it can't inject markup.
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });

// Above the app's "Send us feedback" link, which is fixed to the bottom-right
// corner of the window.
const PANEL_STYLE = { marginBottom: 48 };

type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "activity"; text: string; failed?: boolean; detail?: string }
  | { kind: "proposal"; id: string }
  | { kind: "error"; text: string };

/** How a tool call reads in the chat. */
function activityText(
  name: string,
  args: string,
  ok: boolean,
  content: string,
) {
  if (!ok) return `A ${name} call went wrong; retrying`;
  if (name === "get_flow") return "Read the canvas";
  if (name === "list_models") return "Checked which models are set up";
  if (name === "describe_node") {
    try {
      return `Read the ${JSON.parse(args).type} node guide`;
    } catch {
      return "Read a node guide";
    }
  }
  if (name === "propose_changes")
    return content.includes('"invalid"')
      ? "Found problems with its proposal; fixing them"
      : "";
  return name;
}

export default function ChainBuddyPanel() {
  const model = useChainBuddyModel();
  const reactFlow = useReactFlow();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const conversation = useRef<AgentMessage[]>([]);
  const abort = useRef<AbortController | null>(null);
  // Accepts and rejects to mention to the model on the next message.
  const decisions = useRef<string[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  // Proposal ids already in the chat, and tool call arguments by call id.
  const shownProposals = useRef(new Set<string>());
  const callArgs = useRef(new Map<string, string>());

  const canvas = useMemo(
    () =>
      new StoreCanvas({
        onProposal: (p) => {
          setProposals((prev) => ({ ...prev, [p.id]: p }));
          if (!shownProposals.current.has(p.id)) {
            shownProposals.current.add(p.id);
            setItems((its) => [...its, { kind: "proposal", id: p.id }]);
          }
          if (p.status === "accepted" || p.status === "rejected")
            decisions.current.push(`The user ${p.status} ${p.id}.`);
        },
        onFocus: (ids) =>
          setTimeout(
            () =>
              reactFlow.fitView({
                nodes: ids.map((id) => ({ id })),
                padding: 0.4,
                duration: 400,
                maxZoom: 1,
              }),
            60,
          ),
      }),
    [reactFlow],
  );
  const { tools, startTurn } = useMemo(
    () => createFlowTools({ canvas, nodeDocs: NODE_DOCS }),
    [canvas],
  );
  // Nodes on the canvas when ChainBuddy last replied, to notice another flow.
  const seenNodes = useRef(new Set<string>());
  const nodeIds = () => canvas.readFlow().nodes.map((n) => n.id);
  // The nodes an accepted proposal leaves count as seen too, so accepting
  // one that replaces every node isn't taken for opening another flow.
  const handledAccepts = useRef(new Set<string>());
  useEffect(() => {
    for (const p of Object.values(proposals))
      if (p.status === "accepted" && !handledAccepts.current.has(p.id)) {
        handledAccepts.current.add(p.id);
        nodeIds().forEach((id) => seenNodes.current.add(id));
      }
  }, [proposals]);

  // Proposed nodes left over from a flow saved mid-proposal were never
  // accepted, so they go.
  useEffect(() => canvas.removeOrphans(), [canvas]);

  // Keep the newest message in view.
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight });
  }, [items, status]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || running || !model.config) return;
    setDraft("");

    // None of the nodes it saw are left: another flow is open. What the model
    // remembers is about the old one, so start the conversation over.
    const ids = nodeIds();
    if (
      conversation.current.length > 0 &&
      seenNodes.current.size > 0 &&
      !ids.some((id) => seenNodes.current.has(id))
    ) {
      for (const p of Object.values(proposals))
        if (p.status === "pending") canvas.reject(p.id);
      conversation.current = [];
      decisions.current = [];
      setItems((its) => [
        ...its,
        {
          kind: "activity",
          text: "The canvas shows a different flow now, so ChainBuddy started a new conversation.",
        },
      ]);
    }
    setItems((its) => [...its, { kind: "user", text }]);
    startTurn();

    // Tell the model what the user did with its proposals since it last spoke.
    const note = decisions.current.length
      ? `[${decisions.current.join(" ")}]\n\n`
      : "";
    decisions.current = [];
    const userMessage: AgentMessage = { role: "user", content: note + text };

    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setStatus("Thinking…");
    let streaming = false; // whether the last item is text still arriving
    const onEvent = (e: AgentEvent) => {
      if (e.type === "text") {
        setStatus(null);
        setItems((its) => {
          const last = its[its.length - 1];
          if (streaming && last?.kind === "assistant")
            return [
              ...its.slice(0, -1),
              { ...last, text: last.text + e.delta },
            ];
          return [...its, { kind: "assistant", text: e.delta }];
        });
        streaming = true;
      } else if (e.type === "reasoning") setStatus("Thinking…");
      else if (e.type === "tool_call_start") {
        streaming = false;
        setStatus("Working…");
      } else if (e.type === "tool_call") {
        callArgs.current.set(e.call.id, e.call.arguments);
      } else if (e.type === "tool_result") {
        const line = activityText(
          e.name,
          callArgs.current.get(e.callId) ?? "",
          e.ok,
          e.content,
        );
        if (line)
          setItems((its) => [
            ...its,
            { kind: "activity", text: line, failed: !e.ok, detail: e.content },
          ]);
      } else if (e.type === "step_finish") {
        streaming = false;
        setStatus("Thinking…");
      }
    };

    try {
      const client = createOpenAICompatibleClient(model.config);
      const result = await runAgent({
        client,
        system: INSTRUCTIONS,
        messages: [...conversation.current, userMessage],
        tools,
        maxSteps: 12,
        signal: controller.signal,
        onEvent,
      });
      conversation.current = [
        ...conversation.current,
        userMessage,
        ...result.messages,
      ];
      seenNodes.current = new Set(nodeIds());
      const ending: Record<string, string | undefined> = {
        done: undefined,
        cancelled: "Stopped.",
        length: "The model's reply was cut off by its length limit.",
        max_steps:
          "Stopped: the model kept working without finishing. Try a simpler request.",
        error: result.error,
      };
      const message = ending[result.stopReason];
      if (message)
        setItems((its) => [
          ...its,
          result.stopReason === "cancelled"
            ? { kind: "activity", text: message }
            : { kind: "error", text: message },
        ]);
    } catch (err) {
      setItems((its) => [
        ...its,
        {
          kind: "error",
          text: err instanceof Error ? err.message : String(err),
        },
      ]);
    } finally {
      abort.current = null;
      setRunning(false);
      setStatus(null);
    }
  }, [draft, running, model.config, tools, startTurn, proposals]);

  const clear = () => {
    abort.current?.abort();
    for (const p of Object.values(proposals))
      if (p.status === "pending") canvas.reject(p.id);
    conversation.current = [];
    decisions.current = [];
    seenNodes.current = new Set();
    setItems([]);
  };

  if (!model.enabled) return null;

  if (!open)
    return (
      <Panel position="bottom-right" style={PANEL_STYLE}>
        <Tooltip label="ChainBuddy" position="left" withArrow>
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="grape"
            onClick={() => setOpen(true)}
            aria-label="Open ChainBuddy"
          >
            <IconMessageChatbot size={24} />
          </ActionIcon>
        </Tooltip>
      </Panel>
    );

  return (
    <Panel position="bottom-right" style={PANEL_STYLE}>
      <Paper
        withBorder
        shadow="md"
        radius="md"
        className="chainbuddy-panel nowheel nodrag"
      >
        <Group
          position="apart"
          px="sm"
          py={8}
          noWrap
          style={{
            borderBottom:
              "1px solid var(--mantine-color-default-border, #e9ecef)",
          }}
        >
          <Box>
            <Text size="sm" weight={600}>
              ChainBuddy
            </Text>
            <Text size="xs" color="dimmed" lineClamp={1}>
              {model.label}
            </Text>
          </Box>
          <Group spacing={4} noWrap>
            <Tooltip label="Start over" withArrow>
              <ActionIcon size="sm" onClick={clear} aria-label="Start over">
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon
              size="sm"
              onClick={() => setOpen(false)}
              aria-label="Close ChainBuddy"
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <ScrollArea style={{ flex: 1 }} viewportRef={viewport} px="sm">
          <Stack spacing={8} py="sm">
            {items.length === 0 && (
              <Text size="xs" color="dimmed">
                Ask ChainBuddy to build or change a flow, such as &quot;Compare
                two models summarizing three short texts, and check each summary
                is one sentence.&quot; It proposes changes on the canvas;
                nothing changes until you accept, and it never runs anything.
              </Text>
            )}
            {items.map((item, i) => (
              <ItemView
                key={i}
                item={item}
                proposal={
                  item.kind === "proposal" ? proposals[item.id] : undefined
                }
                onAccept={(id) => canvas.accept(id)}
                onReject={(id) => canvas.reject(id)}
              />
            ))}
            {status && (
              <Group spacing={6}>
                <Loader size="xs" color="grape" />
                <Text size="xs" color="dimmed">
                  {status}
                </Text>
              </Group>
            )}
          </Stack>
        </ScrollArea>

        <Box
          p="xs"
          style={{
            borderTop: "1px solid var(--mantine-color-default-border, #e9ecef)",
          }}
        >
          {model.problem ? (
            <Alert color="grape" variant="light" p="xs">
              <Text size="xs">{model.problem}</Text>
            </Alert>
          ) : (
            <Group spacing={6} noWrap align="flex-end">
              <Textarea
                style={{ flex: 1 }}
                size="xs"
                autosize
                minRows={1}
                maxRows={5}
                placeholder="Add a second prompt wording for a ten-year-old"
                value={draft}
                onChange={(e) => setDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              {running ? (
                <ActionIcon
                  size="lg"
                  variant="default"
                  onClick={() => abort.current?.abort()}
                  aria-label="Stop"
                >
                  <IconPlayerStop size={16} />
                </ActionIcon>
              ) : (
                <ActionIcon
                  size="lg"
                  variant="filled"
                  color="grape"
                  onClick={send}
                  disabled={!draft.trim()}
                  aria-label="Send"
                >
                  <IconSend size={16} />
                </ActionIcon>
              )}
            </Group>
          )}
        </Box>
      </Paper>
    </Panel>
  );
}

function ItemView({
  item,
  proposal,
  onAccept,
  onReject,
}: {
  item: Item;
  proposal?: Proposal;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (item.kind === "user")
    return (
      <Box
        ml="auto"
        maw="85%"
        px={10}
        py={6}
        style={{ borderRadius: 8, background: "rgba(134, 142, 150, 0.12)" }}
      >
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {item.text}
        </Text>
      </Box>
    );
  if (item.kind === "assistant")
    return (
      <Box
        className="chainbuddy-markdown"
        style={{ fontSize: 14 }}
        dangerouslySetInnerHTML={{ __html: markdown.render(item.text) }}
      />
    );
  if (item.kind === "activity")
    return (
      <Tooltip
        label={item.detail?.slice(0, 600)}
        disabled={!item.failed}
        multiline
        maw={320}
        withinPortal
      >
        <Text size="xs" color={item.failed ? "orange" : "dimmed"}>
          {item.text}
        </Text>
      </Tooltip>
    );
  if (item.kind === "error")
    return (
      <Alert color="red" variant="light" p="xs">
        <Text size="xs">{item.text}</Text>
      </Alert>
    );
  if (!proposal) return null;
  return (
    <ProposalCard
      proposal={proposal}
      onAccept={() => onAccept(proposal.id)}
      onReject={() => onReject(proposal.id)}
    />
  );
}
