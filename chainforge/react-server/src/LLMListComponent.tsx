import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useReducer,
  useMemo,
} from "react";
import {
  DragDropContext,
  Draggable,
  DraggableProvided,
  DraggableRubric,
  DraggableStateSnapshot,
  DroppableProvided,
  OnDragEndResponder,
} from "react-beautiful-dnd";
import { v4 as uuid } from "uuid";
import LLMListItem, { LLMListItemClone } from "./LLMListItem";
import { StrictModeDroppable } from "./StrictModeDroppable";
import ModelSettingsModal, {
  ModelSettingsModalRef,
} from "./ModelSettingsModal";
import {
  getDefaultModelFormData,
  getDefaultModelSettings,
} from "./ModelSettingSchemas";
import useStore, { initLLMProviders, initLLMProviderMenu } from "./store";
import { Dict, JSONCompatible, LLMGroup, LLMSpec } from "./backend/typing";
import { useContextMenu } from "mantine-contextmenu";
import { ContextMenuItemOptions } from "mantine-contextmenu/dist/types";

// The LLM(s) to include by default on a PromptNode whenever one is created.
// Defaults to ChatGPT (GPT3.5) when running locally, and HF-hosted falcon-7b for online version since it's free.
const DEFAULT_INIT_LLMS = [initLLMProviders[0]];

// Helper funcs
// Ensure that a name is 'unique'; if not, return an amended version with a count tacked on (e.g. "GPT-4 (2)")
const ensureUniqueName = (_name: string, _prev_names: string[]) => {
  // Strip whitespace around names
  const prev_names = _prev_names.map((n) => n.trim());
  const name = _name.trim();

  // Check if name is unique
  if (!prev_names.includes(name)) return name;

  // Name isn't unique; find a unique one:
  let i = 2;
  let new_name = `${name} (${i})`;
  while (prev_names.includes(new_name)) {
    i += 1;
    new_name = `${name} (${i})`;
  }
  return new_name;
};

/** Get position CSS style below and left-aligned to the input element */
const getPositionCSSStyle = (
  elem: HTMLButtonElement,
): ContextMenuItemOptions => {
  const rect = elem.getBoundingClientRect();
  return {
    key: "contextmenu",
    style: {
      position: "absolute",
      left: `${rect.left}px`,
      top: `${rect.bottom}px`,
    },
  };
};

