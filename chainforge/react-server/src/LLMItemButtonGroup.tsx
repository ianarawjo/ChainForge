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
    <Group
      spacing="xs"
      style={{ flexShrink: 0, width: "fit-content", alignItems: "center" }}
    >
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
          style={{
            padding: "0px",
            width: "28px",
            minWidth: "28px",
            height: "28px",
          }}
        >
          <IconTrash size={16} />
        </Button>
      )}
      <Button
        onClick={onClickSettings}
        size="xs"
        variant="light"
        color="blue"
        compact
        style={{ width: "28px", minWidth: "28px", height: "28px" }}
      >
        <IconSettings size={16} />
      </Button>
    </Group>
  );
}
