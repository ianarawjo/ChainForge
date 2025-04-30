import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
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
  Box,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconTrash,
  IconSettings,
  IconChevronRight,
} from "@tabler/icons-react";
import Form from "@rjsf/core";
import { RJSFSchema, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { v4 as uuid } from "uuid";
import {
  RetrievalMethodSchemas,
  retrievalMethodGroups,
  embeddingProviders,
} from "./RetrievalMethodSchemas";

// Individual retrieval method item interface
export interface RetrievalMethodSpec {
  key: string;
  baseMethod: string;
  methodName: string;
  library: string;
  emoji?: string;
  needsEmbeddingModel?: boolean;
  embeddingProvider?: string;
  settings?: Record<string, any>;
}

// Settings modal for individual retrieval methods
interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  methodItem: RetrievalMethodSpec;
  onSettingsUpdate: (settings: any) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  opened,
  onClose,
  methodItem,
  onSettingsUpdate,
}) => {
  const schema = RetrievalMethodSchemas[methodItem.baseMethod];
  if (!schema) return null;

  // If this method needs embedding models, modify the schema to include
  // the appropriate embedding model options based on the selected provider
  let finalSchema = schema.schema;
  const finalUiSchema = schema.uiSchema;

  if (methodItem.needsEmbeddingModel && methodItem.embeddingProvider) {
    const provider = embeddingProviders.find(
      (p) => p.value === methodItem.embeddingProvider,
    );
    if (provider) {
      // Clone the schema to avoid modifying the original
      finalSchema = {
        ...schema.schema,
        properties: {
          ...schema.schema.properties,
          // Add the embedding model property with enum options from the selected provider
          embeddingModel: {
            type: "string",
            title: "Embedding Model",
            enum: provider.models,
            default: provider.models[0],
          },
        },
      };
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Settings: ${methodItem.methodName}${methodItem.embeddingProvider ? ` (${methodItem.embeddingProvider})` : ""}`}
      size="lg"
    >
      <Form<any, RJSFSchema, any>
        schema={finalSchema as RJSFSchema}
        uiSchema={finalUiSchema as UiSchema}
        validator={validator}
        formData={methodItem.settings}
        onChange={(e) => onSettingsUpdate(e.formData)}
      >
        <Button type="submit" style={{ display: "none" }} />
      </Form>
    </Modal>
  );
};

// Individual retrieval method list item
interface RetrievalMethodListItemProps {
  methodItem: RetrievalMethodSpec;
  onRemove: (key: string) => void;
  onSettingsUpdate: (key: string, settings: any) => void;
}

const RetrievalMethodListItem: React.FC<RetrievalMethodListItemProps> = ({
  methodItem,
  onRemove,
  onSettingsUpdate,
}) => {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Card withBorder mb="xs" padding="xs">
      <Group position="apart" noWrap>
        <Box style={{ flex: 1 }}>
          <Group spacing="xs" noWrap>
            <Text size="sm">
              {methodItem.emoji && `${methodItem.emoji} `}
              {methodItem.settings?.shortName?.trim() || methodItem.methodName}
            </Text>
          </Group>
        </Box>
        <Group spacing={4} noWrap>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={() => onRemove(methodItem.key)}
          >
            <IconTrash size={14} />
          </ActionIcon>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="blue"
            onClick={() => open()}
          >
            <IconSettings size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <SettingsModal
        opened={opened}
        onClose={close}
        methodItem={methodItem}
        onSettingsUpdate={(settings) =>
          onSettingsUpdate(methodItem.key, settings)
        }
      />
    </Card>
  );
};

// Main container component
export interface RetrievalMethodListContainerProps {
  initMethodItems?: RetrievalMethodSpec[];
  onItemsChange?: (
    newItems: RetrievalMethodSpec[],
    oldItems: RetrievalMethodSpec[],
  ) => void;
}

export const RetrievalMethodListContainer = forwardRef<
  any,
  RetrievalMethodListContainerProps
>((props, ref) => {
  const [methodItems, setMethodItems] = useState<RetrievalMethodSpec[]>(
    props.initMethodItems || [],
  );
  const oldItemsRef = useRef<RetrievalMethodSpec[]>(methodItems);

  useImperativeHandle(ref, () => ({
    getMethodItems: () => methodItems,
  }));

  const notifyItemsChanged = useCallback(
    (newItems: RetrievalMethodSpec[]) => {
      props.onItemsChange?.(newItems, oldItemsRef.current);
      oldItemsRef.current = newItems;
    },
    [props.onItemsChange],
  );

  const handleRemoveMethod = useCallback(
    (key: string) => {
      const newItems = methodItems.filter((m) => m.key !== key);
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const handleSettingsUpdate = useCallback(
    (key: string, newSettings: any) => {
      const newItems = methodItems.map((m) =>
        m.key === key ? { ...m, settings: newSettings } : m,
      );
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const addMethod = useCallback(
    (
      m: Omit<RetrievalMethodSpec, "key" | "settings">,
      embeddingProviderValue?: string,
    ) => {
      // Find the provider with this value to get its label and models
      const provider = embeddingProviderValue
        ? embeddingProviders.find((p) => p.value === embeddingProviderValue)
        : undefined;

      // Get the schema for this method to access default values
      const methodSchema = RetrievalMethodSchemas[m.baseMethod];

      // Initialize settings with default values from schema
      let defaultSettings = {} as Record<string, any>;

      // Extract default values from schema if available
      if (methodSchema?.schema?.properties) {
        const schemaProps = methodSchema.schema.properties;
        defaultSettings = Object.entries(schemaProps).reduce(
          (acc, [key, prop]) => {
            if ("default" in prop) {
              acc[key] = prop.default;
            }
            return acc;
          },
          {} as Record<string, any>,
        );
      }

      // If this is an embedding-based method, set the default embedding model
      if (
        m.needsEmbeddingModel &&
        provider?.models &&
        provider.models.length > 0
      ) {
        defaultSettings.embeddingModel = provider.models[0];
      }

      const newItem: RetrievalMethodSpec = {
        key: uuid(),
        baseMethod: m.baseMethod,
        methodName: m.methodName,
        library: m.library,
        emoji: m.emoji,
        needsEmbeddingModel: m.needsEmbeddingModel,
        ...(m.needsEmbeddingModel && embeddingProviderValue
          ? {
              embeddingProvider: provider?.value || "",
            }
          : {}),
        settings: defaultSettings, // Use initialized default settings
      };

      const newItems = [...methodItems, newItem];
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const [menuOpened, setMenuOpened] = useState(false);

  return (
    <div style={{ border: "1px dashed #ccc", borderRadius: 6, padding: 8 }}>
      <Group position="apart" mb="xs">
        <Text weight={500} size="sm">
          Retrieval Methods / Vector Stores
        </Text>

        <Menu
          opened={menuOpened}
          onChange={setMenuOpened}
          position="bottom-end"
          withinPortal
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
            {retrievalMethodGroups.map((group, groupIdx) => (
              <React.Fragment key={group.label}>
                <Menu.Label>{group.label}</Menu.Label>
                {group.items.map((item) => {
                  // For methods that need embedding models, show a nested menu
                  if (item.needsEmbeddingModel) {
                    return (
                      <Menu
                        key={item.baseMethod}
                        trigger="hover"
                        position="right-start"
                      >
                        <Menu.Target>
                          <Menu.Item
                            icon={
                              item.emoji ? <Text>{item.emoji}</Text> : undefined
                            }
                            rightSection={<IconChevronRight size={14} />}
                          >
                            {item.methodName}
                          </Menu.Item>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {embeddingProviders.map((provider) => (
                            <Menu.Item
                              key={provider.value}
                              onClick={() => {
                                addMethod(item, provider.value);
                                setMenuOpened(false);
                              }}
                            >
                              {provider.label}
                            </Menu.Item>
                          ))}
                        </Menu.Dropdown>
                      </Menu>
                    );
                  }

                  // For methods that don't need embeddings, keep the original behavior
                  return (
                    <Menu.Item
                      key={item.baseMethod}
                      icon={item.emoji ? <Text>{item.emoji}</Text> : undefined}
                      onClick={() => {
                        addMethod(item);
                        setMenuOpened(false);
                      }}
                    >
                      {item.library}
                    </Menu.Item>
                  );
                })}
                {groupIdx < retrievalMethodGroups.length - 1 && (
                  <Divider my="xs" />
                )}
              </React.Fragment>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {methodItems.length === 0 ? (
        <Text size="xs" color="dimmed">
          No retrieval methods selected.
        </Text>
      ) : (
        methodItems.map((item) => (
          <RetrievalMethodListItem
            key={item.key}
            methodItem={item}
            onRemove={handleRemoveMethod}
            onSettingsUpdate={handleSettingsUpdate}
          />
        ))
      )}
    </div>
  );
});

RetrievalMethodListContainer.displayName = "RetrievalMethodListContainer";
export default RetrievalMethodListContainer;
