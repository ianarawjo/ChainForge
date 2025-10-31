import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from "react";
import { Button, Text, Modal, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { v4 as uuid } from "uuid";
import { RerankMethodSchemas, rerankMethodGroups } from "./RerankMethodSchemas";
import NestedMenu, { NestedMenuItemProps } from "./NestedMenu";
import LLMItemButtonGroup from "./LLMItemButtonGroup";
import useStore from "./store";
import { DatalistWidget } from "./ModelSettingsModal";

export interface RerankMethodSpec {
  key: string;
  baseMethod: string;
  methodType: string;
  name: string;
  emoji?: string;
  settings?: Record<string, any>;
}

export interface RerankMethodListContainerProps {
  initMethodItems?: RerankMethodSpec[];
  onItemsChange?: (
    newItems: RerankMethodSpec[],
    oldItems: RerankMethodSpec[],
  ) => void;
}
export type RerankMethodListContainerRef = Record<string, never>;

const RerankMethodListItem: React.FC<{
  methodItem: RerankMethodSpec;
  onRemove: (key: string) => void;
  onSettingsUpdate: (key: string, newSettings: any) => void;
}> = ({ methodItem, onRemove, onSettingsUpdate }) => {
  // Fetch the relevant schema
  const schemaEntry = useMemo(
    () =>
      RerankMethodSchemas[methodItem.baseMethod] || {
        schema: {},
        uiSchema: {},
        description: "",
        fullName: "",
      },
    [methodItem],
  );
  const schema = useMemo(() => {
    return schemaEntry?.schema;
  }, [schemaEntry]);
  const uiSchema = useMemo(() => schemaEntry?.uiSchema, [schemaEntry]);

  const [settingsModalOpen, { open, close }] = useDisclosure(false);

  return (
    <div className="llm-list-item">
      <div>
        <div className="llm-card-header">
          {methodItem.emoji ? methodItem.emoji + " " : ""}
          {methodItem.name}
        </div>

        <LLMItemButtonGroup
          onClickTrash={() => onRemove(methodItem.key)}
          onClickSettings={open} // from useDisclosure(false)
          hideTrashIcon={false}
        />
      </div>

      <Modal
        opened={settingsModalOpen}
        onClose={close}
        title="Rerank Method Settings"
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
            widgets={{ datalist: DatalistWidget } as any}
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

const RerankMethodListContainer = forwardRef<
  RerankMethodListContainerRef,
  RerankMethodListContainerProps
>((props, ref) => {
  const [methodItems, setMethodItems] = useState<RerankMethodSpec[]>(
    props.initMethodItems || [],
  );
  const oldItemsRef = useRef<RerankMethodSpec[]>(methodItems);

  useImperativeHandle(ref, () => ({}));

  // If parent node wants to track changes
  const notifyItemsChanged = useCallback(
    (newItems: RerankMethodSpec[]) => {
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

  // Update method settings
  const handleUpdateMethodSettings = useCallback(
    (key: string, newSettings: any) => {
      const newItems = methodItems.map((m) =>
        m.key === key ? { ...m, settings: newSettings } : m,
      );
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  // Add method
  const handleAddMethod = useCallback(
    (
      baseMethod: string,
      name: string,
      emoji: string,
      methodType: string,
      customDefaults?: Record<string, any>,
    ) => {
      const key = uuid();
      const schemaEntry = RerankMethodSchemas[baseMethod];

      // Pull defaults from schema
      let defaultSettings: Record<string, any> = {};
      if (schemaEntry?.schema?.properties) {
        const schemaProps = schemaEntry.schema.properties;
        defaultSettings = Object.entries(schemaProps).reduce(
          (acc, [propKey, propDef]) => {
            if (
              propDef &&
              typeof propDef === "object" &&
              "default" in propDef
            ) {
              acc[propKey] = (propDef as any).default;
            }
            return acc;
          },
          {} as Record<string, any>,
        );
      }

      // Override with custom defaults if provided
      if (customDefaults) {
        defaultSettings = { ...defaultSettings, ...customDefaults };
      }

      const newMethod: RerankMethodSpec = {
        key,
        baseMethod,
        methodType,
        name,
        emoji,
        settings: defaultSettings,
      };

      const newItems = [...methodItems, newMethod];
      setMethodItems(newItems);
      notifyItemsChanged(newItems);
    },
    [methodItems, notifyItemsChanged],
  );

  // Build nested menu items
  const menuItems = useMemo((): NestedMenuItemProps[] => {
    return rerankMethodGroups.map((group) => ({
      key: `group-${group.label}`,
      title: group.label,
      items: group.items.map((item) => ({
        key: `method-${item.baseMethod}-${item.name}`,
        title: `${item.emoji} ${item.name}`,
        onClick: () =>
          handleAddMethod(
            item.baseMethod,
            item.name,
            item.emoji,
            item.library,
            (item as any).defaultSettings,
          ),
      })),
    }));
  }, [handleAddMethod]);

  return (
    <div className="llm-list-container nowheel">
      <div className="llm-list-backdrop">
        <span>Reranking Methods</span>

        <div className="add-llm-model-btn nodrag">
          <NestedMenu
            items={menuItems}
            button={(toggle) => <button onClick={toggle}>Add +</button>}
          />
        </div>
      </div>

      {methodItems.length === 0 ? (
        <div className="nodrag">
          <Text size="xs" color="dimmed">
            No reranking methods selected.
          </Text>
        </div>
      ) : (
        <div className="nodrag">
          {/* List of Selected Methods */}
          <ScrollArea style={{ height: "auto", maxHeight: "300px" }}>
            {methodItems.map((method) => (
              <RerankMethodListItem
                key={method.key}
                methodItem={method}
                onRemove={handleRemoveMethod}
                onSettingsUpdate={handleUpdateMethodSettings}
              />
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
});

RerankMethodListContainer.displayName = "RerankMethodListContainer";

export default RerankMethodListContainer;
