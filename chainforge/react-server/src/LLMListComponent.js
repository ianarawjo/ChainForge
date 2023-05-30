import { useState, useEffect, useCallback, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import LLMListItem, { DragItem, LLMListItemClone } from "./LLMListItem";
import { StrictModeDroppable } from './StrictModeDroppable'
import ModelSettingsModal from "./ModelSettingsModal"

export default function LLMList({llms, onItemsChange}) {
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

  const onSettingsSubmit = useCallback((item_key, formData, settingsData) => {
    // First check for the item with key and get it:
    let llm = items.find(i => i.key === item_key);
    if (!llm) {
      console.error(`Could not update model settings: Could not find item with key ${item_key}.`);
      return;
    }

    // Change the settings for the LLM item to the value of 'formData': 
    updateItems(
      items.map(item => {
        if (item.key === item_key) {
          // Create a new item with the same settings
          let updated_item = {...item};
          if ('model' in formData) // Update the name of the specific model to call
            updated_item.model = formData['model'];
          updated_item.formData = {...formData};
          updated_item.settings = {...settingsData};
          return updated_item;
        }
        else return item;
      }
    ));

    // Replace the item in the list and re-save: 

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
