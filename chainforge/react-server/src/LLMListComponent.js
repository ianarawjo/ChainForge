import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useReducer } from "react";
import { DragDropContext, Draggable } from "react-beautiful-dnd";
import { Menu } from "@mantine/core";
import { v4 as uuid } from 'uuid';
import LLMListItem, { LLMListItemClone } from "./LLMListItem";
import { StrictModeDroppable } from './StrictModeDroppable';
import ModelSettingsModal from "./ModelSettingsModal";
import { getDefaultModelSettings } from './ModelSettingSchemas';
import useStore, { initLLMProviders } from "./store";

// The LLM(s) to include by default on a PromptNode whenever one is created.
// Defaults to ChatGPT (GPT3.5) when running locally, and HF-hosted falcon-7b for online version since it's free.
const DEFAULT_INIT_LLMS = [initLLMProviders[0]];

// Helper funcs
// Ensure that a name is 'unique'; if not, return an amended version with a count tacked on (e.g. "GPT-4 (2)")
const ensureUniqueName = (_name, _prev_names) => {
  // Strip whitespace around names
  const prev_names = _prev_names.map(n => n.trim());
  const name = _name.trim();

  // Check if name is unique
  if (!prev_names.includes(name))
    return name;
  
  // Name isn't unique; find a unique one:
  let i = 2;
  let new_name = `${name} (${i})`;
  while (prev_names.includes(new_name)) {
    i += 1;
    new_name = `${name} (${i})`;
  }
  return new_name;
};

