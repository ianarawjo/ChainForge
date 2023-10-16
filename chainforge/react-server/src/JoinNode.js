import React, { useState, useEffect, useCallback } from 'react';
import { Handle } from 'reactflow';
import useStore from './store';
import NodeLabel from './NodeLabelComponent';
import fetch_from_backend from './fetch_from_backend';
import { IconArrowMerge, IconList } from '@tabler/icons-react';
import { Divider, NativeSelect, Text, Popover, Tooltip, Center, Modal, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

const formattingOptions = [
  {value: "\n\n", label:"double newline \\n\\n"},
  {value: "\n",   label:"newline \\n"},
  {value: "-",    label:"- dashed list"},
  {value: "[]",   label:'["list", "of", "strings"]'}
];

const joinTexts = (texts, formatting) => {
  if (formatting === "\n\n" || formatting === "\n")
    return texts.join(formatting);
  else if (formatting === "-")
    return texts.map((t) => (' - ' + t)).join("\n");
  else if (formatting === '[]')
    return JSON.stringify(texts);

  console.error(`Could not join: Unknown formatting option: ${formatting}`);
  return texts;
};

const getVarsAndMetavars = (input_data) => {
  // Find all vars and metavars in the input data (if any):
  let varnames = new Set();
  let metavars = new Set();
  input_data.forEach(resp_obj => {
    if (typeof resp_obj === "string") return;
    Object.keys(resp_obj.fill_history).forEach(v => varnames.add(v));
    if (resp_obj.metavars) Object.keys(resp_obj.metavars).forEach(v => metavars.add(v));
  });
  varnames = Array.from(varnames);
  metavars = Array.from(metavars);
  return {
    vars: varnames,
    metavars: metavars,
  };
}

const containsMultipleLLMs = (resp_objs) => {
  return (new Set(resp_objs.map(r => r.llm.key || r.llm))).length > 1;
}

const truncStr = (s, maxLen) => {
  if (s.length > maxLen) // Cut the name short if it's long
      return s.substring(0, maxLen) + '...'
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

const displayJoinedTexts = (textInfos) => 
  textInfos.map((info, idx) => {
    const vars = info.fill_history;
    const var_tags = vars === undefined ? [] : Object.keys(vars).map((varname) => {
      const v = truncStr(vars[varname].trim(), 72);
      return (<div key={varname} className="response-var-inline">
        <span className="response-var-name">{varname}&nbsp;=&nbsp;</span><span className="response-var-value">{v}</span>
      </div>);
    });
    return (
      <div key={idx}>
        {var_tags}
        <pre className='prompt-preview join-text-preview'>
          {info.text || info}
        </pre>
      </div>
    );
  });

const JoinedTextsPopover = ({ textInfos, onHover, onClick }) => {
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
                {displayJoinedTexts(textInfos)}
            </Popover.Dropdown>
        </Popover>
    );
};


const JoinNode = ({ data, id }) => {

  let is_fetching = false;

  const [joinedTexts, setJoinedTexts] = useState([]);

  // For an info pop-up that previews all the joined inputs
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] = useDisclosure(false);

  const [pastInputs, setPastInputs] = useState([]);
  const pullInputData = useStore((state) => state.pullInputData);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const [inputHasLLMs, setInputHasLLMs] = useState(false);
  const [inputHasMultiRespPerLLM, setInputHasMultiRespPerLLM] = useState(false);

  const [groupByVars, setGroupByVars] = useState([DEFAULT_GROUPBY_VAR_ALL]);
  const [groupByVar, setGroupByVar] = useState("A");

  const [groupByLLM, setGroupByLLM] = useState("within");
  const [responsesPerPrompt, setResponsesPerPrompt] = useState("all");
  const [formatting, setFormatting] = useState(formattingOptions[0].value);

  const handleOnConnect = useCallback(() => {
    const input_data = pullInputData(["__input"], id);
    if (!input_data?.__input) {
      console.warn('Join Node: No input data detected.');
      return;
    }

    console.log(input_data);

    // Find all vars and metavars in the input data (if any):
    const {vars, metavars} = getVarsAndMetavars(input_data.__input);

    // Refresh the dropdown list with available vars/metavars:
    setGroupByVars([DEFAULT_GROUPBY_VAR_ALL].concat(
      vars.map(varname => ({label: `within ${varname}`, value: `V${varname}`})))
    .concat(
      metavars.filter(varname => !varname.startsWith('LLM_')).map(varname => ({label: `within ${varname} (meta)`, value: `M${varname}`})))
    );

    // If groupByVar is set to non-ALL (not "A"), then we need to group responses by that variable first: 
    if (groupByVar !== 'A') {
      const varname = groupByVar.substring(1);
      const [groupedResps, unspecGroup] = groupResponsesBy(input_data.__input, 
        (groupByVar[0] === 'V') ? 
          (r) => r.fill_history[varname] : 
          (r) => r.metavars[varname]
      );
      console.log(groupedResps);

      // Now join texts within each group: 
      // (NOTE: We can do this directly here as response texts can't be templates themselves)
      let joined_texts = Object.entries(groupedResps).map(([var_val, resp_objs]) => {
        if (resp_objs.length === 0) return "";
        let llm = containsMultipleLLMs(resp_objs) ? undefined : resp_objs[0].llm;
        let vars = {};
        vars[varname] = var_val;
        return {
          text: joinTexts(resp_objs.map(r => r.text), formatting),
          fill_history: vars,
          llm: llm,
          // NOTE: We lose all other metadata here, because we could've joined across other vars or metavars values.
        };
      });
      setJoinedTexts(joined_texts);
      console.log(joined_texts);
    } 
    else {
      // Since templates could be chained, we need to run this 
      // through the prompt generator: 
      fetch_from_backend('generatePrompts', {
        prompt: "{__input}",
        vars: input_data,
      }).then(promptTemplates => {
        const texts = promptTemplates.map(p => p.toString());
        console.log(texts);

        const joined_texts = joinTexts(texts, formatting);
        setJoinedTexts([joined_texts]);
        console.log(joined_texts);
      });
    }

  }, [formatting, pullInputData, groupByVar]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input != pastInputs) {
        setPastInputs(data.input);
        handleOnConnect();
    }
  }

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
        // Recreate the visualization:
        setDataPropsForNode(id, { refresh: false });
        handleOnConnect();
    }
  }, [data, id, handleOnConnect, setDataPropsForNode]);

  return (
    <div className="join-node cfnode">
    <NodeLabel title={data.title || 'Join Node'} 
                nodeId={id}
                icon={<IconArrowMerge size='14pt'/>}
                customButtons={[
                  <JoinedTextsPopover key='joined-text-previews' textInfos={joinedTexts} onHover={handleOnConnect} onClick={openInfoModal} />
                ]} />
    <Modal title={'List of joined inputs (' + joinedTexts.length + ' total)'} size='xl' opened={infoModalOpened} onClose={closeInfoModal} styles={{header: {backgroundColor: '#FFD700'}, root: {position: 'relative', left: '-5%'}}}>
        <Box size={600} m='lg' mt='xl'>
            {displayJoinedTexts(joinedTexts)}
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
        <Text mt='3px'>LLM(s)</Text>
      </div>
    : <></>}
    {inputHasMultiRespPerLLM ? 
      <div style={{display: 'flex', justifyContent: 'left', maxWidth: '100%'}}>
        <NativeSelect onChange={(e) => setResponsesPerPrompt(e.target.value)}
                      className='nodrag nowheel'
                      data={["all", "1", "2", "3"]}
                      size="xs"
                      value={"1"}
                      maw='80px'
                      mr='xs' 
                      ml='40px'
                      color='gray' />
        <Text size='sm' mt='3px' color='gray' fs='italic'>resp / prompt</Text>
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
  </div>);
};

export default JoinNode;