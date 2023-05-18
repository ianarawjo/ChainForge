import React, { useCallback, useEffect, useState } from 'react';
import { Handle } from 'react-flow-renderer';
import { Badge } from '@mantine/core';
import useStore from './store'

export default function TemplateHooks({ vars, nodeId, startY }) {

    const genTemplateHooks = useCallback((temp_var_names, names_to_blink) => {
        return temp_var_names.map((name, idx) => {
            const className = (names_to_blink.includes(name)) ? 'hook-tag text-blink' : 'hook-tag';
            const pos = (idx * 35) + startY + 'px';
            const style = { top: pos,  background: '#555' };
            return (<div key={name} className={className} >
                <Badge color="indigo" size="md" radius="sm">{name}</Badge>
                <Handle type="target" position="left" id={name} style={style} />
            </div>)
        });
    }, [startY]);

    const [templateHooks, setTemplateHooks] = useState(genTemplateHooks(vars || [], []));
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

    const blinkTemplateVars = (vars_to_blink) => {
        setTemplateHooks(genTemplateHooks(vars, vars_to_blink));
        setTimeout(() => {  // Set timeout to turn off blinking:
            blinkTemplateVars([]);
        }, 750*2);
    };

    useEffect(() => {
        setTemplateHooks(genTemplateHooks(vars, []));
        // setDataPropsForNode(nodeId, {vars: vars});
    }, [vars, startY, genTemplateHooks, nodeId, setDataPropsForNode]);

    return (
        <div className="template-hooks">
            {templateHooks}
        </div>
    );
}