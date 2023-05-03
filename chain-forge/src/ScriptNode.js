import React, { useState, useRef, useEffect, useCallback } from 'react';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'


const ScriptNode = ({ data, id }) => {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const delButtonId = 'del-';
    // Handle a change in a scripts' input.
    const handleInputChange = useCallback((event) => {
        // Update the data for this script node's id.
        let new_data = { 'scriptFiles': { ...data.scriptFiles } };
        new_data.scriptFiles[event.target.id] = event.target.value;
        console.log(new_data);
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
            new_data.scriptFiles['f0'] = '';
        }
        console.log(new_data);
        setDataPropsForNode(id, new_data);
    }, [data, id, setDataPropsForNode]);

    // Initialize fields (run once at init)
    const [scriptFiles, setScriptFiles] = useState([]);
    useEffect(() => {
        if (!data.scriptFiles)
            setDataPropsForNode(id, { scriptFiles: { f0: '' } });
    }, [data.scriptFiles, id, setDataPropsForNode]);

    // Whenever 'data' changes, update the input fields to reflect the current state.
    useEffect(() => {
        const f = data.scriptFiles ? Object.keys(data.scriptFiles) : ['f0'];
        setScriptFiles(f.map((i) => {
            const val = data.scriptFiles ? data.scriptFiles[i] : '';
            return (
                <div className="input-field" key={i}>
                    <input className='script-node-input' type='text' id={i} onChange={handleInputChange} value={val}/><button id={delButtonId + i} onClick={handleDelete}>x</button><br/>
                </div>
            )
        }));
    }, [data.scriptFiles, handleInputChange, handleDelete]);

    // Add a field
    const handleAddField = useCallback(() => {
        // Update the data for this script node's id.
        const num_files = data.scriptFiles ? Object.keys(data.scriptFiles).length : 0;
        let new_data = { 'scriptFiles': { ...data.scriptFiles } };
        new_data.scriptFiles['f' + num_files.toString()] = "";
        setDataPropsForNode(id, new_data);
    }, [data, id, setDataPropsForNode]);

    return (
        <div className="script-node cfnode">
            <div className="node-header">
                <NodeLabel title={data.title || 'Global Scripts'} nodeId={id} editable={false} />
            </div>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Enter folder paths for external modules you wish to import.</label> <br/><br/>
            <div>
                {scriptFiles}
            </div>
            <div className="add-text-field-btn">
                <button onClick={handleAddField}>+</button>
            </div>
        </div>
    );
};

export default ScriptNode;