import { Button, Group, RingProgress } from "@mantine/core";
import { IconSettings, IconTrash } from "@tabler/icons-react";

export default function LLMItemButtonGroup({
  onClickTrash,
  onClickSettings,
  ringProgress,
}) {
  return (
    <div>
      <Group position="right" style={{ float: "right", height: "20px" }}>
        {ringProgress !== undefined ? (
          ringProgress.success > 0 || ringProgress.error > 0 ? (
            <RingProgress
              size={20}
              width="16px"
              thickness={3}
              sections={[
                {
                  value: ringProgress.success,
                  color: ringProgress.success < 99 ? "blue" : "green",
                },
                { value: ringProgress.error, color: "red" },
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
        )}
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
