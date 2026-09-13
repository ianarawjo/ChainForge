/**
 * Chat with a RAG pipeline, without re-running it by hand for every question.
 *
 * Building a RAG flow in ChainForge makes each stage visible, which is what
 * makes it good for teaching. But asking it a new question meant adding a row
 * to a Tabular node, re-running Retrieval, Rerank and the Prompt node, then
 * opening an inspector -- too slow to explore with. This node sits where
 * queries enter a pipeline, in place of that Tabular node: type a question,
 * and it runs everything downstream and shows the answers.
 *
 * It drives the flow's real nodes (runDownstream.ts) instead of computing the
 * answer separately, so the chat can never disagree with the pipeline beside
 * it. Upstream work is untouched: a new question does not re-chunk anything.
 *
 * When the flow compares configurations, every answer is shown and labelled
 * with the configuration that produced it. With a single configuration it
 * reads like an ordinary chat.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import {
  Badge,
  Button,
  Collapse,
  Group,
  Loader,
  ScrollArea,
  Text,
  Textarea,
  UnstyledButton,
} from "@mantine/core";
import { v4 as uuid } from "uuid";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import useStore from "./store";
import { Status } from "./StatusIndicatorComponent";
import { runDownstreamOf } from "./runDownstream";
import { llmResponseDataToString } from "./backend/utils";
import { escapeBraces } from "./backend/template";
import { NodeRunResult } from "./backend/runGraph";
import {
  ChatAnswer,
  ChatTurn,
  PromptOutputLike,
  answerLabel,
  answeringNodeIds,
  buildChatTurn,
  explainTurn,
  groupAgreeingAnswers,
  progressMessage,
  splitAnswerLabels,
} from "./backend/ragChat";

/**
 * How many turns are saved with the flow. Each answer keeps the context it was
 * given, which can run to kilobytes, and flows are autosaved; without a cap a
 * long session would grow the saved flow without limit.
 */
const MAX_SAVED_TURNS = 50;

/** Titles for nodes that were never renamed, for failure messages. */
const DEFAULT_TITLES: Record<string, string> = {
  upload: "Upload Node",
  chunk: "Chunk Node",
  retrieval: "Retrieval Node",
  rerank: "Rerank Node",
  join: "Join Node",
  prompt: "Prompt Node",
  chat: "Chat Turn Node",
};

export interface RagChatNodeProps {
  data: {
    title?: string;
    query?: string;
    history?: ChatTurn[];
  };
  id: string;
}

const resolveText = (value: unknown): string | undefined =>
  value === undefined || value === null
    ? undefined
    : llmResponseDataToString(
        value as Parameters<typeof llmResponseDataToString>[0],
      );

