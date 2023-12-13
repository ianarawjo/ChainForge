import React, { useState, useEffect, useCallback } from 'react';
import { Skeleton, Text } from '@mantine/core';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import { IconForms } from '@tabler/icons-react';
import { Handle } from 'reactflow';
import BaseNode from './BaseNode';
import { processCSV } from "./backend/utils"
import AISuggestionsManager from './backend/aiSuggestionsManager';
import AIPopover from './AiPopover';
import { cleanEscapedBraces, escapeBraces } from './backend/template';

const replaceDoubleQuotesWithSingle = (str) => str.replaceAll('"', "'");
const wrapInQuotesIfContainsComma = (str) => str.includes(",") ? `"${str}"` : str;
const makeSafeForCSLFormat = (str) => wrapInQuotesIfContainsComma(replaceDoubleQuotesWithSingle(str));
const stripWrappingQuotes = (str) => {
    if (typeof str === "string" && str.length >= 2 && str.charAt(0) === '"' && str.charAt(str.length-1) === '"')
        return str.substring(1, str.length-1);
    else 
        return str;
};


const ItemsNode = ({ data, id }) => {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const pingOutputNodes = useStore((state) => state.pingOutputNodes);
    const apiKeys = useStore((state) => state.apiKeys);
    const flags = useStore((state) => state.flags);

    const [contentDiv, setContentDiv] = useState(null);
    const [isEditing, setIsEditing] = useState(true);
    const [csvInput, setCsvInput] = useState(null);
    const [countText, setCountText] = useState(null);
  
    // Only if AI autocomplete is enabled. 
    // TODO: This is harder to implement; see https://codepen.io/2undercover/pen/oNzyYO
    const [autocompletePlaceholders, setAutocompletePlaceholders] = useState([]);

    // Whether text field is in a loading state
    const [isLoading, setIsLoading] = useState(false);

    const [aiSuggestionsManager] = useState(new AISuggestionsManager(
      // Do nothing when suggestions are simply updated because we are managing the placeholder state manually here.
      undefined,
      // When suggestions are refreshed, revise placeholders
      setAutocompletePlaceholders
    ));

    // initializing
    useEffect(() => {
        if (!data.fields) {
            setDataPropsForNode(id, { text: '', fields: [] });
        }
    }, []);

    // Handle a change in a text fields' input.
    const setFieldsFromText = useCallback((text_val) => {
        // Update the data for this text fields' id.
        let new_data = { text: text_val, fields: processCSV(text_val).map(stripWrappingQuotes).map(escapeBraces) };
        setDataPropsForNode(id, new_data);
        pingOutputNodes(id);
    }, [id, pingOutputNodes, setDataPropsForNode]);

    const handKeyDown = useCallback((event) => {
        if (event.key === 'Enter' && data.text && data.text.trim().length > 0) {
            setIsEditing(false);
            setCsvInput(null);
        }
    }, []);

    // handling Div Click
    const handleDivOnClick = useCallback((event) => {
        setIsEditing(true);
    }, []);

    const handleOnBlur = useCallback((event) => {
        if (data.text && data.text.trim().length > 0)
            setIsEditing(false);
    }, [data.text]);

    // render csv div
    const renderCsvDiv = useCallback(() => {
        // Take the data.text as csv (only 1 row), and get individual elements
        const elements = data.fields || [];

        // generate a HTML code that highlights the elements
        const html = [];
        elements.forEach((e, idx) => {
            // html.push(<Badge color="orange" size="lg" radius="sm">{e}</Badge>)
            html.push(<span key={idx} className="csv-element">{cleanEscapedBraces(e)}</span>);
            if (idx < elements.length - 1) {
                html.push(<span key={idx + 'comma'} className="csv-comma">,</span>);
            }
        });

        setContentDiv(
            <div className='csv-div nowheel' onClick={handleDivOnClick}>
                {html}
            </div>
        );
        setCountText(
            <Text size="xs" style={{ marginTop: '5px' }} color='gray' align='right'>{elements.length} elements</Text>
        );
    }, [data.text, handleDivOnClick]);

    // When isEditing changes, add input
    useEffect(() => {
        if (!isEditing && data.text && data.text.trim().length > 0) {
            setCsvInput(null);
            renderCsvDiv();
            return;
        }

        var text_val = data.text || '';
        setCsvInput(
            <div className="input-field" key={id}>
                <textarea id={id} name={id} className="text-field-fixed nodrag csv-input" 
                rows="2" cols="40" 
                defaultValue={text_val} 
                placeholder='Put your comma-separated list here' 
                onKeyDown={handKeyDown} 
                onChange={(event) => setFieldsFromText(event.target.value)} 
                onBlur={handleOnBlur} 
                autoFocus={true}/>
            </div>
        );
        setContentDiv(null);
        setCountText(null);
    }, [isEditing, setFieldsFromText, handleOnBlur, handKeyDown]);

    // when data.text changes, update the content div
    useEffect(() => {
        // When in editing mode, don't update the content div
        if (isEditing || !data.text) return;

        renderCsvDiv();

    }, [id, data.text]);

    return (
    <BaseNode classNames="text-fields-node" nodeId={id}>
        <NodeLabel title={data.title || 'Items Node'} 
                   nodeId={id} 
                   icon={<IconForms size="16px" />}
                   customButtons={
                    (flags["aiSupport"] ? 
                      [<AIPopover key='ai-popover'
                                  values={data.fields ?? []}
                                  onAddValues={(vals) => setFieldsFromText(data.text + ", " + vals.map(makeSafeForCSLFormat).join(", "))}
                                  onReplaceValues={(vals) => setFieldsFromText(vals.map(makeSafeForCSLFormat).join(", "))}
                                  areValuesLoading={isLoading}
                                  setValuesLoading={setIsLoading}
                                  apiKeys={apiKeys} />]
                     : [])
                   } />
        <Skeleton visible={isLoading}>
            {csvInput}
            {contentDiv}
            {countText}
        </Skeleton>
        <Handle
            type="source"
            position="right"
            id="output"
            className="grouped-handle"
            style={{ top: "50%" }}
        />
    </BaseNode>);
};

export default ItemsNode;