import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
  useEffect,
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
  Badge,
  Stack,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconTrash,
  IconSettings,
  IconChevronRight,
  IconLink,
  IconUnlink,
  IconGitMerge,
} from "@tabler/icons-react";
import Form from "@rjsf/core";
import { RJSFSchema, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { v4 as uuid } from "uuid";
import {
  RetrievalMethodSchemas,
  retrievalMethodGroups,
  embeddingProviders,
  rankFusionMethods,
} from "./RetrievalMethodSchemas";
import useStore from "./store";
import { DatalistWidget } from "./ModelSettingsModal";
import NestedMenu, { NestedMenuItemProps } from "./NestedMenu";
import { ensureUniqueName } from "./backend/utils";

/** Linked group of methods with fusion settings */
export interface LinkedMethodGroup {
  id: string;
  methodKeys: string[];
  fusionMethod: string;
  fusionSettings: Record<string, any>;
  groupName?: string;
}

/** Enhanced method spec to track group membership */
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
  settingsSchema?: { settings?: Record<string, any>; ui?: Record<string, any> };
  groupId?: string; // Links to a LinkedMethodGroup
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
  let finalUiSchema = (customSchema?.uiSchema ?? builtin?.uiSchema) as
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
        finalUiSchema = {
          ...(finalUiSchema || {}),
          embeddingModel: {
            "ui:widget": "datalist",
          },
        } as UiSchema;
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
        widgets={{ datalist: DatalistWidget }}
      >
        {/* live update via onChange */}
        <Button type="submit" style={{ display: "none" }} />
      </Form>
    </Modal>
  );
};

/** Fusion Settings Modal */
interface FusionSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  group: LinkedMethodGroup;
  onSettingsUpdate: (settings: any) => void;
  onFusionMethodChange: (
    groupId: string,
    fusionMethod: string,
    defaultSettings: any,
  ) => void;
  methodItems: RetrievalMethodSpec[];
}

