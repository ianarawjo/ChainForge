import React, { useState, useEffect, useCallback } from 'react';
import { Handle } from 'reactflow';
import useStore from './store';
import BaseNode from './BaseNode';
import NodeLabel from './NodeLabelComponent';
import fetch_from_backend from './fetch_from_backend';
import { IconArrowMerge, IconList } from '@tabler/icons-react';
import { Divider, NativeSelect, Text, Popover, Tooltip, Center, Modal, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { escapeBraces } from './backend/template';

const formattingOptions = [
  {value: "-",    label:"- list items"},
  {value: "\n",   label:"newline \\n"},
  {value: "\n\n", label:"double newline \\n\\n"},
  {value: "```",  label:"code blocks"},
  {value: "<p>",  label:"paragraphs (markdown)"},
];
const DEFAULT_SPLIT_FORMAT = formattingOptions[0];

const deepcopy = (v) => JSON.parse(JSON.stringify(v));
const deepcopy_and_modify = (v, new_val_dict) => {
  let new_v = deepcopy(v);
  Object.entries(new_val_dict).forEach(([key, val]) => {
    new_v[key] = val;
  });
  return new_v;
};

const splitText = (s, format) => {
  // If format is newline separators, we can just split:
  if (format === "\n\n" || format === "\n")
    return s.split(format);
  // Other formatting rules require markdown parsing:
  
};

const displaySplitTexts = (textInfos, getColorForLLM) => {
  const color_for_llm = (llm) => (getColorForLLM(llm) + '99');
  return textInfos.map((info, idx) => {

    const vars = info.fill_history;
    let var_tags = vars === undefined ? [] : Object.keys(vars).map((varname) => {
      const v = truncStr(vars[varname].trim(), 72);
      return (<div key={varname} className="response-var-inline">
        <span className="response-var-name">{varname}&nbsp;=&nbsp;</span><span className="response-var-value">{v}</span>
      </div>);
    });
    
    const ps = (<pre className='small-response'>{info.text || info}</pre>);

    return (
      <div key={"r"+idx} className="response-box" style={{ backgroundColor: (info.llm ? color_for_llm(info.llm?.name) : '#ddd'), width: `100%`}}>
        <div className="response-var-inline-container">
          {var_tags}
        </div>
        {info.llm === undefined ?
            ps
          : (<div className="response-item-llm-name-wrapper">
              <h1>{info.llm?.name}</h1>
              {ps}
            </div>)
        }
      </div>
    );
  });
};

const SplitTextsPopover = ({ textInfos, onHover, onClick, getColorForLLM }) => {
    const [opened, { close, open }] = useDisclosure(false);

    const _onHover = useCallback(() => {
        onHover();
        open();
    }, [onHover, open]);

    return (
        <Popover position="right-start" withArrow withinPortal shadow="rgb(38, 57, 77) 0px 10px 30px -14px" key="query-info" opened={opened} styles={{dropdown: {maxHeight: '500px', maxWidth: '400px', overflowY: 'auto', backgroundColor: '#fff'}}}>
            <Popover.Target>
                <Tooltip label='Click to view all split inputs' withArrow>
                    <button className='custom-button' onMouseEnter={_onHover} onMouseLeave={close} onClick={onClick} style={{border:'none'}}>
                        <IconList size='12pt' color='gray' style={{marginBottom: '-4px'}} />
                    </button>
                </Tooltip>
            </Popover.Target>
            <Popover.Dropdown sx={{ pointerEvents: 'none' }}>
                <Center><Text size='xs' fw={500} color='#666'>Preview of split inputs ({textInfos?.length} total)</Text></Center>
                {displaySplitTexts(textInfos, getColorForLLM)}
            </Popover.Dropdown>
        </Popover>
    );
};


const SplitNode = ({ data, id }) => {

  const [splitTexts, setSplitTexts] = useState([]);

  // For an info pop-up that previews all the joined inputs
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] = useDisclosure(false);

  const [pastInputs, setPastInputs] = useState([]);
  const pullInputData = useStore((state) => state.pullInputData);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore((state) => state.getColorForLLMAndSetIfNotFound);

  const [splitOnFormat, setSplitOnFormat] = useState(DEFAULT_SPLIT_FORMAT);

  const handleOnConnect = useCallback(() => {
    let input_data = pullInputData(["__input"], id);
    if (!input_data?.__input) {
      console.warn('Split Node: No input data detected.');
      return;
    }

    // The naive splitter is just to look at every
    // response object's text value, and split that into N objects
    // that have the exact same properties except for their text values.
    let output_data = {};
    Object.entries(input_data).forEach(([key, objs]) => {
      const updated_objs = objs.map(resp_obj => {
        if (typeof resp_obj === "string") return splitText(resp_obj, splitOnFormat);
        const texts = splitText(resp_obj?.text);
        if (texts !== undefined && texts.length > 1)
          return texts.map(t => deepcopy_and_modify(resp_obj, {text: t}));
        else
          return deepcopy(resp_obj); 
      }).flat(); // flatten the split response objects
      output_data[key] = updated_objs;
    });

    setSplitTexts(output_data);
    setDataPropsForNode(id, { fields: output_data });
  }, [pullInputData, splitOnFormat]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input != pastInputs) {
      setPastInputs(data.input);
      handleOnConnect();
    }
  }

  // Refresh split output anytime the dropdown changes
  useEffect(() => {
    handleOnConnect();
  }, [splitOnFormat])

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      // Recreate the visualization:
      setDataPropsForNode(id, { refresh: false });
      handleOnConnect();
    }
  }, [data, id, handleOnConnect, setDataPropsForNode]);

  return (
  <BaseNode classNames="split-node" nodeId={id}>
    <NodeLabel title={data.title || 'Split Node'} 
                nodeId={id}
                icon={<IconArrowMerge size='14pt'/>}
                customButtons={[
                  <SplitTextsPopover key='split-text-previews' textInfos={splitTexts} onHover={handleOnConnect} onClick={openInfoModal} getColorForLLM={getColorForLLMAndSetIfNotFound} />
                ]} />
    <Modal title={'List of split inputs (' + splitTexts.length + ' total)'} size='xl' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-5%'}}}>
        <Box size={600} m='lg' mt='xl'>
            {displaySplitTexts(splitTexts, getColorForLLMAndSetIfNotFound)}
        </Box>
    </Modal>
    <div style={{display: 'flex', justifyContent: 'left', maxWidth: '100%', marginBottom: '10px'}}>
      <Text mt='3px' mr='xs'>Split on</Text>
      <NativeSelect onChange={(e) => setSplitOnFormat(e.target.value)}
                    className='nodrag nowheel'
                    data={formattingOptions}
                    size="xs"
                    value={splitOnFormat}
                    miw='80px'
                    mr='xs' />
    </div>
    <Text size='xs'>All other parts of the LLM response will be ignored.</Text>
    <Handle
      type="target"
      position="left"
      id="__input"
      className="grouped-handle"
      style={{ top: "50%" }}
      onConnect={handleOnConnect}
    />
    <Handle
      type="source"
      position="right"
      id="output"
      className="grouped-handle"
      style={{ top: "50%" }}
    />
  </BaseNode>);
};

export default SplitNode;