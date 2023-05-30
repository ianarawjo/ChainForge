/** Thanks to Kabir Haruna: https://codesandbox.io/s/i0rxsj */
import React from "react";
import styled from "styled-components";
import LLMItemButtonGroup from "./LLMItemButtonGroup"
import { IconTemperature } from '@tabler/icons-react';

const CardHeader = styled.div`
  font-weight: 500;
  font-size: 10pt;
  font-family: -apple-system, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  text-align: start;
  float: left;
  margin-top: 1px;
`;
const TemperatureStatus = styled.span`
  font-style: italic;
  font-weight: normal;
  color: #fc800d;
`;

export const DragItem = styled.div`
  padding: 8px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  background: white;
  margin: 0 0 8px 0;
  display: grid;
  grid-gap: 20px;
  flex-direction: column;
`;

const LLMListItem = ({ item, provided, snapshot, removeCallback, onClickSettings, progress }) => {
  return (
    <DragItem
      ref={provided.innerRef}
      snapshot={snapshot}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <div>
        <CardHeader>{item.emoji}&nbsp;{item.name}{
            item.settings?.temperature ?
              (<TemperatureStatus>&nbsp;<IconTemperature size={14} stroke={2} style={{position: 'relative', top: '2px', marginRight: '-3px'}} />={item.settings?.temperature ? item.settings.temperature : ""}</TemperatureStatus>)
              : (<></>)}
        </CardHeader>
        <LLMItemButtonGroup onClickTrash={() => removeCallback(item.key)} ringProgress={progress} onClickSettings={onClickSettings} />
      </div>
      
    </DragItem>
  );
};

export const LLMListItemClone = ({ item, provided, snapshot }) => {
  return (
    <DragItem
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      snapshot={snapshot}
    >
      <div>
      <CardHeader>{item.emoji}&nbsp;{item.name}{
            item.settings?.temperature ?
              (<TemperatureStatus>&nbsp;<IconTemperature size={14} stroke={2} style={{position: 'relative', top: '2px', marginRight: '-3px'}} />={item.settings?.temperature ? item.settings.temperature : ""}</TemperatureStatus>)
              : (<></>)}
      </CardHeader>
        <LLMItemButtonGroup />
      </div>
    </DragItem>
  );
};

export default LLMListItem;