import React, { useCallback, useEffect, useState } from 'react';
import { Handle, useUpdateNodeInternals } from 'react-flow-renderer';
import { Badge } from '@mantine/core';
import useStore from './store'

export default function TemplateHooks({ vars, nodeId, startY }) {

    const edges = useStore((state) => state.edges);
    const onEdgesChange = useStore((state) => state.onEdgesChange);
    const [edgesToRemove, setEdgesToRemove] = useState([]);

    // For notifying the backend when we re-render Handles:
    const updateNodeInternals = useUpdateNodeInternals();

    // Remove edges whenever a template variable changes
    useEffect(() => {
        onEdgesChange(edgesToRemove.map(e => ({id: e.id, type: 'remove'})));
    }, [edgesToRemove]);

    const genTemplateHooks = useCallback((temp_var_names, names_to_blink) => {
        // Generate handles 
        return temp_var_names.map((name, idx) => {
            const className = (names_to_blink.includes(name)) ? 'hook-tag text-blink' : 'hook-tag';
            const pos = (idx * 35) + startY + 'px';
            const style = { top: pos,  background: '#555' };
            return (<div key={name} className={className} >
                <Badge color="indigo" size="md" radius="sm" style={{textTransform: 'none'}}>{name}</Badge>
                <Handle type="target" position="left" id={name} key={name} style={style} />
            </div>);
        });
    }, [startY]);

    const [templateHooks, setTemplateHooks] = useState([]);

    const blinkTemplateVars = (vars_to_blink) => {
        setTemplateHooks(genTemplateHooks(vars, vars_to_blink));
        setTimeout(() => {  // Set timeout to turn off blinking:
            blinkTemplateVars([]);
        }, 750*2);
    };

    useEffect(() => {
        // Determine if there's any handles that were deleted in temp_var_names, 
        // and manually remove them as edges:
        if (templateHooks.length > 0) {
            let deleted_edges = [];
            edges.forEach(e => {
                if (e.target !== nodeId || vars.includes(e.targetHandle))
                    return;
                else {
                    deleted_edges.push(e);
                }
            });

            if (deleted_edges.length > 0)
                setEdgesToRemove(deleted_edges);
        }
        
        setTemplateHooks(genTemplateHooks(vars, []));

        // setDataPropsForNode(nodeId, {vars: vars});
    }, [vars, startY, genTemplateHooks, nodeId]);

    // Because of the way React flow internally stores Handles, 
    // we need to notify it to update its backend representation of the 'node'
    // this TemplateHooks component is on, so it re-checks the Handles subcomponents.
    // :: See https://github.com/wbkd/react-flow/issues/805#issuecomment-788097022
    useEffect(() => {
        updateNodeInternals(nodeId);
    }, [templateHooks]);

    return (
        <div className="template-hooks">
            {templateHooks}
        </div>
    );
}