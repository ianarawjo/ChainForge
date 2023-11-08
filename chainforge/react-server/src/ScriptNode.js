import React, { useState, useEffect, useCallback } from 'react';
import useStore from './store';
import BaseNode from './BaseNode';
import NodeLabel from './NodeLabelComponent';
import { IconSettingsAutomation } from '@tabler/icons-react';


const ScriptNode = ({ data, id }) => {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const delButtonId = 'del-';
    var [idCounter, setIDCounter] = useState(0);
    const get_id = () => {
        setIDCounter(idCounter + 1);
        return 'f' + idCounter.toString();
    }
    
    // Handle a change in a scripts' input.
    const handleInputChange = useCallback((event) => {
        // Update the data for this script node's id.
        let new_data = { 'scriptFiles': { ...data.scriptFiles } };
        new_data.scriptFiles[event.target.id] = event.target.value;
        setDataPropsForNode(id, new_data);
    }, [data, id, setDataPropsForNode]);

    // Handle delete script file.
    const handleDelete = useCallback((event) => {
        // Update the data for this script node's id.
        let new_data = { 'scriptFiles': { ...data.scriptFiles } };
        var item_id = event.target.id.substring(delButtonId.length);
        delete new_data.scriptFiles[item_id];
        // if the new_data is empty, initialize it with one empty field
        if (Object.keys(new_data.scriptFiles).length === 0) {
            new_data.scriptFiles[get_id()] = '';
        }
        console.log(new_data);
        setDataPropsForNode(id, new_data);
    }, [data, id, setDataPropsForNode]);

    // Initialize fields (run once at init)
    const [scriptFiles, setScriptFiles] = useState([]);
    useEffect(() => {
        if (!data.scriptFiles)
            setDataPropsForNode(id, { scriptFiles: { [get_id()]: '' } });
    }, []);

    // Whenever 'data' changes, update the input fields to reflect the current state.
    useEffect(() => {
        const f = data.scriptFiles ? Object.keys(data.scriptFiles) : [];
        setScriptFiles(f.map((i) => {
            const val = data.scriptFiles ? data.scriptFiles[i] : '';
            return (
                <div className="input-field nodrag" key={i}>
                    <input className="script-node-input" type="text" id={i} onChange={handleInputChange} value={val}></input>
                    <button className="remove-text-field-btn nodrag" id={delButtonId + i} onClick={handleDelete}>X</button>
                    <br/>
                </div>
            )
        }));
    }, [data.scriptFiles, handleInputChange, handleDelete]);

    // Add a field
    const handleAddField = useCallback(() => {
        // Update the data for this script node's id.
        let new_data = { 'scriptFiles': { ...data.scriptFiles } };
        new_data.scriptFiles[get_id()] = "";
        setDataPropsForNode(id, new_data);
    }, [data, id, setDataPropsForNode]);

    return (
        <BaseNode classNames="script-node" nodeId={id}>
            <NodeLabel title={data.title || 'Global Python Scripts'} nodeId={id} editable={false} icon={<IconSettingsAutomation size="16px" />}/>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Enter folder paths for external modules you wish to import.</label> <br/><br/>
            <div>
                {scriptFiles}
            </div>
            <div className="add-text-field-btn">
                <button onClick={handleAddField}>+</button>
            </div>
        </BaseNode>
    );
};

export default ScriptNode;