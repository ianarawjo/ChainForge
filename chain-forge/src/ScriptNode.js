import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import TemplateHooks from './TemplateHooksComponent';

const union = (setA, setB) => {
    const _union = new Set(setA);
    for (const elem of setB) {
        _union.add(elem);
    }
    return _union;
}

const ScriptNode = ({ data, id }) => {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

    // Handle a change in a text fields' input.
    const handleInputChange = useCallback((event) => {
        // Update the data for this script node's id.
        let new_data = { 'scriptFiles': { ...data.scriptFiles } };
        new_data.scriptFiles[event.target.id] = event.target.value;
        console.log(new_data);
        setDataPropsForNode(id, new_data);
    }, [data, id, setDataPropsForNode]);

    // Initialize fields (run once at init)
    const [scriptFiles, setScriptFiles] = useState([]);
    useEffect(() => {
        if (!data.scriptFiles)
            setDataPropsForNode(id, { scriptFiles: { f0: '' } });
    }, []);

    // Whenever 'data' changes, update the input fields to reflect the current state.
    useEffect(() => {
        const f = data.scriptFiles ? Object.keys(data.scriptFiles) : ['f0'];
        setScriptFiles(f.map((i) => {
            const val = data.scriptFiles ? data.scriptFiles[i] : '';
            return (
                <div className="input-field" key={i}>
                    <input className='script-node-input' type='text' id={i} onChange={handleInputChange} defaultValue={val}/><br/>
                </div>
            )
        }));
    }, [data.scriptFiles]);

    // Add a field
    const handleAddField = useCallback(() => {
        // Update the data for this script node's id.
        const num_files = data.scriptFiles ? Object.keys(data.scriptFiles).length : 0;
        let new_data = { 'scriptFiles': { ...data.scriptFiles } };
        new_data.scriptFiles['f' + num_files.toString()] = "";
        setDataPropsForNode(id, new_data);
    }, [data, id, setDataPropsForNode]);

    // Dynamically update the y-position of the template hook <Handle>s
    const ref = useRef(null);
    const [hooksY, setHooksY] = useState(120);
    useEffect(() => {
        const node_height = ref.current.clientHeight;
        setHooksY(node_height + 70);
    }, [scriptFiles]);

    return (
        <div className="script-node">
            <div className="node-header">
                <NodeLabel title={data.title || 'Script Node'} nodeId={id} />
            </div>
            <label htmlFor="num-generations" style={{fontSize: '10pt'}}>Enter folder paths for external modules you wish to import.</label> <br/><br/>
            <div ref={ref}>
                {scriptFiles}
            </div>
            <div className="add-text-field-btn">
                <button onClick={handleAddField}>+</button>
            </div>
        </div>
    );
};

export default ScriptNode;