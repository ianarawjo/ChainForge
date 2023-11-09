import React, { useState } from 'react';
import useStore from './store';
import NodeLabel from './NodeLabelComponent';
import BaseNode from './BaseNode';
import { Textarea } from '@mantine/core';

/**
 * A node without any inputs or outputs that
 * lets users write comment about their flow. 
 */
const CommentNode = ({ data, id }) => {

  const [value, setValue] = useState(data.text || '');
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const handleChangeComment = (evt) => {
    const txt = evt.currentTarget.value;
    setValue(txt);
    setDataPropsForNode(id, { text: txt });
  };

  return (
    <BaseNode nodeId={id} style={{backgroundColor: '#eee'}}>
      <NodeLabel title={data.title || 'Comment'} 
                  nodeId={id}
                  icon={'✏️'} />
      <Textarea value={value} 
                onChange={handleChangeComment} 
                placeholder='I love ChainForge!'
                className='nodrag'
                autosize 
                w={'260px'} 
                minRows={2} 
                styles={{input: { border: 'none', backgroundColor: '#eee' }}} />
    </BaseNode>
  );
};

export default CommentNode;