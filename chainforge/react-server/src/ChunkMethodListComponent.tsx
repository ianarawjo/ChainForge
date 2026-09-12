import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import { ActionIcon, Button, Text, Modal, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSettings, IconTrash } from "@tabler/icons-react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { v4 as uuid } from "uuid";
import { ChunkMethodSchemas, ChunkMethodGroups } from "./ChunkMethodSchemas";
import { canRunNow } from "./backend/ragCapabilities";
import NestedMenu, { NestedMenuItemProps } from "./NestedMenu";
import useStore from "./store";
import { ensureUniqueName } from "./backend/utils";

export interface ChunkMethodSpec {
  key: string;
  baseMethod: string;
  methodType: string;
  name: string;
  emoji?: string;
  settings?: Record<string, any>;
}

export interface ChunkMethodListContainerProps {
  initMethodItems?: ChunkMethodSpec[];
  onItemsChange?: (
    newItems: ChunkMethodSpec[],
    oldItems: ChunkMethodSpec[],
  ) => void;
}
export type ChunkMethodListContainerRef = Record<string, never>;

const ChunkMethodListItem: React.FC<{
  methodItem: ChunkMethodSpec;
  onRemove: (key: string) => void;
  onSettingsUpdate: (key: string, newSettings: any) => void;
}> = ({ methodItem, onRemove, onSettingsUpdate }) => {
  // Fetch the relevant schema
  const schemaEntry = useMemo(
    () =>
      ChunkMethodSchemas[methodItem.baseMethod] || {
        schema: {},
        uiSchema: {},
        description: "",
        fullName: "",
      },
    [methodItem],
  );
  const schema = useMemo(() => {
    const s = schemaEntry?.schema;
    const schemaWithShortname = {
      ...s,
      properties: {
        shortname: {
          type: "string",
          title: "Short Name",
          description: "A nickname for this method.",
          default: methodItem.name,
        },
        ...s.properties,
      },
    } as typeof s;
    return schemaWithShortname;
  }, [schemaEntry]);
  const uiSchema = useMemo(() => schemaEntry?.uiSchema, [schemaEntry]);

  const [settingsModalOpen, { open, close }] = useDisclosure(false);

  return (
    <div className="llm-list-item llm-list-card">
      {/* Title (left) */}
      <div className="llm-card-header">
        {methodItem.emoji ? methodItem.emoji + " " : ""}
        {methodItem.name}
      </div>

      {/* Actions (right) -- same icons and sizing as the retrieval rows, so
          the three method lists read as one component. */}
      <div className="llm-row-actions">
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          onClick={() => onRemove(methodItem.key)}
          title="Remove"
        >
          <IconTrash size={14} />
        </ActionIcon>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="blue"
          onClick={open}
          title="Settings"
        >
          <IconSettings size={14} />
        </ActionIcon>
      </div>

      <Modal
        opened={settingsModalOpen}
        onClose={close}
        title="Chunk Method Settings"
        size="lg"
      >
        {schema && Object.keys(schema).length > 0 ? (
          <Form
            schema={schema}
            uiSchema={uiSchema}
            formData={methodItem.settings}
            // onChange={(evt) => onSettingsUpdate(methodItem.key, evt.formData)}
            onSubmit={(evt) => {
              onSettingsUpdate(methodItem.key, evt.formData);
              close();
            }}
            validator={validator as any}
            liveValidate
            noHtml5Validate
          >
            <Button
              title="Submit"
              type="submit"
              style={{ float: "right", marginRight: "30px" }}
            >
              Submit
            </Button>
            <div style={{ height: "50px" }}></div>
          </Form>
        ) : (
          <Text size="sm" color="dimmed">
            (No custom settings for this method.)
          </Text>
        )}
      </Modal>
    </div>
  );
};

const ChunkMethodListContainer = forwardRef<
  ChunkMethodListContainerRef,
  ChunkMethodListContainerProps
