import React, { useEffect, useRef, useState } from "react";
import { Loader, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";

// Flow names become filenames (`<name>.cforge`) and URL path segments on the
// local server, so disallow path separators and characters that are invalid in
// filenames on any OS we support.
const INVALID_FLOW_NAME_CHARS = /[/\\:*?"<>|]/;
const MAX_FLOW_NAME_LENGTH = 100;

/** Returns an error message if `name` can't be used as a flow name, else undefined. */
export function validateFlowName(name: string): string | undefined {
  if (name.length === 0) return "Name can't be empty.";
  if (name.length > MAX_FLOW_NAME_LENGTH)
    return `Name must be ${MAX_FLOW_NAME_LENGTH} characters or fewer.`;
  if (INVALID_FLOW_NAME_CHARS.test(name))
    return "Name can't contain / \\ : * ? \" < > |";
  if (name.startsWith(".")) return "Name can't start with a period.";
  if (name === "__autosave") return "That name is reserved.";
  return undefined;
}

interface FlowNameEditorProps {
  /** The current name of the flow. */
  name: string;
  /**
   * Called with a new, valid name when the user commits an edit. Resolves to
   * `true` if the rename took effect; otherwise the editor reverts to `name`.
   */
  onRename: (newName: string) => Promise<boolean>;
  disabled?: boolean;
}

/**
 * Shows the current flow's name as a title, which becomes a text input when
 * clicked. Enter or clicking away commits; Escape cancels.
 */
const FlowNameEditor: React.FC<FlowNameEditorProps> = ({
  name,
  onRename,
  disabled,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Loading another flow changes the name out from under us
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const trimmed = draft.trim();
  const error = trimmed === name ? undefined : validateFlowName(trimmed);

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  // A ref, not state: Enter commits and disables the input, which can blur it
  // and commit again from a render that still sees `renaming` as false.
  const commitInProgress = useRef(false);

  const commit = async () => {
    if (commitInProgress.current) return;
    if (trimmed === name || error) {
      cancel();
      return;
    }
    commitInProgress.current = true;
    setRenaming(true);
    const renamed = await onRename(trimmed);
    commitInProgress.current = false;
    setRenaming(false);
    if (!renamed) setDraft(name);
    setEditing(false);
  };

  if (editing)
    return (
      <TextInput
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Enter while composing (e.g., Japanese or Chinese input) confirms
          // the composition, not the name
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            // Keep the input open so the user can fix an invalid name
            if (!error) commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        error={error}
        disabled={renaming}
        rightSection={renaming ? <Loader size="xs" /> : undefined}
        size="xs"
        w="240px"
        maw="100%"
        aria-label="Flow name"
        autoFocus
        styles={{ error: { whiteSpace: "normal" } }}
      />
    );

  return (
    <Tooltip label="Rename flow" withArrow openDelay={400}>
      <UnstyledButton
        onClick={() => setEditing(true)}
        disabled={disabled}
        aria-label={`Flow name: ${name}. Click to rename.`}
        className="flow-name-display"
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          gap: "4px",
          maxWidth: "100%",
          height: "26px",
          padding: "0 6px",
          borderRadius: theme.radius.sm,
          fontSize: theme.fontSizes.sm,
          fontWeight: 500,
          color:
            theme.colorScheme === "dark"
              ? theme.colors.gray[4]
              : theme.colors.gray[7],
          "& .flow-name-pencil": { opacity: 0 },
          "&:hover:not(:disabled), &:focus-visible": {
            backgroundColor:
              theme.colorScheme === "dark"
                ? theme.colors.dark[6]
                : theme.colors.gray[1],
            "& .flow-name-pencil": { opacity: 0.7 },
          },
          "&:disabled": { cursor: "default" },
        })}
      >
        <span
          title={name}
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <IconPencil
          className="flow-name-pencil"
          size={14}
          style={{ flexShrink: 0 }}
        />
      </UnstyledButton>
    </Tooltip>
  );
};

export default FlowNameEditor;
