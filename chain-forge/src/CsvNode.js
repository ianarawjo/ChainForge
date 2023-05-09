import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Text } from '@mantine/core';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import { IconCsv, IconFileText } from '@tabler/icons-react';
import { edit } from 'ace-builds';

const CsvNode = ({ data, id }) => {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const [contentDiv, setContentDiv] = useState(null);
    const [fields, setFields] = useState([]);
    const [isEditing, setIsEditing] = useState(false);

    const processCsv = (csv) => {
        // Split the input string by rows, and merge
        var res = csv.split('\n').join(',');

        // remove all the empty or whitespace-only elements
        return res.split(',').map(e => e.trim()).filter(e => e.length > 0);
    }

    // Handle a change in a text fields' input.
    const handleInputChange = useCallback((event) => {
        // Update the data for this text fields' id.
        let new_data = {'text': event.target.value};
        setDataPropsForNode(id, new_data);
    }, [id, setDataPropsForNode]);

    const handKeyDown = useCallback((event) => {
        if (event.key === 'Enter') {
            setIsEditing(false);
        }
    }, []);

    const handleDivOnClick = useCallback((event) => {
        setIsEditing(true);
    }, []);

    // Initialize fields (run once at init)
    useEffect(() => {
        if (!data.text) {
            setIsEditing(true);
        }
    }, []);

    // when data.text changes, update the content div
    useEffect(() => {
        if(isEditing) {
            var text_val = data.text || '';
            setContentDiv(
                <div className="input-field" key={id}>
                    <textarea id={id} name={id} className="text-field-fixed nodrag" rows="2" cols="40" onChange={handleInputChange} placeholder='Paste your CSV text here' onKeyDown={handKeyDown} value={text_val} />
                </div>
            );
            return
        }
        if (!data.text) return;
        // Take the data.text as csv (only 1 row), and get individual elements
        const elements = processCsv(data.text);

        // generate a HTML code that highlights the elements
        const html = [];
        elements.forEach((e, idx) => {
            html.push(<span key={idx} className="csv-element">{e}</span>);
            if (idx < elements.length - 1) {
                html.push(<span key={idx + 'comma'} className="csv-comma">,</span>);
            }
        });

        setContentDiv(<div className='csv-div' onClick={handleDivOnClick}>
            {html}
        </div>);
    }, [id, data.text, isEditing, handleDivOnClick, handleInputChange, handKeyDown]);

    return (
        <div className="text-fields-node cfnode">
            <NodeLabel title={data.title || 'CSV Node'} nodeId={id} icon={<IconCsv size="16px" />} />
            {contentDiv}
        </div>
    );
};

export default CsvNode;