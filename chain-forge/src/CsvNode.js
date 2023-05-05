import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Text} from '@mantine/core';
import useStore from './store';
import NodeLabel from './NodeLabelComponent'
import { IconFileText } from '@tabler/icons-react';
import { edit } from 'ace-builds';

const CsvNode = ({ data, id }) => {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const content = "test content";


    // Handle a change in a text fields' input.
    const handleInputChange = useCallback((event) => {
        // Update the data for this text fields' id.
        let new_data = { 'text': event.target.value };
        setDataPropsForNode(id, new_data);
    }, [id, setDataPropsForNode]);

    return (
        <div className="text-fields-node cfnode">
            <NodeLabel title={data.title || 'CSV Node'} nodeId={id} icon={<IconFileText size="16px" />} />
            <Card shadow="sm" padding="lg" radius="md" withBorder>

                <Text size="sm" color="dimmed">
                    With Fjord Tours you can explore more of the magical fjord landscapes with tours and
                    activities on and around the fjords of Norway
                </Text>
            </Card>

        </div>
    );
};

export default CsvNode;