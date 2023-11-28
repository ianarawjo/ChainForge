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
import { countNumLLMs, toStandardResponseFormat } from './backend/utils';
import StorageCache from './backend/cache';

const formattingOptions = [
  {value: "\n\n", label:"double newline \\n\\n"},
  {value: "\n",   label:"newline \\n"},
  {value: "-",    label:"- dashed list"},
  {value: "1.",    label:"1. numbered list"},
  {value: "[]",   label:'["list", "of", "strings"]'}
];

const joinTexts = (texts, format) => {
  const escaped_texts = texts.map(t => escapeBraces(t));

  if (format === "\n\n" || format === "\n")
    return escaped_texts.join(format);
  else if (format === "-")
    return escaped_texts.map((t) => ('- ' + t)).join("\n");
  else if (format === "1.")
    return escaped_texts.map((t, i) => (`${i+1}. ${t}`)).join("\n");
  else if (format === '[]')
    return JSON.stringify(escaped_texts);

  console.error(`Could not join: Unknown formatting option: ${format}`);
  return escaped_texts;
};

const getVarsAndMetavars = (input_data) => {
  // Find all vars and metavars in the input data (if any):
  let varnames = new Set();
  let metavars = new Set();
  Object.entries(input_data).forEach(([key, obj]) => {
    if (key !== '__input') varnames.add(key); // A "var" can also be other properties on input_data
    obj.forEach(resp_obj => {
      if (typeof resp_obj === "string") return;
      Object.keys(resp_obj.fill_history).forEach(v => varnames.add(v));
      if (resp_obj.metavars) Object.keys(resp_obj.metavars).forEach(v => metavars.add(v));
    });
  });
  varnames = Array.from(varnames);
  metavars = Array.from(metavars);
  return {
    vars: varnames,
    metavars: metavars,
  };
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
  Object.values(input_data).forEach((resp_objs) => {
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

const truncStr = (s, maxLen) => {
  if (s.length > maxLen) // Cut the name short if it's long
      return s.substring(0, maxLen) + '...';
  else
      return s;
};

const groupResponsesBy = (responses, keyFunc) => {
  let responses_by_key = {};
  let unspecified_group = [];
  responses.forEach(item => {
      const key = keyFunc(item);
      const d = key !== null ? responses_by_key : unspecified_group;
      if (key in d)
          d[key].push(item);
      else
          d[key] = [item];
  });
  return [responses_by_key, unspecified_group];
};

const DEFAULT_GROUPBY_VAR_ALL = { label: "all text", value: "A" };

const displayJoinedTexts = (textInfos, getColorForLLM) => {
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

const JoinedTextsPopover = ({ textInfos, onHover, onClick, getColorForLLM }) => {
    const [opened, { close, open }] = useDisclosure(false);

    const _onHover = useCallback(() => {
        onHover();
        open();
    }, [onHover, open]);

    return (
        <Popover position="right-start" withArrow withinPortal shadow="rgb(38, 57, 77) 0px 10px 30px -14px" key="query-info" opened={opened} styles={{dropdown: {maxHeight: '500px', maxWidth: '400px', overflowY: 'auto', backgroundColor: '#fff'}}}>
            <Popover.Target>
                <Tooltip label='Click to view all joined inputs' withArrow>
                    <button className='custom-button' onMouseEnter={_onHover} onMouseLeave={close} onClick={onClick} style={{border:'none'}}>
                        <IconList size='12pt' color='gray' style={{marginBottom: '-4px'}} />
                    </button>
                </Tooltip>
            </Popover.Target>
            <Popover.Dropdown sx={{ pointerEvents: 'none' }}>
                <Center><Text size='xs' fw={500} color='#666'>Preview of joined inputs ({textInfos?.length} total)</Text></Center>
                {displayJoinedTexts(textInfos, getColorForLLM)}
            </Popover.Dropdown>
        </Popover>
    );
};


const JoinNode = ({ data, id }) => {

  const [joinedTexts, setJoinedTexts] = useState([]);

  // For an info pop-up that previews all the joined inputs
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] = useDisclosure(false);

  const [pastInputs, setPastInputs] = useState([]);
  const pullInputData = useStore((state) => state.pullInputData);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore((state) => state.getColorForLLMAndSetIfNotFound);

  const [inputHasLLMs, setInputHasLLMs] = useState(false);

  const [groupByVars, setGroupByVars] = useState([DEFAULT_GROUPBY_VAR_ALL]);
  const [groupByVar, setGroupByVar] = useState("A");

  const [groupByLLM, setGroupByLLM] = useState("within");
  const [formatting, setFormatting] = useState(formattingOptions[0].value);

  const handleOnConnect = useCallback(() => {
    let input_data = pullInputData(["__input"], id);
    if (!input_data?.__input) {
      // soft fail
      return;
    }

    // Find all vars and metavars in the input data (if any):
    let {vars, metavars} = getVarsAndMetavars(input_data);

    // Create lookup table for LLMs in input, indexed by llm key
    const llm_lookup = extractLLMLookup(input_data);

    // Refresh the dropdown list with available vars/metavars:
    setGroupByVars([DEFAULT_GROUPBY_VAR_ALL].concat(
      vars.map(varname => ({label: `by ${varname}`, value: `V${varname}`})))
    .concat(
      metavars.filter(varname => !varname.startsWith('LLM_')).map(varname => ({label: `by ${varname} (meta)`, value: `M${varname}`})))
    );

    // Check whether more than one LLM is present in the inputs: 
    const numLLMs = countNumLLMs(input_data);
    setInputHasLLMs(numLLMs > 1);

    // Tag all response objects in the input data with a metavar for their LLM (using the llm key as a uid)
    input_data = tagMetadataWithLLM(input_data);

    // A function to group the input (an array of texts/resp_objs) by the selected var
    // and then join the texts within the groups
    const joinByVar = (input) => {
      const varname = groupByVar.substring(1);
      const isMetavar = groupByVar[0] === 'M';
      const [groupedResps, unspecGroup] = groupResponsesBy(input, 
        isMetavar ? 
          (r) => (r.metavars ? r.metavars[varname] : undefined) :
          (r) => (r.fill_history ? r.fill_history[varname] : undefined)
      );

      // Now join texts within each group: 
      // (NOTE: We can do this directly here as response texts can't be templates themselves)
      let joined_texts = Object.entries(groupedResps).map(([var_val, resp_objs]) => {
        if (resp_objs.length === 0) return "";
        const llm = (countNumLLMs(resp_objs) > 1) ? undefined : resp_objs[0].llm;
        let vars = {};
        if (groupByVar !== 'A')
          vars[varname] = var_val;
        return {
          text: joinTexts(resp_objs.map(r => r.text !== undefined ? r.text : r), formatting),
          fill_history: isMetavar ? {} : vars,
          metavars: isMetavar ? vars : {},
          llm: llm,
          // NOTE: We lose all other metadata here, because we could've joined across other vars or metavars values.
        };
      });

      // Add any data from unspecified group
      if (unspecGroup.length > 0) {
        const llm = (countNumLLMs(unspecGroup) > 1) ? undefined : unspecGroup[0].llm;
        joined_texts.push({
          text: joinTexts(unspecGroup.map(u => u.text !== undefined ? u.text : u), formatting),
          fill_history: {},
          metavars: {},
          llm: llm,
        });
      }

      return joined_texts;
    };

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
        fill_history: p.fill_history,
        llm: "__LLM_key" in p.metavars ? llm_lookup[p.metavars['__LLM_key']] : undefined,
        metavars: removeLLMTagFromMetadata(p.metavars),
      }));

      // If there's multiple LLMs and groupByLLM is 'within', we need to
      // first group by the LLMs (and a possible 'undefined' group):
      if (numLLMs > 1 && groupByLLM === 'within') {
        let joined_texts = [];
        const [groupedRespsByLLM, nonLLMRespGroup] = groupResponsesBy(resp_objs, r => r.llm?.key || r.llm);
        Object.entries(groupedRespsByLLM).map(([llm_key, resp_objs]) => {
          // Group only within the LLM
          joined_texts = joined_texts.concat(joinByVar(resp_objs));
        });

        if (nonLLMRespGroup.length > 0)
          joined_texts.push(joinTexts(nonLLMRespGroup, formatting));

        setJoinedTexts(joined_texts);
        setDataPropsForNode(id, { fields: joined_texts });
      } else {
        // Join across LLMs (join irrespective of LLM):
        if (groupByVar !== 'A') {
          // If groupByVar is set to non-ALL (not "A"), then we need to group responses by that variable first:
          const joined_texts = joinByVar(resp_objs);
          setJoinedTexts(joined_texts);
          setDataPropsForNode(id, { fields: joined_texts });
        } else {
          let joined_texts = joinTexts(resp_objs.map(r => ((typeof r === 'string') ? r : r.text)), formatting);

          // If there is exactly 1 LLM and it's present across all inputs, keep track of it:
          if (numLLMs === 1 && resp_objs.every((r) => r.llm !== undefined))
            joined_texts = {text: joined_texts, fill_history: {}, llm: resp_objs[0].llm};

          setJoinedTexts([joined_texts]);
          setDataPropsForNode(id, { fields: [joined_texts] });
        }
      }
    });

  }, [formatting, pullInputData, groupByVar, groupByLLM]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input != pastInputs) {
        setPastInputs(data.input);
        handleOnConnect();
    }
  }

  // Refresh join output anytime the dropdowns change
  useEffect(() => {
    handleOnConnect();
  }, [groupByVar, groupByLLM, formatting])

  // Store the outputs to the cache whenever they change
  useEffect(() => {
    StorageCache.store(`${id}.json`, joinedTexts.map(toStandardResponseFormat));
  }, [joinedTexts]);

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
        // Recreate the visualization:
        setDataPropsForNode(id, { refresh: false });
        handleOnConnect();
    }
  }, [data, id, handleOnConnect, setDataPropsForNode]);

  return (
    <BaseNode classNames="join-node" nodeId={id}>
    <NodeLabel title={data.title || 'Join Node'} 
                nodeId={id}
                icon={<IconArrowMerge size='12pt'/>}
                customButtons={[
                  <JoinedTextsPopover key='joined-text-previews' textInfos={joinedTexts} onHover={handleOnConnect} onClick={openInfoModal} getColorForLLM={getColorForLLMAndSetIfNotFound} />
                ]} />
    <Modal title={'List of joined inputs (' + joinedTexts.length + ' total)'} size='xl' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-5%'}}}>
        <Box size={600} m='lg' mt='xl'>
            {displayJoinedTexts(joinedTexts, getColorForLLMAndSetIfNotFound)}
        </Box>
    </Modal>
    <div style={{display: 'flex', justifyContent: 'left', maxWidth: '100%', marginBottom: '10px'}}>
      <Text mt='3px' mr='xs'>Join</Text>
      <NativeSelect onChange={(e) => setGroupByVar(e.target.value)}
                    className='nodrag nowheel'
                    data={groupByVars}
                    size="xs"
                    value={groupByVar}
                    miw='80px'
                    mr='xs' />
    </div>
    {inputHasLLMs ? 
      <div style={{display: 'flex', justifyContent: 'left', maxWidth: '100%', marginBottom: '10px'}}>
        <NativeSelect onChange={(e) => setGroupByLLM(e.target.value)}
                      className='nodrag nowheel'
                      data={["within", "across"]}
                      size="xs"
                      value={groupByLLM}
                      maw='80px'
                      mr='xs'
                      ml='40px' />
        <Text mt='3px'>LLMs</Text>
      </div>
    : <></>}
    <Divider my="xs" label="formatting" labelPosition="center" />
    <NativeSelect onChange={(e) => setFormatting(e.target.value)}
                  className='nodrag nowheel'
                  data={formattingOptions}
                  size="xs"
                  value={formatting}
                  miw='80px' />
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

export default JoinNode;