export function LLMList({llms, onItemsChange}) {
  const [items, setItems] = useState(llms);
  const settingsModal = useRef(null);
  const [selectedModel, setSelectedModel] = useState(undefined);

  const updateItems = useCallback((new_items) => {
    setItems(new_items);
    onItemsChange(new_items);
  }, [onItemsChange]);

  const onClickSettings = useCallback((item) => {
    if (settingsModal && settingsModal.current) {
      setSelectedModel(item);
      settingsModal.current.trigger();
    }
  }, [settingsModal]);

  const onSettingsSubmit = useCallback((savedItem, formData, settingsData) => {
    // First check for the item with key and get it:
    let llm = items.find(i => i.key === savedItem.key);
    if (!llm) {
      console.error(`Could not update model settings: Could not find item with key ${savedItem.key}.`);
      return;
    }

    const prev_names = items.filter(item => item.key !== savedItem.key).map(item => item.name);

    // Change the settings for the LLM item to the value of 'formData': 
    updateItems(
      items.map(item => {
        if (item.key === savedItem.key) {
          // Create a new item with the same settings
          let updated_item = {...item};
          updated_item.formData = {...formData};
          updated_item.settings = {...settingsData};

          if ('model' in formData) { // Update the name of the specific model to call
            if (item.base_model.startsWith('__custom'))
              // Custom models must always have their base name, to avoid name collisions
              updated_item.model = item.base_model + '/' + formData['model'];
            else
              updated_item.model = formData['model'];
          }
          if ('shortname' in formData) {
            // Change the name, amending any name that isn't unique to ensure it is unique:
            const unique_name = ensureUniqueName(formData['shortname'], prev_names);
            updated_item.name = unique_name;
            if (updated_item.formData?.shortname)
              updated_item.formData.shortname = unique_name;
          }

          if (savedItem.emoji)
            updated_item.emoji = savedItem.emoji;
          
          return updated_item;
        }
        else return item;
      }
    ));

  }, [items, updateItems]);

  const onDragEnd = (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    const newItems = Array.from(items);
    const [removed] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, removed);
    setItems(newItems);
  };

  const removeItem = useCallback((item_key) => {
    // Double-check that the item we want to remove is in the list of items...
    if (!items.find(i => i.key === item_key)) {
      console.error(`Could not remove model from LLM list: Could not find item with key ${item_key}.`);
      return;
    }
    // Remove it
    updateItems(items.filter(i => i.key !== item_key));
  }, [items, updateItems]);

  useEffect(() => {
    // When LLMs list changes, we need to add new items 
    // while preserving the current order of 'items'. 
    // Check for new items and for each, add to end:
    let new_items = Array.from(items.filter(i => llms.some(v => v.key === i.key)));
    llms.forEach(item => {
      if (!items.find(i => i.key === item.key))
        new_items.push(item);
    });

    updateItems(new_items);
  }, [llms]);

  return (
    <div className="list nowheel nodrag">
      <ModelSettingsModal ref={settingsModal} model={selectedModel} onSettingsSubmit={onSettingsSubmit} />
      <DragDropContext onDragEnd={onDragEnd}>
        <StrictModeDroppable
          droppableId="llm-list-droppable"
          renderClone={(provided, snapshot, rubric) => (
            <LLMListItemClone provided={provided} snapshot={snapshot} item={items[rubric.source.index]} />
          )}
        >
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {items.map((item, index) => (
                <Draggable key={item.key} draggableId={item.key} index={index}>
                  {(provided, snapshot) => (
                    <LLMListItem provided={provided} snapshot={snapshot} item={item} removeCallback={removeItem} progress={item.progress} onClickSettings={() => onClickSettings(item)} />
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


export const LLMListContainer = forwardRef(({description, modelSelectButtonText, initLLMItems, onSelectModel, selectModelAction, onItemsChange}, ref) => {

  // All available LLM providers, for the dropdown list
  const AvailableLLMs = useStore((state) => state.AvailableLLMs);

  // For some reason, when the AvailableLLMs list is updated in the store/, it is not
  // immediately updated here. I've tried all kinds of things, but cannot seem to fix this problem.
  // We must force a re-render of the component: 
  const [ignored, forceUpdate] = useReducer(x => x + 1, 0);
  const refreshLLMProviderList = () => {
    forceUpdate();
  };

  // Selecting LLM models to prompt
  const [llmItems, setLLMItems] = useState(initLLMItems || DEFAULT_INIT_LLMS.map((i) => ({key: uuid(), settings: getDefaultModelSettings(i.base_model), ...i})));
  const [llmItemsCurrState, setLLMItemsCurrState] = useState([]);
  const resetLLMItemsProgress = useCallback(() => {
    setLLMItems(llmItemsCurrState.map(item => {
      item.progress = undefined;
      return item;
    }));
  }, [llmItemsCurrState]);
  const setZeroPercProgress = useCallback(() => {
    setLLMItems(llmItemsCurrState.map(item => {
      item.progress = { success: 0, error: 0 };
      return item;
    }));
  }, [llmItemsCurrState]);
  const updateProgress = useCallback((itemProcessorFunc) => {
    setLLMItems(llmItemsCurrState.map(itemProcessorFunc));
  }, [llmItemsCurrState]);
  const ensureLLMItemsErrorProgress = useCallback((llm_keys_w_errors) => {
    setLLMItems(llmItemsCurrState.map(item => {
      if (llm_keys_w_errors.includes(item.key)) {
        if (!item.progress)
          item.progress = { success: 0, error: 100 };
        else {
          const succ_perc = item.progress.success;
          item.progress = { success: succ_perc, error: 100 - succ_perc };
        }
      } else {
        if (item.progress && item.progress.success === 0)
            item.progress = undefined;
      }

      return item;
    }));
  }, [llmItemsCurrState]);
  
  const getLLMListItemForKey = useCallback((key) => {
    return llmItemsCurrState.find((item) => item.key === key);
  }, [llmItemsCurrState]);

  const handleSelectModel = useCallback((model) => {
    // Get the item for that model
    let item = AvailableLLMs.find(llm => llm.base_model === model);
    if (!item) {  // This should never trigger, but in case it does:
      console.error(`Could not find model named '${model}' in list of available LLMs.`);
      return;
    }

    // Give it a uid as a unique key (this is needed for the draggable list to support multiple same-model items; keys must be unique)
    item = {key: uuid(), ...item};

    // Generate the default settings for this model
    item.settings = getDefaultModelSettings(model);

    // Repair names to ensure they are unique
    const unique_name = ensureUniqueName(item.name, llmItemsCurrState.map(i => i.name));
    item.name = unique_name;
    item.formData = { 'shortname': unique_name };

    let new_items;
    if (selectModelAction === "add" || selectModelAction === undefined) {
      // Add model to the LLM list (regardless of it's present already or not). 
      new_items = llmItemsCurrState.concat([item]);
    } else if (selectModelAction === "replace") {
      // Remove existing model from LLM list and replace with new one:
      new_items = [item];
    }
    
    setLLMItems(new_items);
    if (onSelectModel) onSelectModel(item, new_items);
  }, [llmItemsCurrState, onSelectModel, selectModelAction, AvailableLLMs]);

  const onLLMListItemsChange = useCallback((new_items) => {
    setLLMItemsCurrState(new_items);
    if (onItemsChange) onItemsChange(new_items, llmItemsCurrState);
  }, [setLLMItemsCurrState, onItemsChange]);

  // This gives the parent access to triggering methods on this object
  useImperativeHandle(ref, () => ({
    resetLLMItemsProgress,
    setZeroPercProgress,
    updateProgress,
    ensureLLMItemsErrorProgress,
    getLLMListItemForKey,
    refreshLLMProviderList,
  }));

  return (<div className="llm-list-container nowheel">
    <div className="llm-list-backdrop">
      {description || "Models to query:"}
      <div className="add-llm-model-btn nodrag">
        <Menu transitionProps={{ transition: 'pop-top-left' }}
            position="bottom-start"
            width={220}
            withinPortal={true}
        >
          <Menu.Target>
            <button>{modelSelectButtonText || "Add +"}</button>
          </Menu.Target>
          <Menu.Dropdown>
            {AvailableLLMs.map(item => (
                <Menu.Item key={item.model} onClick={() => handleSelectModel(item.base_model)} icon={item.emoji}>{item.name}</Menu.Item>))
            }
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
    
    <div className="nodrag">
      <LLMList llms={llmItems} onItemsChange={onLLMListItemsChange} />
    </div>
  </div>);
});