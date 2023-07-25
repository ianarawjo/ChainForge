import { useState, useEffect, useCallback, useRef } from "react";
import { DragDropContext, Draggable } from "react-beautiful-dnd";
import LLMListItem, { LLMListItemClone } from "./LLMListItem";
import { StrictModeDroppable } from './StrictModeDroppable'
import ModelSettingsModal from "./ModelSettingsModal"

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

export default function LLMList({llms, onItemsChange}) {
  const [items, setItems] = useState(llms);
  const settingsModal = useRef(null);
  const [selectedModel, setSelectedModel] = useState(undefined);

  const updateItems = useCallback((new_items) => {
    setItems(new_items);
    setTimeout(() => onItemsChange(new_items), 1); // wait one frame to ping update
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

          if ('model' in formData) // Update the name of the specific model to call
            updated_item.model = formData['model'];
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
    let new_items = Array.from(items);
    llms.forEach(item => {
      if (!items.find(i => i.key === item.key))
        new_items.push(item);
    });

    updateItems(new_items);
  }, [llms, updateItems]);

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
