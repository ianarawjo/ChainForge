import React, { useState, useEffect, useCallback, useRef } from "react";
import useStore from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { IconSettingsAutomation } from "@tabler/icons-react";
import { Dict } from "./backend/typing";

export interface ScriptNodeProps {
  data: {
    scriptFiles: Dict<string>;
    title: string;
  };
  id: string;
}

const ScriptNode: React.FC<ScriptNodeProps> = ({ data, id }) => {
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const delButtonId = "del-";
  const [idCounter, setIDCounter] = useState(0);
  const get_id = () => {
    setIDCounter(idCounter + 1);
    return "f" + idCounter.toString();
  };

  // Use refs for callbacks to avoid stale closures and prevent unnecessary
  // re-renders that reset input cursor position (fixes #43).
  const dataRef = useRef(data);
  dataRef.current = data;

  // Handle a change in a scripts' input.
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const new_data = { scriptFiles: { ...dataRef.current.scriptFiles } };
      new_data.scriptFiles[event.target.id] = event.target.value;
      setDataPropsForNode(id, new_data);
    },
    [id, setDataPropsForNode],
  );

  // Handle delete script file.
  const handleDelete = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const new_data = { scriptFiles: { ...dataRef.current.scriptFiles } };
      const item_id = (event.target as HTMLButtonElement).id.substring(
        delButtonId.length,
      );
      delete new_data.scriptFiles[item_id];
      if (Object.keys(new_data.scriptFiles).length === 0) {
        new_data.scriptFiles[get_id()] = "";
      }
      setDataPropsForNode(id, new_data);
    },
    [id, setDataPropsForNode],
  );

  // Initialize fields (run once at init)
  useEffect(() => {
    if (!data.scriptFiles)
      setDataPropsForNode(id, { scriptFiles: { [get_id()]: "" } });
  }, []);

  // Add a field
  const handleAddField = useCallback(() => {
    const new_data = { scriptFiles: { ...dataRef.current.scriptFiles } };
    new_data.scriptFiles[get_id()] = "";
    setDataPropsForNode(id, new_data);
  }, [id, setDataPropsForNode]);

  // Render inputs directly from data.scriptFiles instead of via intermediate state.
  // This avoids rebuilding the entire JSX tree on every keystroke, which was
  // causing the cursor to reset in input fields (fixes #43).
  const scriptFileKeys = data.scriptFiles ? Object.keys(data.scriptFiles) : [];

  return (
    <BaseNode classNames="script-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Global Python Scripts"}
        nodeId={id}
        editable={false}
        icon={<IconSettingsAutomation size="16px" />}
      />
      <label htmlFor="num-generations" style={{ fontSize: "10pt" }}>
        Enter folder paths for external modules you wish to import.
      </label>{" "}
      <br />
      <br />
      <div>
        {scriptFileKeys.map((i) => {
          const val = data.scriptFiles ? data.scriptFiles[i] : "";
          return (
            <div className="input-field nodrag" key={i}>
              <input
                className="script-node-input"
                type="text"
                id={i}
                onChange={handleInputChange}
                value={val}
              ></input>
              <button
                className="remove-text-field-btn nodrag"
                id={delButtonId + i}
                onClick={handleDelete}
              >
                X
              </button>
              <br />
            </div>
          );
        })}
      </div>
      <div className="add-text-field-btn">
        <button onClick={handleAddField}>+</button>
      </div>
    </BaseNode>
  );
};

export default ScriptNode;
