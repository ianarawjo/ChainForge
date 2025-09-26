import {
  Popover,
  Badge,
  Text,
  Textarea,
  NumberInput,
  Button,
  Stack,
} from "@mantine/core";
import { IconBulb } from "@tabler/icons-react";
import { useState, CSSProperties } from "react";

interface MarkerPopoverProps {
  anchor: { x: number; y: number };
  preview: string;
  context: string;
  setContext: (s: string) => void;
  variants: string;
  setVariants: (v: string) => void;
  onGenerate: () => void;
  loading?: boolean;
  nodeType?: "textfields" | "prompt" | "chat";
}

export default function MarkerPopover({
  anchor,
  preview,
  context,
  setContext,
  variants,
  setVariants,
  onGenerate,
  loading = false,
  nodeType = "textfields",
}: MarkerPopoverProps) {
  const [open, setOpen] = useState(false);

  const bulbStyle: CSSProperties = {
    position: "fixed",
    top: anchor.y,
    left: anchor.x,
    zIndex: 10_000,
  };

  const getLabels = () => {
    switch (nodeType) {
      case "prompt":
        return {
          title: "PROMPT CONFIGURATION",
          contextLabel: "Prompt context",
          variantsLabel: "Prompt variants to generate",
        };
      case "chat":
        return {
          title: "CHAT CONFIGURATION",
          contextLabel: "Chat context",
          variantsLabel: "Response variants to generate",
        };
      default:
        return {
          title: "FIELD CONFIGURATION",
          contextLabel: "Extra configuration",
          variantsLabel: "Variants to generate",
        };
    }
  };

  const labels = getLabels();

  return (
    <Popover
      opened={open}
      onChange={setOpen}
      position="right-start"
      withArrow
      shadow="rgb(38,57,77) 0 10px 30px -14px"
      withinPortal
      keepMounted
    >
      <Popover.Target>
        <button
          className="ai-button nodrag"
          style={bulbStyle}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <IconBulb size={10} fill="violet" />
        </button>
      </Popover.Target>

      <Popover.Dropdown className="nodrag nowheel" style={{ width: "100%" }}>
        <Badge
          color="grape"
          variant="light"
          radius="sm"
          style={{ width: "100%" }}
          leftSection={<IconBulb size={10} stroke={2} />}
        >
          {labels.title}
        </Badge>

        {preview && (
          <Text size="xs" fs="italic" c="dimmed" mt="sm" mb="sm" lh={1.3}>
            "{preview}"
          </Text>
        )}

        <Stack spacing="md">
          <div>
            <Text size="sm" fw={600} mb={4}>
              {labels.contextLabel}
            </Text>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.currentTarget.value)}
              autosize
              minRows={2}
              disabled={loading}
            />
          </div>

          <div>
            <Text size="sm" fw={600} mb={4}>
              {labels.variantsLabel}
            </Text>
            <NumberInput
              min={1}
              value={Number(variants)}
              onChange={(n) => setVariants(String(n))}
              disabled={loading}
            />
          </div>

          <Button
            variant="light"
            color="grape"
            fullWidth
            loading={loading}
            onClick={() => {
              onGenerate();
              setOpen(false);
            }}
          >
            Generate
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
