import React, { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Code,
  Group,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowRight,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { Proposal } from "../adapters/canvas";
import { ChangeLine } from "../flowApi/describe";
import { ProposalReview } from "../flowApi/review";

const ICONS = {
  add: IconPlus,
  update: IconPencil,
  connect: IconArrowRight,
  remove: IconTrash,
};

const STATUS: Record<string, { label: string; color: string }> = {
  applying: { label: "Applying…", color: "grape" },
  accepted: { label: "Accepted", color: "green" },
  rejected: { label: "Rejected", color: "gray" },
  replaced: { label: "Replaced by a newer proposal", color: "gray" },
  failed: { label: "Couldn't apply", color: "red" },
};

/** A change set waiting for the user, or what became of it. */
export default function ProposalCard({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: Proposal;
  onAccept: () => void;
  onReject: () => void;
}) {
  const pending = proposal.status === "pending";
  return (
    <Paper withBorder p="xs" radius="md">
      <Stack spacing={6}>
        <Group position="apart" noWrap>
          <Text size="sm" weight={500}>
            Proposed changes
          </Text>
          {!pending && (
            <Badge
              size="xs"
              color={STATUS[proposal.status].color}
              variant="light"
            >
              {STATUS[proposal.status].label}
            </Badge>
          )}
        </Group>
        <Text size="xs" color="dimmed">
          {proposal.summary}
        </Text>
        {proposal.lines.map((line, i) => (
          <LineView key={i} line={line} />
        ))}
        {proposal.review && <ReviewNote review={proposal.review} />}
        {proposal.error && (
          <Text size="xs" color="red">
            {proposal.error}
          </Text>
        )}
        {pending && (
          <Group spacing={6} mt={2}>
            <Button size="xs" color="grape" onClick={onAccept}>
              Accept
            </Button>
            <Button size="xs" variant="default" onClick={onReject}>
              Reject
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

function LineView({ line }: { line: ChangeLine }) {
  const Icon = ICONS[line.kind];
  return (
    <Box>
      <Group spacing={6} noWrap align="flex-start">
        <Icon size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <Text size="xs">{line.text}</Text>
      </Group>
      <Box pl={20}>
        {line.details?.map((d, i) =>
          d.code ? (
            <CodeToggle key={i} label={`${d.setting}`} code={d.value} />
          ) : (
            <Text key={i} size="xs" color="dimmed" lineClamp={3}>
              {d.setting}: {d.value}
            </Text>
          ),
        )}
        {line.edits?.map((e, i) =>
          e.code ? (
            <Box key={i}>
              <CodeToggle label={`${e.setting} before`} code={e.before} />
              <CodeToggle label={`${e.setting} after`} code={e.after} />
            </Box>
          ) : e.added || e.removed ? (
            <Box key={i} mb={2}>
              <Text size="xs" weight={500}>
                {e.setting}
              </Text>
              {e.removed?.map((item, j) => (
                <Text key={`r${j}`} size="xs" color="red" lineClamp={3}>
                  − {item}
                </Text>
              ))}
              {e.added?.map((item, j) => (
                <Text key={`a${j}`} size="xs" color="teal" lineClamp={3}>
                  + {item}
                </Text>
              ))}
              {e.kept ? (
                <Text size="xs" color="dimmed">
                  {e.kept} unchanged
                </Text>
              ) : null}
            </Box>
          ) : (
            <Box key={i} mb={2}>
              <Text size="xs" weight={500}>
                {e.setting}
              </Text>
              <Text size="xs" color="red" td="line-through" lineClamp={4}>
                {e.before}
              </Text>
              <Text size="xs" color="teal" lineClamp={4}>
                {e.after}
              </Text>
            </Box>
          ),
        )}
      </Box>
    </Box>
  );
}

/** Code, hidden until asked for. The user should read it before it runs. */
function CodeToggle({ label, code }: { label: string; code: string }) {
  const [shown, setShown] = useState(false);
  return (
    <Box>
      <UnstyledButton onClick={() => setShown((s) => !s)}>
        <Text size="xs" color="grape">
          {shown ? "Hide" : "Show"} {label.toLowerCase()}
        </Text>
      </UnstyledButton>
      {shown && (
        <Code block style={{ fontSize: 11, maxHeight: 220, overflow: "auto" }}>
          {code}
        </Code>
      )}
    </Box>
  );
}

const problems = (n: number) => (n === 1 ? "1 problem" : `${n} problems`);

/**
 * What a second look found before the proposal was shown. Problems it still
 * sees stay in view, since the user should weigh them before accepting.
 */
function ReviewNote({ review }: { review: ProposalReview }) {
  const [shown, setShown] = useState(false);
  if (review.failed)
    return (
      <Text size="xs" color="dimmed">
        A second look couldn&apos;t check this proposal.
      </Text>
    );
  return (
    <Stack spacing={2}>
      {review.fixed.length > 0 ? (
        <UnstyledButton onClick={() => setShown((s) => !s)}>
          <Text size="xs" color="dimmed">
            Checked by a second look, which found{" "}
            {problems(review.fixed.length)}, since revised.{" "}
            <Text span color="grape">
              {shown ? "Hide" : "Show"}
            </Text>
          </Text>
        </UnstyledButton>
      ) : (
        <Text size="xs" color="dimmed">
          Checked by a second look.
        </Text>
      )}
      {shown &&
        review.fixed.map((p, i) => (
          <Text key={i} size="xs" color="dimmed" pl="xs">
            • {p}
          </Text>
        ))}
      {review.unresolved.length > 0 && (
        <>
          <Text size="xs" color="orange">
            It still sees {problems(review.unresolved.length)}:
          </Text>
          {review.unresolved.map((p, i) => (
            <Text key={i} size="xs" color="orange" pl="xs">
              • {p}
            </Text>
          ))}
        </>
      )}
    </Stack>
  );
}
