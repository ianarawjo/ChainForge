import React, { useState, useEffect, useCallback } from 'react';
import { Handle } from 'reactflow';
import useStore from './store';
import BaseNode from './BaseNode';
import NodeLabel from './NodeLabelComponent';
import fetch_from_backend from './fetch_from_backend';
import { IconArrowMerge, IconArrowsSplit, IconList } from '@tabler/icons-react';
import { Divider, NativeSelect, Text, Popover, Tooltip, Center, Modal, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { escapeBraces } from './backend/template';
import { processCSV, deepcopy, deepcopy_and_modify, dict_excluding_key, toStandardResponseFormat } from "./backend/utils";

import { fromMarkdown } from "mdast-util-from-markdown";
import StorageCache from './backend/cache';

const formattingOptions = [
  {value: "list",    label:"- list items"},
  {value: "\n",   label:"newline \\n"},
  {value: "\n\n", label:"double newline \\n\\n"},
  {value: ",",    label:"commas (,)"},
  {value: "code",  label:"code blocks"},
  {value: "paragraph",  label:"paragraphs (md)"},
];

const truncStr = (s, maxLen) => {
  if (s.length > maxLen) // Cut the name short if it's long
      return s.substring(0, maxLen) + '...'
  else
      return s;
};
const tagMetadataWithLLM = (input_data) => {
  let new_data = {};
  Object.entries(input_data).forEach(([varname, resp_objs]) => {
    new_data[varname] = resp_objs.map(r => {
      if (!r || typeof r === 'string' || !r?.llm?.key) return r;
      let r_copy = JSON.parse(JSON.stringify(r));
      r_copy.metavars["__LLM_key"] = r.llm.key;
      return r_copy;
    });
  });
  return new_data;
};
const extractLLMLookup = (input_data) => {
  let llm_lookup = {};
  Object.entries(input_data).forEach(([varname, resp_objs]) => {
    resp_objs.forEach(r => {
      if (typeof r === 'string' || !r?.llm?.key || r.llm.key in llm_lookup) return;
      llm_lookup[r.llm.key] = r.llm;
    });
  });
  return llm_lookup;
};
const removeLLMTagFromMetadata = (metavars) => {
  if (!('__LLM_key' in metavars))
    return metavars; 
  let mcopy = JSON.parse(JSON.stringify(metavars));
  delete mcopy['__LLM_key'];
  return mcopy;
};

/** Flattens markdown AST as dict to text (string) */
function compileTextFromMdAST(md) {
  if (md?.value !== undefined)
    return md.value ?? "";
  else if (md?.children?.length > 0)
    return md.children.map(compileTextFromMdAST).join("");
  return "";
}

const splitText = (s, format) => {
  // If format is newline separators, we can just split:
  if (format === "\n\n" || format === "\n")
    return s.split(format).map(s => escapeBraces(s.trim())).filter(s => s.length > 0);
  else if (format === ',')
    return processCSV(s).map(s => escapeBraces(s)).filter(s => s.length > 0);

  // Other formatting rules require markdown parsing:
  // Parse string as markdown
  const md = fromMarkdown(s);
  let results = [];

  const extract_md_blocks = (block_type) => {
    if (md?.children.length > 0 && md.children.some(c => c.type === block_type)) {
      // Find the relevant block(s) that appear in the markdown text, at the root level:
      const md_blocks = md.children.filter(c => c.type === block_type);
      for (const md_block of md_blocks) {
        if (block_type === 'list') {
          // Extract the list items, flattening the ASTs to text 
          const items = "children" in md_block ? md_block.children : [];
          for (const item of items) {
            const text = compileTextFromMdAST(item).trim();
            results.push(text);
          }
        } else if (md_block?.children !== undefined) {
          results.push(compileTextFromMdAST(md_block).trim());
        }
        if (md_block.value !== undefined)
          results.push(md_block.value);
      }
    }
  };

  extract_md_blocks(format);
  results = results.filter(s => s.length > 0).map(escapeBraces);

  // NOTE: It is possible to have an empty [] results after split.
  // This happens if the splitter is a markdown separator, and none were found in the input(s).
  return results;
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
    
    const ps = (<pre className='small-response'>{info.text ?? info}</pre>);

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

  const [splitOnFormat, setSplitOnFormat] = useState(data.splitFormat || 'list');

  const handleOnConnect = useCallback(() => {
    const formatting = splitOnFormat;

    let input_data = pullInputData(["__input"], id);
    if (!input_data?.__input) {
      // soft fail if no inputs detected
      return;
    }

    // Create lookup table for LLMs in input, indexed by llm key
    const llm_lookup = extractLLMLookup(input_data);

    // Tag all response objects in the input data with a metavar for their LLM (using the llm key as a uid)
    input_data = tagMetadataWithLLM(input_data);

    // Generate (flatten) the inputs, which could be recursively chained templates 
    // and a mix of LLM resp objects, templates, and strings. 
    // (We tagged each object with its LLM key so that we can use built-in features to keep track of the LLM associated with each response object)
    fetch_from_backend('generatePrompts', {
      prompt: "{__input}",
      vars: input_data,
    }).then(promptTemplates => {

      // Convert the templates into response objects
      let resp_objs = promptTemplates.map(p => ({
        text: p.toString(),
        fill_history: dict_excluding_key(p.fill_history, "__input"),
        llm: "__LLM_key" in p.metavars ? llm_lookup[p.metavars['__LLM_key']] : undefined,
        metavars: removeLLMTagFromMetadata(p.metavars),
      }));

      // The naive splitter is just to look at every
      // response object's text value, and split that into N objects
      // that have the exact same properties except for their text values.
      const split_objs = resp_objs.map(resp_obj => {
        if (typeof resp_obj === "string") return splitText(resp_obj, formatting);
        const texts = splitText(resp_obj?.text, formatting);
        if (texts !== undefined && texts.length >= 1)
          return texts.map(t => deepcopy_and_modify(resp_obj, {text: t}));
        else if (texts?.length === 0)
          return [];
        else
          return deepcopy(resp_obj); 
      }).flat(); // flatten the split response objects

      setSplitTexts(split_objs);
      setDataPropsForNode(id, { fields: split_objs });
    });

  }, [pullInputData, splitOnFormat, splitText, extractLLMLookup, tagMetadataWithLLM]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input !== pastInputs) {
      setPastInputs(data.input);
      handleOnConnect();
    }
  }

  // Refresh split output anytime the dropdown changes
  useEffect(() => {
    handleOnConnect();
  }, [splitOnFormat])

  // Store the outputs to the cache whenever they change
  useEffect(() => {
    StorageCache.store(`${id}.json`, splitTexts.map(toStandardResponseFormat));
  }, [splitTexts]);

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
                icon={<IconArrowsSplit size='12pt'/>}
                customButtons={[
                  <SplitTextsPopover key='split-text-previews' textInfos={splitTexts} onHover={handleOnConnect} onClick={openInfoModal} getColorForLLM={getColorForLLMAndSetIfNotFound} />
                ]} />
    <Modal title={'List of split inputs (' + splitTexts.length + ' total)'} size='xl' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-5%'}}}>
        <Box size={600} m='lg' mt='xl'>
            {displaySplitTexts(splitTexts, getColorForLLMAndSetIfNotFound)}
        </Box>
    </Modal>
    <NativeSelect onChange={(e) => {setSplitOnFormat(e.target.value); setDataPropsForNode(id, {splitFormat: e.target.value});}}
                    className='nowheel'
                    label={'Split on'}
                    data={formattingOptions}
                    size="xs"
                    value={splitOnFormat}
                    miw='80px'
                    mr='xs'
                    mt='-6px' />
    { !(splitOnFormat?.length <= 2) ?
        <Text color='gray' size='8pt' mt='xs' maw='150px'>All other parts of the input text will be ignored.</Text>
      : <></>
    }
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