export function LLMList({
  llms,
  onItemsChange,
  hideTrashIcon,
}: {
  llms: LLMSpec[];
  onItemsChange: (new_items: LLMSpec[]) => void;
  hideTrashIcon: boolean;
}) {
  const [items, setItems] = useState(llms);
  const settingsModal = useRef<ModelSettingsModalRef>(null);
  const [selectedModel, setSelectedModel] = useState<LLMSpec | undefined>(
    undefined,
  );

  const updateItems = useCallback(
    (new_items: LLMSpec[]) => {
      setItems(new_items);
      onItemsChange(new_items);
    },
    [onItemsChange],
  );

  const onClickSettings = useCallback(
    (item: LLMSpec) => {
      if (settingsModal && settingsModal.current) {
        setSelectedModel(item);
        settingsModal.current.trigger();
      }
    },
    [settingsModal],
  );

  const onSettingsSubmit = useCallback(
    (
      savedItem: LLMSpec,
      formData: Dict<JSONCompatible>,
      settingsData: Dict<JSONCompatible>,
    ) => {
      // First check for the item with key and get it:
      const llm = items.find((i) => i.key === savedItem.key);
      if (!llm) {
        console.error(
          `Could not update model settings: Could not find item with key ${savedItem.key}.`,
        );
        return;
      }

      const prev_names = items
        .filter((item) => item.key !== savedItem.key)
        .map((item) => item.name);

      // Change the settings for the LLM item to the value of 'formData':
      updateItems(
        items.map((item) => {
          if (item.key === savedItem.key) {
            // Create a new item with the same settings
            const updated_item: LLMSpec = { ...item };
            updated_item.formData = { ...formData };
            updated_item.settings = { ...settingsData };

            if ("model" in formData) {
              // Update the name of the specific model to call
              if (item.base_model.startsWith("__custom"))
                // Custom models must always have their base name, to avoid name collisions
                updated_item.model = item.base_model + "/" + formData.model;
              else if (item.base_model === "together")
                updated_item.model = ("together/" + formData.model) as string;
              else updated_item.model = formData.model as string;
            }
            if ("shortname" in formData) {
              // Change the name, amending any name that isn't unique to ensure it is unique:
              const unique_name = ensureUniqueName(
                formData.shortname as string,
                prev_names,
              );
              updated_item.name = unique_name;
              if (updated_item.formData?.shortname)
                updated_item.formData.shortname = unique_name;
            }

            if (savedItem.emoji) updated_item.emoji = savedItem.emoji;

            return updated_item;
          } else return item;
        }),
      );
    },
    [items, updateItems],
  );

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (
      (destination.droppableId === source.droppableId &&
        destination.index === source.index) ||
      !result.destination
    ) {
      return;
    }
    const newItems = Array.from(items);
    const [removed] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, removed);
    setItems(newItems);
  };

  const removeItem = useCallback(
    (item_key: string) => {
      // Double-check that the item we want to remove is in the list of items...
      if (!items.find((i) => i.key === item_key)) {
        console.error(
          `Could not remove model from LLM list: Could not find item with key ${item_key}.`,
        );
        return;
      }
      // Remove it
      updateItems(items.filter((i) => i.key !== item_key));
    },
    [items, updateItems],
  );

  useEffect(() => {
    // When LLMs list changes, we need to add new items
    // while preserving the current order of 'items'.
    // Check for new items and for each, add to end:
    const new_items = Array.from(
      items.filter((i) => llms.some((v) => v.key === i.key)),
    );
    llms.forEach((item) => {
      if (!items.find((i) => i.key === item.key)) new_items.push(item);
    });

    updateItems(new_items);
  }, [llms]);

  return (
    <div className="list nowheel nodrag">
      <ModelSettingsModal
        ref={settingsModal}
        model={selectedModel}
        onSettingsSubmit={onSettingsSubmit}
      />
      <DragDropContext onDragEnd={onDragEnd}>
        <StrictModeDroppable
          droppableId="llm-list-droppable"
          renderClone={(
            provided: DraggableProvided,
            snapshot: DraggableStateSnapshot,
            rubric: DraggableRubric,
          ) => (
            <LLMListItemClone
              provided={provided}
              snapshot={snapshot}
              item={items[rubric.source.index]}
              hideTrashIcon={hideTrashIcon}
            />
          )}
        >
          {(provided: DroppableProvided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {items.map((item, index) => (
                <Draggable
                  key={item.key}
                  draggableId={item.key ?? index.toString()}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <LLMListItem
                      provided={provided}
                      snapshot={snapshot}
                      item={item}
                      removeCallback={removeItem}
                      progress={item.progress}
                      onClickSettings={() => onClickSettings(item)}
                      hideTrashIcon={hideTrashIcon}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </StrictModeDroppable>
      </DragDropContext>
    </div>
  );
}

export interface LLMListContainerRef {
  resetLLMItemsProgress: () => void;
  setZeroPercProgress: () => void;
  updateProgress: (itemProcessorFunc: (llm: LLMSpec) => LLMSpec) => void;
  ensureLLMItemsErrorProgress: (llm_keys_w_errors: string[]) => void;
  getLLMListItemForKey: (key: string) => LLMSpec | undefined;
  refreshLLMProviderList: () => void;
}

export interface LLMListContainerProps {
  initLLMItems: LLMSpec[];
  description?: string;
  modelSelectButtonText?: string;
  onSelectModel?: (llm: LLMSpec, new_llms: LLMSpec[]) => void;
  onItemsChange?: (new_llms: LLMSpec[], old_llms: LLMSpec[]) => void;
  hideTrashIcon?: boolean;
  bgColor?: string;
  selectModelAction?: "add" | "replace";
}

export const LLMListContainer = forwardRef<
  LLMListContainerRef,
  LLMListContainerProps
>(function LLMListContainer(
  {
    description,
    modelSelectButtonText,
    initLLMItems,
    onSelectModel,
    selectModelAction,
    onItemsChange,
    hideTrashIcon,
    bgColor,
  },
  ref,
) {
  // All available LLM providers, for the dropdown list
  const AvailableLLMs = useStore((state) => state.AvailableLLMs);
  const { showContextMenu, hideContextMenu, isContextMenuVisible } =
    useContextMenu();
  // For some reason, when the AvailableLLMs list is updated in the store/, it is not
  // immediately updated here. I've tried all kinds of things, but cannot seem to fix this problem.
  // We must force a re-render of the component:
  // eslint-disable-next-line
  const [ignored, forceUpdate] = useReducer((x) => x + 1, 0);
  const refreshLLMProviderList = () => {
    forceUpdate();
  };

  // Selecting LLM models to prompt
  const [llmItems, setLLMItems] = useState(
    initLLMItems ||
      DEFAULT_INIT_LLMS.map((i) => ({
        key: uuid(),
        settings: getDefaultModelSettings(i.base_model),
        ...i,
      })),
  );
  const [llmItemsCurrState, setLLMItemsCurrState] = useState<LLMSpec[]>([]);
  const resetLLMItemsProgress = useCallback(() => {
    setLLMItems(
      llmItemsCurrState.map((item) => {
        item.progress = undefined;
        return item;
      }),
    );
  }, [llmItemsCurrState]);
  const setZeroPercProgress = useCallback(() => {
    setLLMItems(
      llmItemsCurrState.map((item) => {
        item.progress = { success: 0, error: 0 };
        return item;
      }),
    );
  }, [llmItemsCurrState]);
  const updateProgress = useCallback(
    (itemProcessorFunc: (llm: LLMSpec) => LLMSpec) => {
      setLLMItems(llmItemsCurrState.map(itemProcessorFunc));
    },
    [llmItemsCurrState],
  );
  const ensureLLMItemsErrorProgress = useCallback(
    (llm_keys_w_errors: string[]) => {
      setLLMItems(
        llmItemsCurrState.map((item) => {
          if (item.key !== undefined && llm_keys_w_errors.includes(item.key)) {
            if (!item.progress) item.progress = { success: 0, error: 100 };
            else {
              const succ_perc = item.progress.success;
              item.progress = { success: succ_perc, error: 100 - succ_perc };
            }
          } else {
            if (item.progress && item.progress.success === 0)
              item.progress = undefined;
          }

          return item;
        }),
      );
    },
    [llmItemsCurrState],
  );

  const getLLMListItemForKey = useCallback(
    (key: string) => {
      return llmItemsCurrState.find((item) => item.key === key);
    },
    [llmItemsCurrState],
  );

  const handleSelectModel = useCallback(
    (item: LLMSpec) => {
      // Give it a uid as a unique key (this is needed for the draggable list to support multiple same-model items; keys must be unique)
      item = { key: uuid(), ...item };

      // Generate the default settings for this model
      item.settings = getDefaultModelSettings(item.base_model);

      // Repair names to ensure they are unique
      const unique_name = ensureUniqueName(
        item.name,
        llmItemsCurrState.map((i) => i.name),
      );
      item.name = unique_name;
      item.formData = { shortname: unique_name };

      // Together models have a substring "together/" that we need to strip:
      if (item.base_model === "together")
        item.formData.model = item.model.substring(9);
      else item.formData.model = item.model;

      let new_items: LLMSpec[] = [];
      if (selectModelAction === "add" || selectModelAction === undefined) {
        // Add model to the LLM list (regardless of it's present already or not).
        new_items = llmItemsCurrState.concat([item]);
      } else if (selectModelAction === "replace") {
        // Remove existing model from LLM list and replace with new one:
        new_items = [item];
      }

      setLLMItems(new_items);
      if (onSelectModel) onSelectModel(item, new_items);
    },
    [llmItemsCurrState, onSelectModel, selectModelAction, AvailableLLMs],
  );

  const onLLMListItemsChange = useCallback(
    (new_items: LLMSpec[]) => {
      setLLMItemsCurrState(new_items);
      if (onItemsChange) onItemsChange(new_items, llmItemsCurrState);
    },
    [setLLMItemsCurrState, onItemsChange],
  );

  // This gives the parent access to triggering methods on this object
  useImperativeHandle(ref, () => ({
    resetLLMItemsProgress,
    setZeroPercProgress,
    updateProgress,
    ensureLLMItemsErrorProgress,
    getLLMListItemForKey,
    refreshLLMProviderList,
  }));

  const _bgStyle = useMemo(
    () => (bgColor ? { backgroundColor: bgColor } : {}),
    [bgColor],
  );

  const menuItems = useMemo(() => {
    const initModels: Set<string> = new Set<string>();
    const convert = (item: LLMSpec | LLMGroup): ContextMenuItemOptions => {
      if ("group" in item) {
        return {
          key: item.group,
          title: `${item.emoji} ${item.group}`,
          items: item.items.map(convert),
        };
      } else {
        initModels.add(item.base_model);
        return {
          key: item.model,
          title: `${item.emoji} ${item.name}`,
          onClick: () => handleSelectModel(item),
        };
      }
    };
    const res = initLLMProviderMenu.map(convert);

    for (const item of AvailableLLMs) {
      if (initModels.has(item.base_model)) {
        continue;
      }
      res.push({
        key: item.base_model,
        title: `${item.emoji} ${item.name}`,
        onClick: () => handleSelectModel(item),
      });
    }
    return res;
  }, [AvailableLLMs, handleSelectModel]);

  // Mantine ContextMenu does not fix the position of the menu
  // to be below the clicked button, so we must do it ourselves.
  const addBtnRef = useRef(null);
  const [wasContextMenuToggled, setWasContextMenuToggled] = useState(false);

  return (
    <div className="llm-list-container nowheel" style={_bgStyle}>
      <div className="llm-list-backdrop" style={_bgStyle}>
        {description || "Models to query:"}
        <div className="add-llm-model-btn nodrag">
          <button
            ref={addBtnRef}
            style={_bgStyle}
            onPointerDownCapture={() => {
              setWasContextMenuToggled(
                isContextMenuVisible && wasContextMenuToggled,
              );
            }}
            onClick={(evt) => {
              if (wasContextMenuToggled) {
                setWasContextMenuToggled(false);
                return; // abort
              }
              // This is a hack ---without hiding, the context menu position is not always updated.
              // This is the case even if hideContextMenu() was triggered elsewhere.
              hideContextMenu();
              // Now show the context menu below the button:
              showContextMenu(
                menuItems,
                addBtnRef?.current
                  ? getPositionCSSStyle(addBtnRef.current)
                  : undefined,
              )(evt);

              // Save whether the context menu was open, before
              // onPointerDown in App.tsx could auto-close the menu.
              setWasContextMenuToggled(true);
            }}
          >
            {modelSelectButtonText ?? "Add +"}
          </button>
        </div>
      </div>
      <div className="nodrag">
        <LLMList
          llms={llmItems}
          onItemsChange={onLLMListItemsChange}
          hideTrashIcon={hideTrashIcon ?? false}
        />
      </div>
    </div>
  );
});
