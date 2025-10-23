import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import {
  Menu,
  Button,
  Card,
  Group,
  Text,
  ActionIcon,
  Modal,
  Divider,
  Flex,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconTrash, IconSettings } from "@tabler/icons-react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { v4 as uuid } from "uuid";
import { ChunkMethodSchemas, ChunkMethodGroups } from "./ChunkMethodSchemas";
import { transformDict, truncStr } from "./backend/utils";
import useStore from "./store";

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
    <Card shadow="sm" p="3px 6px" withBorder mt="xs">
      <Flex justify="space-between" align="center">
        <div>
          <Text
            size="sm"
            fz="10pt"
            weight={600}
            style={{ overflowX: "hidden" }}
          >
            {methodItem.emoji ? methodItem.emoji + " " : ""}
            {methodItem.name}
          </Text>
          {methodItem.settings &&
            Object.entries(
              transformDict(methodItem.settings, (k) => k !== "shortname"),
            ).map(([key, value]) =>
              value ? (
                <Text
                  key={key}
                  size={10}
                  ml="lg"
                  lh={1.2}
                  color="dimmed"
                >{`${key}: ${truncStr(value, 112)}`}</Text>
              ) : (
                <></>
              ),
            )}
          {/* {fullName || description || ""} */}
        </div>
        <Flex gap={2}>
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => onRemove(methodItem.key)}
            title="Remove this method"
          >
            <IconTrash size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="blue"
            onClick={open}
            title="Open Settings"
          >
            <IconSettings size={16} />
          </ActionIcon>
        </Flex>
      </Flex>

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
    </Card>
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
      const newItem: ChunkMethodSpec = {
        key: uuid(),
        baseMethod: m.baseMethod,
        methodType: m.methodType,
        name: m.name,
        emoji: m.emoji,
        settings: {},
      };
      const newItems = [...methodItems, newItem];
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const [menuOpened, setMenuOpened] = useState(false);
  // Pull in any dropped‑in chunkers
  const customChunkers = useStore((s) => s.customChunkers);

  return (
    <div style={{ padding: 4 }}>
      <Group position="apart" mb="0">
        <Text weight={500} size="sm">
          Chunking Methods
        </Text>

        <Menu
          opened={menuOpened}
          onChange={setMenuOpened}
          position="right-start"
          withinPortal
          withArrow
        >
          <Menu.Target>
            <Button
              size="xs"
              variant="light"
              rightIcon={<IconPlus size={14} />}
              onClick={() => setMenuOpened((o) => !o)}
            >
              Add
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {ChunkMethodGroups.map((group, groupIdx) => (
              <React.Fragment key={group.label}>
                <Menu.Label>{group.label}</Menu.Label>
                {group.items.map((item) => (
                  <Menu.Item
                    key={item.baseMethod}
                    icon={item.emoji ? <Text>{item.emoji}</Text> : undefined}
                    onClick={() => {
                      addMethod(item);
                      setMenuOpened(false);
                    }}
                  >
                    {item.name}
                  </Menu.Item>
                ))}

                {groupIdx < ChunkMethodGroups.length - 1 && <Divider my="xs" />}
              </React.Fragment>
            ))}
            {/* ── Custom chunkers ── */}
            {customChunkers.length > 0 && (
              <>
                <Divider my="xs" />
                <Menu.Label>Custom chunkers</Menu.Label>
                {customChunkers.map((item) => (
                  <Menu.Item
                    key={item.baseMethod}
                    icon={item.emoji ? <Text>{item.emoji}</Text> : undefined}
                    onClick={() => {
                      addMethod(item);
                      setMenuOpened(false);
                    }}
                  >
                    {item.name}
                  </Menu.Item>
                ))}
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {methodItems.length === 0 ? (
        <Text size="xs" color="dimmed">
          No chunk methods selected.
        </Text>
      ) : (
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
      )}
    </div>
  );
});

ChunkMethodListContainer.displayName = "ChunkMethodListContainer";
export default ChunkMethodListContainer;
