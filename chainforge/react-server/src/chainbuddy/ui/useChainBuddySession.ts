/**
 * A ChainBuddy conversation: the messages, the proposals, and running the
 * model. The panel (ChainBuddyPanel.tsx) only draws what this returns.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "reactflow";
import { Proposal, StoreCanvas } from "../adapters/canvas";
import { ChainBuddyModel } from "../adapters/settings";
import { createFlowTools } from "../flowApi/tools";
import { INSTRUCTIONS } from "../knowledge";
import { createOpenAICompatibleClient } from "../model/openaiCompatible";
import { AgentMessage } from "../model/types";
import { systemPrompt } from "../nodes";
import { AgentEvent, runAgent, StopReason } from "../runtime/agentLoop";
import { focusNodes } from "./focusNodes";

export type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "activity"; text: string; failed?: boolean; detail?: string }
  | { kind: "proposal"; id: string }
  | { kind: "error"; text: string };

/** How a tool call reads in the chat, or "" to leave it out. */
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

/** How a run that didn't simply finish is reported. Errors bring their own text. */
const ENDINGS: Partial<
  Record<StopReason, { kind: "activity" | "error"; text?: string }>
> = {
  cancelled: { kind: "activity", text: "Stopped." },
  length: {
    kind: "error",
    text: "The model's reply was cut off by its length limit.",
  },
  max_steps: {
    kind: "error",
    text: "Stopped: the model kept working without finishing. Try a simpler request.",
  },
  error: { kind: "error" },
};

export function useChainBuddySession(model: ChainBuddyModel) {
  const reactFlow = useReactFlow();
  const [items, setItems] = useState<Item[]>([]);
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const conversation = useRef<AgentMessage[]>([]);
  const abort = useRef<AbortController | null>(null);
  // What the user did with proposals, to tell the model on the next message.
  const decisions = useRef<string[]>([]);
  // The latest proposals, for callbacks (state updaters must stay pure).
  const latest = useRef<Record<string, Proposal>>({});
  // Changes when the conversation is forgotten, so a run started before
  // that doesn't add its messages to the new conversation.
  const generation = useRef(0);
  const add = (item: Item) => setItems((its) => [...its, item]);

  const canvas = useMemo(
    () =>
      new StoreCanvas({
        onProposal: (p) => {
          if (!latest.current[p.id]) add({ kind: "proposal", id: p.id });
          latest.current = { ...latest.current, [p.id]: p };
          setProposals(latest.current);
          if (p.status === "accepted" || p.status === "rejected")
            decisions.current.push(`The user ${p.status} ${p.id}.`);
        },
        onFocus: (ids) => focusNodes(reactFlow, ids),
      }),
    [reactFlow],
  );
  const { tools, startTurn } = useMemo(
    () => createFlowTools({ canvas }),
    [canvas],
  );

  /** Forgets the conversation and takes any waiting proposal off the canvas. */
  const forget = useCallback(() => {
    generation.current++;
    abort.current?.abort();
    for (const p of Object.values(latest.current))
      if (p.status === "pending") canvas.reject(p.id);
    conversation.current = [];
    decisions.current = [];
  }, [canvas]);

  // Proposed nodes left over from a flow saved mid-proposal were never
  // accepted, so they go.
  useEffect(() => canvas.removeOrphans(), [canvas]);

  // What the model remembers is about the old flow, so start over.
  useEffect(
    () =>
      canvas.watchForFlowSwitch(() => {
        if (conversation.current.length === 0) return;
        forget();
        add({
          kind: "activity",
          text: "This is a different flow, so ChainBuddy started a new conversation.",
        });
      }),
    [canvas, forget],
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || abort.current || !model.config) return;
      add({ kind: "user", text });
      startTurn();

      // Tell the model what the user did with its proposals since it last spoke.
      const note = decisions.current.length
        ? `[${decisions.current.join(" ")}]\n\n`
        : "";
      decisions.current = [];
      const userMessage: AgentMessage = { role: "user", content: note + text };

      const controller = new AbortController();
      abort.current = controller;
      const started = generation.current;
      setRunning(true);
      setStatus("Thinking…");
      let streaming = false; // whether the last item is text still arriving
      const callArgs = new Map<string, string>();
      const onEvent = (e: AgentEvent) => {
        if (e.type === "text") {
          setStatus(null);
          // Read now: React runs the updater later, after streaming is set.
          const continuing = streaming;
          setItems((its) => {
            const last = its[its.length - 1];
            if (continuing && last?.kind === "assistant")
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
        } else if (e.type === "tool_call")
          callArgs.set(e.call.id, e.call.arguments);
        else if (e.type === "tool_result") {
          const line = activityText(
            e.name,
            callArgs.get(e.callId) ?? "",
            e.ok,
            e.content,
          );
          if (line)
            add({
              kind: "activity",
              text: line,
              failed: !e.ok,
              detail: e.content,
            });
        } else if (e.type === "step_finish") {
          streaming = false;
          setStatus("Thinking…");
        }
      };

      try {
        const result = await runAgent({
          client: createOpenAICompatibleClient(model.config),
          system: systemPrompt(INSTRUCTIONS),
          messages: [...conversation.current, userMessage],
          tools,
          maxSteps: 12,
          signal: controller.signal,
          onEvent,
        });
        // The conversation may have been forgotten mid-run (another flow was
        // opened, or Start over); this run belongs to the old one.
        if (generation.current !== started) return;
        conversation.current = [
          ...conversation.current,
          userMessage,
          ...result.messages,
        ];
        const ending = ENDINGS[result.stopReason];
        const text = result.error ?? ending?.text;
        if (ending && text) add({ kind: ending.kind, text });
      } catch (err) {
        add({
          kind: "error",
          text: err instanceof Error ? err.message : String(err),
        });
      } finally {
        abort.current = null;
        setRunning(false);
        setStatus(null);
      }
    },
    [model.config, tools, startTurn],
  );

  const clear = useCallback(() => {
    forget();
    setItems([]);
  }, [forget]);

  return {
    items,
    proposals,
    status,
    running,
    send,
    stop: () => abort.current?.abort(),
    clear,
    accept: (id: string) => canvas.accept(id),
    reject: (id: string) => canvas.reject(id),
  };
}
