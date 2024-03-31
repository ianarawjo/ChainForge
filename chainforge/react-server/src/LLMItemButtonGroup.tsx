import React, { Button, Group, RingProgress } from "@mantine/core";
import { IconSettings, IconTrash } from "@tabler/icons-react";
import { QueryProgress } from "./backend/typing";

export function GatheringResponsesRingProgress({
  progress,
}: {
  progress: QueryProgress | undefined;
}) {
  return progress !== undefined ? (
    progress.success > 0 || progress.error > 0 ? (
      <RingProgress
        size={20}
        thickness={3}
        sections={[
          {
            value: progress.success,
            color: progress.success < 99 ? "blue" : "green",
          },
          { value: progress.error, color: "red" },
        ]}
      />
    ) : (
      <div className="lds-ring">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    )
  ) : (
    <></>
  );
}

export interface LLMItemButtonGroupProps {
  onClickTrash?: () => void;
  onClickSettings?: () => void;
  ringProgress?: QueryProgress;
  hideTrashIcon?: boolean;
}

export default function LLMItemButtonGroup({
  onClickTrash,
  onClickSettings,
  ringProgress,
  hideTrashIcon,
}: LLMItemButtonGroupProps) {
  return (
    <div>
      <Group position="right" style={{ float: "right", height: "20px" }}>
        <GatheringResponsesRingProgress progress={ringProgress} />
        {hideTrashIcon ? (
          <></>
        ) : (
          <Button
            onClick={onClickTrash}
            size="xs"
            variant="light"
            compact
            color="red"
            style={{ padding: "0px" }}
          >
            <IconTrash size={"95%"} />
          </Button>
        )}
        <Button
          onClick={onClickSettings}
          size="xs"
          variant="light"
          color="blue"
          compact
        >
          <IconSettings size={"110%"} />
        </Button>
      </Group>
    </div>
  );
}