const RagChatNode: React.FC<RagChatNodeProps> = ({ data, id }) => {
  const setDataPropsForNode = useStore((s) => s.setDataPropsForNode);
  const edges = useStore((s) => s.edges);

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>(data.history ?? []);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [pendingQuery, setPendingQuery] = useState("");
  const [status, setStatus] = useState<Status>(Status.NONE);
  const [openContext, setOpenContext] = useState<Record<string, boolean>>({});

  // Refs, because send() finishes long after the render that started it.
  const historyRef = useRef(history);
  const cancelRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isConnected = edges.some((e) => e.source === id);

  // Keep the newest turn in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, running]);

  const saveHistory = useCallback(
    (next: ChatTurn[]) => {
      const trimmed = next.slice(-MAX_SAVED_TURNS);
      historyRef.current = trimmed;
      setHistory(trimmed);
      setDataPropsForNode(id, { history: trimmed as any });
    },
    [id, setDataPropsForNode],
  );

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || running || !isConnected) return;

    // Braces are escaped as the Tabular node does, so a question containing
    // "{" is not read as a template variable by the Prompt node downstream.
    const asSent = escapeBraces(question);

    cancelRef.current = false;
    setRunning(true);
    setStatus(Status.LOADING);
    setPendingQuery(question);
    setProgress("Starting…");
    setInput("");

    // Write the question as this node's output before running anything. It
    // must be in the store already when Retrieval pulls its queries; a node
    // that synced its output in an effect would still hand over the previous
    // question.
    setDataPropsForNode(id, {
      query: question,
      fields: [
        { text: asSent, fill_history: {}, metavars: {}, uid: uuid() },
      ] as any,
    });

    const askedAt = Date.now();
    let results: NodeRunResult[];
    try {
      results = await runDownstreamOf(id, {
        shouldCancel: () => cancelRef.current,
        onNodeStart: (nodeId) =>
          setProgress(
            progressMessage(useStore.getState().getNode(nodeId)?.type),
          ),
      });
    } catch (err) {
      // A cycle downstream, for instance: there is no order to run in.
      results = [
        {
          nodeId: id,
          outcome: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
      ];
    }

    const state = useStore.getState();
    const typeOf = (nodeId: string) => state.getNode(nodeId)?.type;
    const nodeLabel = (nodeId: string) => {
      const node = state.getNode(nodeId);
      if (nodeId === id) return "This chat";
      const title = node?.data?.title;
      return typeof title === "string" && title.length > 0
        ? title
        : DEFAULT_TITLES[node?.type ?? ""] ?? "A node";
    };

    const promptOutputs: Record<string, PromptOutputLike[] | undefined> = {};
    for (const nodeId of answeringNodeIds(results, typeOf))
      promptOutputs[nodeId] = state.getNode(nodeId)?.data?.fields as
        | PromptOutputLike[]
        | undefined;

    const turn = buildChatTurn({
      id: uuid(),
      // Matched against what downstream nodes recorded, which is the escaped
      // form; shown as typed.
      query: asSent,
      askedAt,
      results,
      promptOutputs,
      typeOf,
      nodeLabel,
      resolveText,
    });

    saveHistory([...historyRef.current, { ...turn, query: question }]);
    setRunning(false);
    setPendingQuery("");
    setProgress("");
    setStatus(
      turn.status === "answered"
        ? Status.READY
        : turn.status === "cancelled"
          ? Status.NONE
          : Status.ERROR,
    );
  }, [input, running, isConnected, id, setDataPropsForNode, saveHistory]);

  const stop = useCallback(() => {
    cancelRef.current = true;
    // The driver checks between steps; a step already running -- such as the
    // model answering -- finishes first.
    setProgress("Stopping after the current step…");
  }, []);

  const clear = useCallback(() => {
    saveHistory([]);
    setOpenContext({});
    setStatus(Status.NONE);
  }, [saveHistory]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter starts a new line, as in most chat apps.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const toggle = (key: string) =>
    setOpenContext((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderInputs = (inputs: Record<string, string>) =>
    Object.entries(inputs).map(([name, value]) => (
      <div key={name}>
        <Text size="xs" weight={600}>
          {name}
        </Text>
        <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
          {value}
        </Text>
      </div>
    ));

  // A turn with a single answer reads like an ordinary chat.
  const renderAnswer = (turn: ChatTurn, answer: ChatAnswer) => {
    const key = `${turn.id}:0`;
    return (
      <div key={key} className="ragchat-bubble ragchat-bubble-answer">
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {answer.text}
        </Text>
        <Text size="xs" color="dimmed" mt={4}>
          {answerLabel(answer)}
        </Text>
        {Object.keys(answer.inputs).length > 0 && (
          <>
            <UnstyledButton
              className="ragchat-context-toggle"
              onClick={() => toggle(key)}
            >
              <Text size="xs" color="blue">
                {openContext[key] ? "Hide context" : "Show context"}
              </Text>
            </UnstyledButton>
            <Collapse in={Boolean(openContext[key])}>
              <div className="ragchat-context nowheel">
                {renderInputs(answer.inputs)}
              </div>
            </Collapse>
          </>
        )}
      </div>
    );
  };

  // A turn comparing configurations. What every answer shares is said once;
  // answers that agree are grouped, each group listing the configurations
  // that gave it, so which choices changed the answer shows at a glance.
  // Nothing is collapsed away: every configuration stays visible as a chip.
  //
  // An answer on its own is labelled only by its count, never as "different":
  // agreement is judged strictly, so a lone answer may just be worded
  // differently from a group, and calling it a disagreement would be a claim
  // the check cannot back.
  const renderComparison = (turn: ChatTurn) => {
    const { shared, distinct } = splitAnswerLabels(turn.answers);
    const groups = groupAgreeingAnswers(turn.answers);
    const total = turn.answers.length;
    const anyAgree = groups.some((g) => g.length > 1);

    return (
      <>
        <Text size="xs" color="dimmed">
          {total} answers from different configurations
        </Text>
        {shared && (
          <Text size="xs" color="dimmed" mb={4}>
            Same for all: {shared}
          </Text>
        )}
        {groups.map((members) => {
          const key = `${turn.id}:g${members[0]}`;
          const lead = turn.answers[members[0]];
          return (
            <div key={key} className="ragchat-bubble ragchat-bubble-answer">
              {anyAgree && (
                <Text
                  size="xs"
                  weight={600}
                  color={members.length > 1 ? "teal" : "dimmed"}
                  mb={2}
                >
                  {members.length > 1
                    ? `${members.length} of ${total} agree`
                    : `1 of ${total}`}
                </Text>
              )}
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {lead.text}
              </Text>
              <Group spacing={4} mt={6}>
                {members.map((i) => (
                  <Badge
                    key={i}
                    size="xs"
                    radius="sm"
                    variant="light"
                    color="blue"
                    styles={{
                      root: { textTransform: "none", maxWidth: "100%" },
                    }}
                  >
                    {distinct[i]}
                  </Badge>
                ))}
              </Group>
              <UnstyledButton
                className="ragchat-context-toggle"
                onClick={() => toggle(key)}
              >
                <Text size="xs" color="blue">
                  {openContext[key]
                    ? "Hide details"
                    : members.length > 1
                      ? "Show each answer and its context"
                      : "Show context"}
                </Text>
              </UnstyledButton>
              <Collapse in={Boolean(openContext[key])}>
                <div className="ragchat-context nowheel">
                  {members.map((i) => (
                    <div key={i} className="ragchat-member">
                      {members.length > 1 && (
                        <>
                          <Text size="xs" weight={600}>
                            {distinct[i]}
                          </Text>
                          <Text
                            size="xs"
                            italic
                            mb={4}
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {turn.answers[i].text}
                          </Text>
                        </>
                      )}
                      {renderInputs(turn.answers[i].inputs)}
                    </div>
                  ))}
                </div>
              </Collapse>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <BaseNode classNames="ragchat-node" nodeId={id}>
      <NodeLabel
        title={data.title || "RAG Chat Node"}
        nodeId={id}
        icon={"💭"}
        status={status}
      />

      <div className="ragchat-body nodrag">
        <ScrollArea
          h={340}
          viewportRef={scrollRef}
          className="nowheel"
          offsetScrollbars
        >
          {history.length === 0 && !running && (
            <Text size="xs" color="dimmed" p="xs">
              {isConnected
                ? "Ask a question. It runs through the connected pipeline — retrieval, reranking and your Prompt node — and the answers appear here."
                : "Connect this node's output to a Retrieval node's queries input, then ask a question."}
            </Text>
          )}

          {history.map((turn) => (
            <div key={turn.id} className="ragchat-turn">
              <div className="ragchat-bubble ragchat-bubble-user">
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {turn.query}
                </Text>
              </div>
              {turn.answers.length > 1
                ? renderComparison(turn)
                : turn.answers.map((a) => renderAnswer(turn, a))}
              {explainTurn(turn) && (
                <div
                  className={`ragchat-bubble ragchat-bubble-system ${
                    turn.status === "failed" || turn.status === "no-answer"
                      ? "ragchat-bubble-error"
                      : ""
                  }`}
                >
                  <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
                    {explainTurn(turn)}
                  </Text>
                </div>
              )}
            </div>
          ))}

          {running && (
            <div className="ragchat-turn">
              <div className="ragchat-bubble ragchat-bubble-user">
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {pendingQuery}
                </Text>
              </div>
              <div className="ragchat-bubble ragchat-bubble-system">
                <Group spacing={6} noWrap>
                  <Loader size="xs" />
                  <Text size="xs">{progress}</Text>
                </Group>
              </div>
            </div>
          )}
        </ScrollArea>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={
            isConnected
              ? "Ask a question… (Enter to send)"
              : "Connect to a Retrieval node first"
          }
          autosize
          minRows={1}
          maxRows={4}
          mt="xs"
          disabled={running}
        />
        <Group position="apart" mt={6}>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={clear}
            disabled={running || history.length === 0}
          >
            Clear
          </Button>
          {running ? (
            <Button size="xs" color="red" variant="light" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button
              size="xs"
              onClick={send}
              disabled={!input.trim() || !isConnected}
            >
              Send
            </Button>
          )}
        </Group>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="query"
        style={{ top: "50%" }}
      />
    </BaseNode>
  );
};

export default RagChatNode;
