/**
 * ChainBuddy's chat panel, in the bottom-right corner of the canvas. The one
 * piece of ChainBuddy the app mounts (inside <ReactFlow>, see App.tsx).
 */

import React, { useEffect, useRef, useState } from "react";
import { Panel } from "reactflow";
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
import { Proposal } from "../adapters/canvas";
import { useChainBuddyModel } from "../adapters/settings";
import ProposalCard from "./ProposalCard";
import { Item, useChainBuddySession } from "./useChainBuddySession";
import "./chainbuddy.css";

// html: false escapes any HTML in model output, so it can't inject markup.
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true });

// Above the app's "Send us feedback" link, which is fixed to the bottom-right
// corner of the window.
const PANEL_STYLE = { marginBottom: 48 };

export default function ChainBuddyPanel() {
  const model = useChainBuddyModel();
  const session = useChainBuddySession(model);
  const { items, proposals, status, running } = session;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const viewport = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight });
  }, [items, status]);

  const send = () => {
    if (!draft.trim() || running) return;
    session.send(draft.trim());
    setDraft("");
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
              <ActionIcon
                size="sm"
                onClick={session.clear}
                aria-label="Start over"
              >
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
                onAccept={session.accept}
                onReject={session.reject}
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
                  onClick={session.stop}
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
