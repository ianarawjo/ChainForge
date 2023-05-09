import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Badge, Text } from '@mantine/core';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import { IconCsv } from '@tabler/icons-react';
import { Handle } from 'react-flow-renderer';

const CsvNode = ({ data, id }) => {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const [contentDiv, setContentDiv] = useState(null);
    const [isEditing, setIsEditing] = useState(true);
    const [csvInput, setCsvInput] = useState(null);
    const [countText, setCountText] = useState(null);

    // initializing
    useEffect(() => {
        if (!data.fields) {
            setDataPropsForNode(id, { text: '', fields: [] });
        }
    }, []);

    const processCsv = (csv) => {
        if (!csv) return [];
        // Split the input string by rows, and merge
        var res = csv.split('\n').join(',');

        // remove all the empty or whitespace-only elements
        return res.split(',').map(e => e.trim()).filter(e => e.length > 0);
    }

    // Handle a change in a text fields' input.
    const handleInputChange = useCallback((event) => {
        // Update the data for this text fields' id.
        let new_data = { 'text': event.target.value, 'fields': processCsv(event.target.value) };
        setDataPropsForNode(id, new_data);
    }, [id, setDataPropsForNode]);

    const handKeyDown = useCallback((event) => {
        if (event.key === 'Enter') {
            setIsEditing(false);
            setCsvInput(null);
        }
    }, []);

    // handling Div Click
    const handleDivOnClick = useCallback((event) => {
        setIsEditing(true);
    }, []);

    // render csv div
    const renderCsvDiv = useCallback(() => {
        // Take the data.text as csv (only 1 row), and get individual elements
        const elements = data.fields;

        // generate a HTML code that highlights the elements
        const html = [];
        elements.forEach((e, idx) => {
            html.push(<Badge color="orange" size="lg" radius="sm">{e}</Badge>)
            // html.push(<span key={idx} className="csv-element">{e}</span>);
            if (idx < elements.length - 1) {
                html.push(<span key={idx + 'comma'} className="csv-comma">,</span>);
            }
        });

        setContentDiv(<div className='csv-div' onClick={handleDivOnClick}>
            {html}
        </div>);
        setCountText(<Text size="xs" style={{ marginTop: '5px' }} color='blue' align='right'>{elements.length} elements</Text>);
    }, [data.text, handleDivOnClick]);

    // When isEditing changes, add input
    useEffect(() => {
        if (!isEditing) {
            setCsvInput(null);
            renderCsvDiv();
            return;
        }
        if (!csvInput) {
            var text_val = data.text || '';
            setCsvInput(
                <div className="input-field" key={id}>
                    <textarea id={id} name={id} className="text-field-fixed nodrag" rows="2" cols="40" defaultValue={text_val} onChange={handleInputChange} placeholder='Paste your CSV text here' onKeyDown={handKeyDown} />
                </div>
            );
            setContentDiv(null);
            setCountText(null);
        }
    }, [isEditing]);

    // when data.text changes, update the content div
    useEffect(() => {
        // When in editing mode, don't update the content div
        if (isEditing) return;
        if (!data.text) return;
        renderCsvDiv();

    }, [id, data.text]);

    return (
        <div className="text-fields-node cfnode">
            <NodeLabel title={data.title || 'CSV Node'} nodeId={id} icon={<IconCsv size="16px" />} />
            {csvInput}
            {contentDiv}
            {countText ? countText : <></>}
            <Handle
                type="source"
                position="right"
                id="output"
                style={{ top: "50%", background: '#555' }}
            />
        </div>
    );
};

export default CsvNode;