>((props, ref) => {
  const [methodItems, setMethodItems] = useState<ChunkMethodSpec[]>(
    props.initMethodItems || [],
  );
  const oldItemsRef = useRef<ChunkMethodSpec[]>(methodItems);

  useImperativeHandle(ref, () => ({}));

  // If parent node wants to track changes
  const notifyItemsChanged = useCallback(
    (newItems: ChunkMethodSpec[]) => {
      props.onItemsChange?.(newItems, oldItemsRef.current);
      oldItemsRef.current = newItems;
    },
    [props.onItemsChange],
  );

  // Remove method
  const handleRemoveMethod = useCallback(
    (key: string) => {
      const newItems = methodItems.filter((m) => m.key !== key);
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  // Update settings
  const handleSettingsUpdate = useCallback(
    (key: string, newSettings: any) => {
      const newItems = methodItems.map((m) =>
        m.key === key
          ? {
              ...m,
              settings: newSettings,
              name: newSettings.shortname ?? m.name,
            }
          : m,
      );
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const addMethod = useCallback(
    (m: Omit<ChunkMethodSpec, "key" | "settings">) => {
      const uniqueName = ensureUniqueName(
        m.name,
        methodItems.map((i) => i.settings?.shortname || i.name),
      );

      const newItem: ChunkMethodSpec = {
        key: uuid(),
        baseMethod: m.baseMethod,
        methodType: m.methodType,
        name: uniqueName,
        emoji: m.emoji,
        settings: {},
      };
      const newItems = [...methodItems, newItem];
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  // Pull in any dropped‑in chunkers
  const customChunkers = useStore((s) => s.customChunkers);

  const addMenuItems: NestedMenuItemProps[] = useMemo(() => {
    // Built-in groups as top-level submenus. Methods that cannot run in the
    // current setup are left out rather than offered and then failing: without
    // a local server, anything needing a tokenizer, embeddings or a vector
    // store is unavailable. A group whose methods are all unavailable is
    // dropped too.
    const builtInGroups: NestedMenuItemProps[] = ChunkMethodGroups.map(
      (group) => ({
        key: `group-${group.label}`,
        title: group.label,
        items: group.items
          .filter((m) => canRunNow(m.runsIn ?? "backend"))
          .map((m) => ({
            key: `method-${m.baseMethod}`,
            title: m.name,
            tooltip: m.description,
            icon: m.emoji ? <Text>{m.emoji}</Text> : undefined,
            onClick: () => addMethod(m),
          })),
      }),
    ).filter((group) => (group.items?.length ?? 0) > 0);

    // Custom chunkers as another top-level submenu (if any)
    const customGroup: NestedMenuItemProps[] =
      customChunkers.length > 0
        ? [
            {
              key: "group-custom",
              title: "Custom chunkers",
              items: customChunkers.map((item) => ({
                key: `custom-${item.baseMethod}`,
                title: item.name,
                icon: item.emoji ? <Text>{item.emoji}</Text> : undefined,
                onClick: () => addMethod(item),
              })),
            },
          ]
        : [];

    return [...builtInGroups, ...customGroup];
  }, [ChunkMethodGroups, customChunkers, addMethod]);

  return (
    <div className="llm-list-container nowheel">
      <div className="llm-list-backdrop">
        <span>Chunking Methods</span>

        <div className="add-llm-model-btn nodrag">
          <NestedMenu
            items={addMenuItems}
            button={(toggle) => <button onClick={toggle}>Add +</button>}
          />
        </div>
      </div>

      {methodItems.length === 0 ? (
        <div className="nodrag">
          <Text size="xs" color="dimmed">
            No chunk methods selected.
          </Text>
        </div>
      ) : (
        <div className="nodrag">
          <div className="list nowheel nodrag">
            <ScrollArea.Autosize mah={500} className="nopan nowheel">
              {methodItems.map((item) => (
                <ChunkMethodListItem
                  key={item.key}
                  methodItem={item}
                  onRemove={handleRemoveMethod}
                  onSettingsUpdate={handleSettingsUpdate}
                />
              ))}
            </ScrollArea.Autosize>
          </div>
        </div>
      )}
    </div>
  );
});

ChunkMethodListContainer.displayName = "ChunkMethodListContainer";
export default ChunkMethodListContainer;
