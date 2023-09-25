import React, { useCallback, useEffect, useState } from 'react';
import { Handle, useUpdateNodeInternals } from 'reactflow';
import { Badge } from '@mantine/core';
import useStore from './store'

export const extractBracketedSubstrings = (text) => {
    /** Given some text in template format:
     *      This is a {test}
     *  extracts only the groups within braces, excluding
     *  any escaped braces \{ \}. 
     * 
     *  NOTE: We don't use Regex here for compatibility of browsers
     *  that don't support negative lookbehinds/aheads (e.g., Safari).
     */
    let prev_c = '';
    let group_start_idx = -1;
    let capture_groups = [];
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i];
        if (prev_c !== '\\') { // Skipped escaped chars
            if (group_start_idx === -1 && c === '{')
                group_start_idx = i;
            else if (group_start_idx > -1 && c === '}') {
                if (group_start_idx + 1 < i)  // Skip {} empty braces
                    capture_groups.push(text.substring(group_start_idx+1, i));
                group_start_idx = -1;
            }
        }
        prev_c = c;
    }

    // Ignore any varnames that begin with the special character #:
    capture_groups = capture_groups.filter(s => (s.length === 0 || s[0] !== '#'))
    
    return capture_groups;
};


export default function TemplateHooks({ vars, nodeId, startY, position, ignoreHandles }) {

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
        const pos = position !== undefined ? position : 'left';
        const handle_type = pos === 'left' ? "target" : "source";
        return temp_var_names.map((name, idx) => {
            const className = (names_to_blink.includes(name)) ? 'hook-tag text-blink' : 'hook-tag';
            const style = { top: ((idx * 28) + startY + 'px'),  background: '#555' };
            return (<div key={name} className={className} style={{display: 'flex', justifyContent: pos}} >
                <Badge color="indigo" size="md" radius="sm" style={{textTransform: 'none'}}>{name}</Badge>
                <Handle type={handle_type} position={pos} id={name} key={name} style={style} />
            </div>);
        });
    }, [startY, position]);

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
                if (e.target !== nodeId || vars.includes(e.targetHandle) || 
                   (Array.isArray(ignoreHandles) && ignoreHandles.includes(e.targetHandle)))
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
    }, [vars, startY, genTemplateHooks, nodeId, ignoreHandles]);

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