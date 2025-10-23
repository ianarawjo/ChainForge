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
import useStore from "./store";

/** One retrieval method row */
export interface RetrievalMethodSpec {
  key: string;
  baseMethod: string;
  methodName: string;
  library: string;
  emoji?: string;
  needsEmbeddingModel?: boolean;
  embeddingProvider?: string;
  settings?: Record<string, any>;
  source?: "builtin" | "custom";
  /** For customs (normalized in store) */
  settingsSchema?: { settings?: Record<string, any>; ui?: Record<string, any> };
}

/** Settings modal */
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
  const builtin = RetrievalMethodSchemas[methodItem.baseMethod];

  // With normalized store data, a single custom check suffices.
  const isCustom = methodItem.source === "custom";

  // Prefer custom schema if present; otherwise built-in schema.
  const customSchema = methodItem.settingsSchema
    ? {
        schema: {
          type: "object",
          properties: methodItem.settingsSchema.settings ?? {},
        },
        uiSchema: methodItem.settingsSchema.ui ?? {},
      }
    : null;

  let finalSchema = (customSchema?.schema ?? builtin?.schema) as
    | RJSFSchema
    | undefined;
  const finalUiSchema = (customSchema?.uiSchema ?? builtin?.uiSchema) as
    | UiSchema
    | undefined;

  // Ensure customs always have a Nickname field
  if (isCustom) {
    const props = (finalSchema?.properties ?? {}) as Record<string, any>;
    if (!("shortName" in props)) {
      finalSchema = {
        type: "object",
        properties: {
          shortName: {
            type: "string",
            title: "Nickname",
            default: methodItem.settings?.shortName ?? methodItem.methodName,
            description:
              "Unique identifier to appear in ChainForge. Keep it short.",
          },
          ...props,
        },
      } as RJSFSchema;
    }
  }

  // Built-ins: optionally augment with embedding model picker
  if (
    !isCustom &&
    methodItem.needsEmbeddingModel &&
    methodItem.embeddingProvider &&
    builtin
  ) {
    const provider = embeddingProviders.find(
      (p) => p.value === methodItem.embeddingProvider,
    );
    if (provider) {
      if (provider.models && provider.models.length > 0) {
        finalSchema = {
          ...(finalSchema as any),
          properties: {
            ...(finalSchema?.properties ?? {}),
            embeddingModel: {
              type: "string",
              title: "Embedding Model",
              enum: provider.models,
              default: provider.models[0],
            },
            embeddingLocalPath: {
              type: "string",
              title: "Local path for embedding model (optional)",
              description:
                "Only needed if you prefer local files instead of downloading the model automatically.",
            },
          },
        } as RJSFSchema;
      } else {
        finalSchema = {
          ...(finalSchema as any),
          properties: {
            ...(finalSchema?.properties ?? {}),
            embeddingLocalPath: {
              type: "string",
              title: "Embedding Model Name",
              description: "Specify the name of the embedding model to use.",
            },
          },
        } as RJSFSchema;
      }
    }
  }

  const hasProps =
    !!finalSchema && Object.keys(finalSchema.properties ?? {}).length > 0;
  if (!hasProps) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={`Settings: ${methodItem.methodName}`}
        size="lg"
      >
        <div style={{ padding: 8, fontSize: 14, opacity: 0.8 }}>
          This method has no configurable settings.
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Settings: ${methodItem.methodName}${
        methodItem.embeddingProvider ? ` (${methodItem.embeddingProvider})` : ""
      }`}
      size="lg"
    >
      <Form<any, RJSFSchema, any>
        schema={finalSchema as RJSFSchema}
        uiSchema={(finalUiSchema || {}) as UiSchema}
        validator={validator}
        formData={methodItem.settings}
        onChange={(e) => onSettingsUpdate(e.formData)}
      >
        {/* live update via onChange */}
        <Button type="submit" style={{ display: "none" }} />
      </Form>
    </Modal>
  );
};

/** One row in the list */
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              open();
            }}
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

/** Main container */
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

  function defaultsFromCustomSchema(s?: { settings?: Record<string, any> }) {
    const props = s?.settings || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(props)) {
      if (v && typeof v === "object" && "default" in (v as any)) {
        out[k] = (v as any).default;
      }
    }
    return out;
  }

  const addMethod = useCallback(
    (
      m: Omit<RetrievalMethodSpec, "key" | "settings">,
      embeddingProviderValue?: string,
    ) => {
      const isCustom = m.source === "custom";

      // Find selected embedding provider (built-ins only)
      const provider = embeddingProviderValue
        ? embeddingProviders.find((p) => p.value === embeddingProviderValue)
        : undefined;

      let defaultSettings: Record<string, any> = {};

      if (isCustom) {
        // Pull defaults from normalized custom schema
        defaultSettings = defaultsFromCustomSchema(m.settingsSchema);
        if (!("shortName" in defaultSettings))
          defaultSettings.shortName = m.methodName;
      } else {
        const methodSchema = RetrievalMethodSchemas[m.baseMethod];
        if (methodSchema?.schema?.properties) {
          const schemaProps = methodSchema.schema.properties;
          defaultSettings = Object.entries(schemaProps).reduce(
            (acc, [key, prop]) => {
              if ("default" in prop) acc[key] = (prop as any).default;
              return acc;
            },
            {} as Record<string, any>,
          );
        }
        if (m.needsEmbeddingModel && provider?.models?.length) {
          defaultSettings.embeddingModel = provider.models[0];
        }
      }

      const newItem: RetrievalMethodSpec = {
        key: uuid(),
        baseMethod: m.baseMethod,
        methodName: m.methodName,
        library: m.library,
        emoji: m.emoji,
        needsEmbeddingModel: m.needsEmbeddingModel,
        ...(m.needsEmbeddingModel && embeddingProviderValue
          ? { embeddingProvider: provider?.value || "" }
          : {}),
        source: isCustom ? "custom" : "builtin",
        settingsSchema: isCustom ? m.settingsSchema : undefined,
        settings: defaultSettings,
      };

      const newItems = [...methodItems, newItem];
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const [menuOpened, setMenuOpened] = useState(false);

  // Thanks to the unified store normalizer, these are already consistent.
  const customRetrievers = useStore((s) => s.customRetrievers || []);

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
                  // Embedding-required methods: nested submenu to pick provider
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

                  // Methods that don't need embeddings
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

            {customRetrievers.length > 0 && (
              <>
                <Divider my="xs" />
                <Menu.Label>Custom Providers</Menu.Label>
                {customRetrievers.map((prov) => (
                  <Menu.Item
                    key={prov.key}
                    icon={prov.emoji ? <Text>{prov.emoji}</Text> : undefined}
                    onClick={() => {
                      // The store already guarantees a full, normalized spec-like shape.
                      addMethod({
                        baseMethod: prov.baseMethod,
                        methodName: prov.methodName,
                        library: prov.library,
                        emoji: prov.emoji,
                        needsEmbeddingModel: prov.needsEmbeddingModel,
                        source: "custom",
                        settingsSchema:
                          prov.settingsSchema ?? (prov as any).settings_schema, // tolerate legacy flows just in case
                      } as any);
                      setMenuOpened(false);
                    }}
                  >
                    {prov.methodName}
                  </Menu.Item>
                ))}
              </>
            )}
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
