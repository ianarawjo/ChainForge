/** Thanks to Kabir Haruna: https://codesandbox.io/s/i0rxsj */
import React from "react";
import styled from "styled-components";
import SettingsButton from "./SettingsButton"

const CardHeader = styled.div`
  font-weight: 500;
  font-size: 10pt;
  font-family: -apple-system, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  text-align: start;
  float: left;
  margin-top: 1px;
`;

const Author = styled.div`
  display: flex;
  align-items: center;
`;

const CardFooter = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const DragItem = styled.div`
  padding: 10px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  background: white;
  margin: 0 0 8px 0;
  display: grid;
  grid-gap: 20px;
  flex-direction: column;
`;

const ListItem = ({ item, provided, snapshot }) => {
  return (
    <DragItem
      ref={provided.innerRef}
      snapshot={snapshot}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <div>
        <CardHeader>{item.model}</CardHeader>
        <SettingsButton />
      </div>
      
    </DragItem>
  );
};

export const ListItemClone = ({ item, provided, snapshot }) => {
  return (
    <DragItem
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      snapshot={snapshot}
    >
      <div>
        <CardHeader>{item.model}</CardHeader>
        <SettingsButton />
      </div>
    </DragItem>
  );
};

export default ListItem;