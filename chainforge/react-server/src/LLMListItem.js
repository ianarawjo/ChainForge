/** Thanks to Kabir Haruna: https://codesandbox.io/s/i0rxsj */
import React, {useEffect, useState} from "react";
import styled from "styled-components";
import LLMItemButtonGroup from "./LLMItemButtonGroup"
import { IconTemperature } from '@tabler/icons-react';
import { getTemperatureSpecForModel } from "./ModelSettingSchemas";
import { Tooltip } from "@mantine/core";

// == The below function perc2color modified from: ==
// License: MIT - https://opensource.org/licenses/MIT
// Author: Michele Locati <michele@locati.it>
// Source: https://gist.github.com/mlocati/7210513
const perc2color = (perc) => {
	let r = 0; let g = 0; let b = 0;
  if (perc <= 0.0001)
    return '#00ffff';
	if(perc < 50) {
		b = 255;
    g = Math.round(510/2.0 - 5.10 * perc);
		r = Math.round(5.1 * perc);
	}
	else {
		r = 255;
		b = Math.round(510 - 5.10 * perc);
	}
	var h = r * 0x10000 + g * 0x100 + b * 0x1;
	return '#' + ('000000' + h.toString(16)).slice(-6);
};

const percTemperature = (llm_item) => {
  // Get the temp for this llm item
  const temp = llm_item.settings?.temperature;
  if (temp === undefined) {
    console.warn(`Did not find temperature setting for model ${llm_item.base_model}.`);
    return 50;
  }
  // Get the range of allowed values from the spec for the underlying LLM base model
  const tempspec = getTemperatureSpecForModel(llm_item.base_model);
  if (tempspec) {
    return temp / tempspec.maximum * 100;
  }
  else {
    console.warn(`Did not find temperature spec for model ${llm_item.base_model}.`);
    return 50;
  }
};

const CardHeader = styled.div`
  font-weight: 500;
  font-size: 10pt;
  font-family: -apple-system, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  text-align: start;
  float: left;
  margin-top: 1px;
`;
const TemperatureStatus = styled.span`
  font-weight: normal;
`;

export const DragItem = styled.div`
  padding: 6px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  background: white;
  margin: 0 0 8px 0;
  display: grid;
  grid-gap: 20px;
  flex-direction: column;
`;

const LLMListItem = ({ item, provided, snapshot, removeCallback, onClickSettings, progress }) => {
  // Set color by temperature only on item change (not every render)
  const [tempColor, setTempColor] = useState(perc2color(50));
  const temperature = item.settings?.temperature;

  useEffect(() => {
    if (temperature !== undefined)
      setTempColor(perc2color(percTemperature(item)));
  }, [item]);

  return (
    <DragItem
      ref={provided.innerRef}
      snapshot={snapshot}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <div>
        <CardHeader>{item.emoji}&nbsp;{item.name}{
            temperature !== undefined ?
              (<Tooltip label={"temp = " + (temperature || "0")} withArrow>
                <TemperatureStatus style={{color: tempColor}}>&nbsp;<IconTemperature size={14} stroke={2} style={{position: 'relative', top: '2px', marginRight: '-3px'}} />:{temperature !== undefined ? temperature : ""}</TemperatureStatus>
              </Tooltip>
              ): (<></>)}
        </CardHeader>
        <LLMItemButtonGroup onClickTrash={() => removeCallback(item.key)} ringProgress={progress} onClickSettings={onClickSettings} />
      </div>
      
    </DragItem>
  );
};

export const LLMListItemClone = ({ item, provided, snapshot }) => {
  // Set color by temperature only on item change (not every render)
  const [tempColor, setTempColor] = useState(perc2color(50));
  const temperature = item.settings?.temperature;

  useEffect(() => {
    if (temperature !== undefined)
      setTempColor(perc2color(percTemperature(item)));
  }, [item]);

  return (
    <DragItem
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      snapshot={snapshot}
    >
      <div>
      <CardHeader>{item.emoji}&nbsp;{item.name}{
            temperature !== undefined ?
              (<TemperatureStatus style={{color: tempColor}}>&nbsp;<IconTemperature size={14} stroke={2} style={{position: 'relative', top: '2px', marginRight: '-3px'}} />:{temperature !== undefined ? temperature : ""}</TemperatureStatus>)
              : (<></>)}
      </CardHeader>
        <LLMItemButtonGroup />
      </div>
    </DragItem>
  );
};

export default LLMListItem;