const FusionSettingsModal: React.FC<FusionSettingsModalProps> = ({
  opened,
  onClose,
  group,
  onSettingsUpdate,
  onFusionMethodChange,
  methodItems,
}) => {
  const fusionMethod = useMemo(
    () => rankFusionMethods.find((m) => m.value === group.fusionMethod),
    [group?.fusionMethod],
  );

  const groupMethods = useMemo(
    () => methodItems.filter((m) => group.methodKeys.includes(m.key)),
    [methodItems, group?.methodKeys],
  );

  const handleFusionMethodChange = (newMethod: string) => {
    const selectedMethod = rankFusionMethods.find((m) => m.value === newMethod);
    if (!selectedMethod) return;

    // Extract default settings from the new method's schema
    const defaultSettings: Record<string, any> = {};
    if (selectedMethod.schema?.properties) {
      Object.entries(selectedMethod.schema.properties).forEach(
        ([key, prop]) => {
          if (prop && typeof prop === "object" && "default" in prop) {
            defaultSettings[key] = (prop as any).default;
          }
        },
      );
    }

    onFusionMethodChange(group.id, newMethod, defaultSettings);
  };

  const methodLabels = useMemo(
    () => groupMethods.map((m) => m.settings?.shortName || m.methodName),
    [groupMethods],
  );
  const weightKeys = useMemo(
    () => methodLabels.map((_, i) => `w_${i}`),
    [methodLabels],
  );

  // flags
  const isRRF = fusionMethod?.value === "reciprocal_rank_fusion";

  // dynamic schema: k + one number field per method (titles = labels)
  const dynamicSchema: RJSFSchema = useMemo(() => {
    const props: Record<string, any> = {};

    if (isRRF) {
      props.k = {
        type: "number",
        title: "K Parameter",
        default: 60,
        description: "Parameter for RRF formula (higher = more democratic)",
      };
    }

    methodLabels.forEach((label, i) => {
      props[`w_${i}`] = {
        type: "number",
        title: label,
        description:
          "Set a weight per method (0–1). 1 = equal weight; 0 effectively mutes the method.",
        default: 1,
        minimum: 0,
        maximum: 1,
      };
    });

    const order: string[] = [];
    if (props.k) order.push("k");
    order.push(...methodLabels.map((_, i) => `w_${i}`));

    return { type: "object", properties: props, "ui:order": order } as any;
  }, [isRRF, methodLabels]);

  const [formData, setFormData] = useState<any>(() => {
    const fd: any = { k: group.fusionSettings?.k ?? 60 };
    weightKeys.forEach((key, i) => {
      const v = group.fusionSettings?.weights?.[i];
      fd[key] = Number.isFinite(v) ? Math.min(1, Math.max(0, v as number)) : 1;
    });
    return fd;
  });

  useEffect(() => {
    const next: any = { k: group.fusionSettings?.k ?? 60 };
    weightKeys.forEach((key, i) => {
      const v = group.fusionSettings?.weights?.[i];
      next[key] = Number.isFinite(v)
        ? Math.min(1, Math.max(0, v as number))
        : 1;
    });
    setFormData(next);
  }, [opened, group.id, weightKeys.join("|")]);

  const handleSubmit = (e: any) => {
    const data = e.formData || {};
    const weights = methodLabels.map((_, i) => {
      const n = Number(data[`w_${i}`]);
      return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
    });

    if (isRRF) {
      // k + weights
      onSettingsUpdate({ k: Number(data.k ?? 60), weights });
    } else {
      // weights only
      onSettingsUpdate({ weights });
    }
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Rank Fusion Settings`}
      size="lg"
    >
      <Stack spacing="md">
        <Box>
          <Text size="sm" weight={500} mb="xs">
            Linked Methods:&nbsp;
            {groupMethods.map((method) => (
              <Badge key={method.key} variant="light" mr="xs">
                {method.emoji} {method.settings?.shortName || method.methodName}
              </Badge>
            ))}
          </Text>
        </Box>

        <Box>
          <Text size="sm" weight={500} mb="xs">
            Fusion Method:
          </Text>
          <select
            value={group.fusionMethod}
            onChange={(e) => handleFusionMethodChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
            }}
          >
            {rankFusionMethods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
          {fusionMethod?.description && (
            <Text size="xs" color="dimmed" mt="xs">
              {fusionMethod.description}
            </Text>
          )}
        </Box>

        {fusionMethod?.schema && (
          <Box>
            <Text size="sm" weight={500} mb="xs">
              Settings:
            </Text>

            <Form<any, RJSFSchema, any>
              schema={dynamicSchema}
              validator={validator}
              formData={formData}
              noHtml5Validate
              liveValidate
              onChange={(e) => setFormData(e.formData)} // local only while typing
              onSubmit={handleSubmit} // commit once
            >
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <Button variant="default" onClick={onClose} type="button">
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </Form>
          </Box>
        )}
      </Stack>
    </Modal>
  );
};

/** One row in the list */
interface RetrievalMethodListItemProps {
  methodItem: RetrievalMethodSpec;
  onRemove: (key: string) => void;
  onSettingsUpdate: (key: string, settings: any) => void;
  latency?: string;
}

const RetrievalMethodListItem: React.FC<
  RetrievalMethodListItemProps & {
    isLinked?: boolean;
    isFirstInGroup?: boolean;
    isLastInGroup?: boolean;
    onLink?: () => void;
    onUnlink?: () => void;
    onFusionSettings?: () => void;
  }
> = ({
  methodItem,
  onRemove,
  onSettingsUpdate,
  latency,
  isLinked = false,
  isFirstInGroup = false,
  isLastInGroup = false,
  onLink,
  onUnlink,
  onFusionSettings,
}) => {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <div
        className="llm-list-item"
        style={{
          marginBottom: isLinked && !isLastInGroup ? 2 : 8,
          borderLeft: isLinked ? "4px solid #228be6" : undefined,
          borderRadius: isLinked
            ? isFirstInGroup
              ? "6px 6px 0 0"
              : isLastInGroup
                ? "0 0 6px 6px"
                : "0"
            : 6,

          // row look & single-line layout
          boxShadow: "0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.24)",
          padding: "6px 8px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          columnGap: 12,
        }}
      >
        {/* Title (left) */}
        <div className="llm-card-header">
          {methodItem.emoji && `${methodItem.emoji} `}
          {methodItem.settings?.shortName || methodItem.methodName}
          {latency && (
            <Badge
              size="xs"
              color="gray"
              variant="outline"
              style={{ marginLeft: 8, textTransform: "none", fontWeight: 400 }}
            >
              {latency}
            </Badge>
          )}
        </div>

        {/* Actions (right) */}
        <div className="llm-row-actions">
          {isFirstInGroup && (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="blue"
              onClick={onFusionSettings}
              title="Fusion Settings"
            >
              <IconGitMerge size={14} />
            </ActionIcon>
          )}
          {!isLinked && onLink && (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="green"
              onClick={onLink}
              title="Link with next method"
            >
              <IconLink size={14} />
            </ActionIcon>
          )}
          {isLinked && onUnlink && (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="orange"
              onClick={onUnlink}
              title="Unlink methods"
            >
              <IconUnlink size={14} />
            </ActionIcon>
          )}
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              open();
            }}
            title="Settings"
          >
            <IconSettings size={14} />
          </ActionIcon>
        </div>
      </div>

      {/* Keep modal mounted alongside the row so open()/close() works */}
      <SettingsModal
        opened={opened}
        onClose={close}
        methodItem={methodItem}
        onSettingsUpdate={(settings) =>
          onSettingsUpdate(methodItem.key, settings)
        }
      />
    </>
  );
};

/** Main container */
export interface RetrievalMethodListContainerProps {
  initMethodItems?: RetrievalMethodSpec[];
  initLinkedGroups?: LinkedMethodGroup[];
  onGroupsChange?: (groups: LinkedMethodGroup[]) => void;
  onItemsChange?: (
    newItems: RetrievalMethodSpec[],
    oldItems: RetrievalMethodSpec[],
  ) => void;
  methodResults?: Record<string, any>;
}

export const RetrievalMethodListContainer = forwardRef<
  any,
  RetrievalMethodListContainerProps
>((props, ref) => {
  const [methodItems, setMethodItems] = useState<RetrievalMethodSpec[]>(
    props.initMethodItems || [],
  );
  const linkedGroups: LinkedMethodGroup[] = props.initLinkedGroups ?? [];

  const [fusionModalGroup, setFusionModalGroup] =
    useState<LinkedMethodGroup | null>(null);
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

      const uniqueName = ensureUniqueName(
        m.methodName,
        methodItems.map((i) => i.settings?.shortName || i.methodName),
      );

      if (isCustom) {
        // Pull defaults from normalized custom schema
        defaultSettings = defaultsFromCustomSchema(m.settingsSchema);
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
      defaultSettings.shortName = uniqueName;

      const newItem: RetrievalMethodSpec = {
        key: uuid(),
        baseMethod: m.baseMethod,
        methodName: uniqueName,
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

  // Thanks to the unified store normalizer, these are already consistent.
  const customRetrievers = useStore((s) => s.customRetrievers || []);

  const handleLinkMethods = useCallback(
    (methodKey: string) => {
      const currentIndex = methodItems.findIndex((m) => m.key === methodKey);
      if (currentIndex === -1 || currentIndex === methodItems.length - 1)
        return;

      const nextMethod = methodItems[currentIndex + 1];
      if (nextMethod.groupId) return;

      const newGroupId = uuid();
      const newGroup: LinkedMethodGroup = {
        id: newGroupId,
        methodKeys: [methodKey, nextMethod.key],
        fusionMethod: "reciprocal_rank_fusion",
        fusionSettings: { k: 60 },
      };

      props.onGroupsChange?.([...(linkedGroups || []), newGroup]);

      const newItems = methodItems.map((m) =>
        m.key === methodKey || m.key === nextMethod.key
          ? { ...m, groupId: newGroupId }
          : m,
      );
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const handleUnlinkMethods = useCallback(
    (groupId: string) => {
      props.onGroupsChange?.(
        (linkedGroups || []).filter((g) => g.id !== groupId),
      );

      const newItems = methodItems.map((m) =>
        m.groupId === groupId ? { ...m, groupId: undefined } : m,
      );
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  const handleFusionSettingsUpdate = useCallback(
    (groupId: string, settings: any) => {
      // Update the source of truth
      props.onGroupsChange?.(
        (linkedGroups || []).map((g) =>
          g.id === groupId ? { ...g, fusionSettings: settings } : g,
        ),
      );

      //  Keep the modal's local state in lockstep so RJSF stays editable
      setFusionModalGroup((prev) =>
        prev && prev.id === groupId
          ? { ...prev, fusionSettings: settings }
          : prev,
      );
    },
    [linkedGroups, props.onGroupsChange],
  );

  const handleFusionMethodChange = useCallback(
    (groupId: string, fusionMethod: string, defaultSettings: any) => {
      props.onGroupsChange?.(
        (linkedGroups || []).map((g) =>
          g.id === groupId
            ? { ...g, fusionMethod, fusionSettings: defaultSettings }
            : g,
        ),
      );
      setFusionModalGroup((prev) =>
        prev
          ? {
              ...prev,
              fusionMethod,
              fusionSettings: defaultSettings,
            }
          : null,
      );
    },
    [linkedGroups, props.onGroupsChange],
  );

  const addMenuItems: NestedMenuItemProps[] = useMemo(() => {
    // Built-in retrieval groups
    const builtInGroups: NestedMenuItemProps[] = retrievalMethodGroups.map(
      (group) => ({
        key: `group-${group.label}`,
        title: group.label,
        items: group.items.flatMap((m) => {
          // If a method needs an embedding provider, make it a nested submenu
          if (m.needsEmbeddingModel) {
            return [
              {
                key: `method-${m.baseMethod}`,
                title: m.methodName,
                icon: m.emoji ? <Text>{m.emoji}</Text> : undefined,
                items: embeddingProviders.map((prov) => ({
                  key: `method-${m.baseMethod}-${prov.value}`,
                  title: prov.label,
                  tooltip: m.description,
                  onClick: () => addMethod(m, prov.value),
                })),
              },
            ] as NestedMenuItemProps[];
          }
          // Otherwise, a simple leaf item
          return [
            {
              key: `method-${m.baseMethod}`,
              title: m.methodName,
              tooltip: m.description,
              icon: m.emoji ? <Text>{m.emoji}</Text> : undefined,
              onClick: () => addMethod(m),
            },
          ] as NestedMenuItemProps[];
        }),
      }),
    );

    // Custom retrievers group (if any)
    const customGroup: NestedMenuItemProps[] =
      customRetrievers.length > 0
        ? [
            {
              key: "group-custom",
              title: "Custom Providers",
              items: customRetrievers.map((prov) => ({
                key: `custom-${prov.key}`,
                title: prov.methodName,
                icon: prov.emoji ? <Text>{prov.emoji}</Text> : undefined,
                onClick: () =>
                  addMethod({
                    baseMethod: prov.baseMethod,
                    methodName: prov.methodName,
                    library: prov.library,
                    emoji: prov.emoji,
                    needsEmbeddingModel: prov.needsEmbeddingModel,
                    source: "custom",
                    settingsSchema:
                      prov.settingsSchema ?? (prov as any).settings_schema,
                  } as any),
              })),
            },
          ]
        : [];

    return [...builtInGroups, ...customGroup];
  }, [retrievalMethodGroups, customRetrievers, embeddingProviders, addMethod]);

  return (
    <div className="llm-list-container nowheel">
      <div className="llm-list-backdrop nodrag">
        <span className="llm-card-header">Retrieval Methods</span>
        <div className="add-llm-model-btn nodrag">
          <NestedMenu
            items={addMenuItems}
            button={(toggle) => <button onClick={toggle}>Add +</button>}
          />
        </div>
      </div>

      <div className="list nowheel nodrag">
        <ScrollArea.Autosize mah={500} type="never">
          {methodItems.length === 0 ? (
            <Text size="xs" color="dimmed" className="nodrag">
              No retrieval methods selected.
            </Text>
          ) : (
            methodItems.map((item) => {
              const group = linkedGroups.find((g) => g.id === item.groupId);
              const members = methodItems.filter(
                (m) => m.groupId === group?.id,
              );
              const isLinked = !!group;
              const isFirstInGroup = isLinked && members[0]?.key === item.key;
              const isLastInGroup =
                isLinked && members[members.length - 1]?.key === item.key;
              const latency =
                props.methodResults?.[item.key]?.metavars?.latency;

              return (
                <RetrievalMethodListItem
                  key={item.key}
                  methodItem={item}
                  onRemove={handleRemoveMethod}
                  onSettingsUpdate={handleSettingsUpdate}
                  latency={latency}
                  isLinked={isLinked}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  onLink={() => handleLinkMethods(item.key)}
                  onUnlink={
                    group ? () => handleUnlinkMethods(group.id) : undefined
                  }
                  onFusionSettings={
                    isFirstInGroup && group
                      ? () => setFusionModalGroup(group)
                      : undefined
                  }
                />
              );
            })
          )}
        </ScrollArea.Autosize>
      </div>

      {fusionModalGroup && (
        <FusionSettingsModal
          opened={!!fusionModalGroup}
          onClose={() => setFusionModalGroup(null)}
          group={fusionModalGroup}
          methodItems={methodItems}
          onSettingsUpdate={(settings) =>
            handleFusionSettingsUpdate(fusionModalGroup.id, settings)
          }
          onFusionMethodChange={handleFusionMethodChange}
        />
      )}
    </div>
  );
});

RetrievalMethodListContainer.displayName = "RetrievalMethodListContainer";
export default RetrievalMethodListContainer;
