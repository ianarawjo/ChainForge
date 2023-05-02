import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import ListItem, { DragItem, ListItemClone } from "./ListItemComponent";
import { StrictModeDroppable } from './StrictModeDroppable'

export default function LLMList({llms}) {
  const [items, setItems] = useState(llms);

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

  return (
    <div className="list  nowheel nodrag">
      <DragDropContext onDragEnd={onDragEnd}>
        <StrictModeDroppable
          droppableId="droppable"
          renderClone={(provided, snapshot, rubric) => (
            // <DragItem
            //   {...provided.draggableProps}
            //   {...provided.dragHandleProps}
            //   ref={provided.innerRef}
            // >
            <ListItemClone
              provided={provided}
              snapshot={snapshot}
              item={items[rubric.source.index]}
            />
            // </DragItem>
          )}
        >
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {items.map((item, index) => (
                <Draggable key={item.model} draggableId={item.model} index={index}>
                  {(provided, snapshot) => (
                    <ListItem
                      provided={provided}
                      snapshot={snapshot}
                      item={item}
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
