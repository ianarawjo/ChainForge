import React, { useState, useEffect, useCallback } from "react";
import { Handle, Position } from "reactflow";
import { v4 as uuid } from "uuid";
import useStore from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { IconArrowMerge, IconList } from "@tabler/icons-react";
import {
  Divider,
  NativeSelect,
  Text,
  Popover,
  Tooltip,
  Center,
  Modal,
  Box,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { escapeBraces } from "./backend/template";
import {
  countNumLLMs,
  toStandardResponseFormat,
  tagMetadataWithLLM,
  extractLLMLookup,
  removeLLMTagFromMetadata,
  groupResponsesBy,
  getVarsAndMetavars,
  cleanMetavarsFilterFunc,
} from "./backend/utils";
import StorageCache from "./backend/cache";
import { ResponseBox } from "./ResponseBoxes";
import {
  Dict,
  JSONCompatible,
  LLMResponsesByVarDict,
  TemplateVarInfo,
} from "./backend/typing";
import { generatePrompts } from "./backend/backend";

enum JoinFormat {
  DubNewLine = "\n\n",
  NewLine = "\n",
  DashedList = "-",
  NumList = "1.",
  PyArr = "[]",
}

const formattingOptions = [
  { value: JoinFormat.DubNewLine, label: "double newline \\n\\n" },
  { value: JoinFormat.NewLine, label: "newline \\n" },
  { value: JoinFormat.DashedList, label: "- dashed list" },
  { value: JoinFormat.NumList, label: "1. numbered list" },
  { value: JoinFormat.PyArr, label: '["list", "of", "strings"]' },
];

const joinTexts = (texts: string[], format: JoinFormat): string => {
  const escaped_texts = texts.map((t) => escapeBraces(t));

  if (format === JoinFormat.DubNewLine || format === JoinFormat.NewLine)
    return escaped_texts.join(format);
  else if (format === JoinFormat.DashedList)
    return escaped_texts.map((t) => "- " + t).join("\n");
  else if (format === JoinFormat.NumList)
    return escaped_texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  else if (format === JoinFormat.PyArr) return JSON.stringify(escaped_texts);

  console.error(`Could not join: Unknown formatting option: ${format}`);
  return escaped_texts[0];
};

const DEFAULT_GROUPBY_VAR_ALL = { label: "all text", value: "A" };

const displayJoinedTexts = (
  textInfos: (TemplateVarInfo | string)[],
  getColorForLLM: (llm_name: string) => string,
) => {
  const color_for_llm = (llm_name: string) => getColorForLLM(llm_name) + "99";
  return textInfos.map((info, idx) => {
    const llm_name =
      typeof info !== "string"
        ? typeof info.llm === "string"
          ? info.llm
          : info.llm?.name
        : "";
    const ps = (
      <pre className="small-response">
        {typeof info === "string" ? info : info.text}
      </pre>
    );
    return (
      <ResponseBox
        key={"r" + idx}
        boxColor={
          typeof info !== "string" && info.llm && llm_name
            ? color_for_llm(llm_name)
            : "#ddd"
        }
        width="100%"
        vars={typeof info === "string" ? {} : info.fill_history ?? {}}
        truncLenForVars={72}
        llmName={llm_name ?? ""}
      >
        {ps}
      </ResponseBox>
    );
  });
};

interface JoinedTextsPopoverProps {
  textInfos: (TemplateVarInfo | string)[];
  onHover: () => void;
  onClick: () => void;
  getColorForLLM: (llm_name: string) => string;
}

const JoinedTextsPopover: React.FC<JoinedTextsPopoverProps> = ({
  textInfos,
  onHover,
  onClick,
  getColorForLLM,
}) => {
  const [opened, { close, open }] = useDisclosure(false);

  const _onHover = useCallback(() => {
    onHover();
    open();
  }, [onHover, open]);

  return (
    <Popover
      position="right-start"
      withArrow
      withinPortal
      shadow="rgb(38, 57, 77) 0px 10px 30px -14px"
      key="query-info"
      opened={opened}
      styles={{
        dropdown: {
          maxHeight: "500px",
          maxWidth: "400px",
          overflowY: "auto",
          backgroundColor: "#fff",
        },
      }}
    >
      <Popover.Target>
        <Tooltip label="Click to view all joined inputs" withArrow>
          <button
            className="custom-button"
            onMouseEnter={_onHover}
            onMouseLeave={close}
            onClick={onClick}
            style={{ border: "none" }}
          >
            <IconList
              size="12pt"
              color="gray"
              style={{ marginBottom: "-4px" }}
            />
          </button>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown sx={{ pointerEvents: "none" }}>
        <Center>
          <Text size="xs" fw={500} color="#666">
            Preview of joined inputs ({textInfos?.length} total)
          </Text>
        </Center>
        {displayJoinedTexts(textInfos, getColorForLLM)}
      </Popover.Dropdown>
    </Popover>
  );
};

export interface JoinNodeProps {
  data: {
    input: JSONCompatible;
    title: string;
    refresh: boolean;
  };
  id: string;
}

const JoinNode: React.FC<JoinNodeProps> = ({ data, id }) => {
  const [joinedTexts, setJoinedTexts] = useState<(TemplateVarInfo | string)[]>(
    [],
  );

  // For an info pop-up that previews all the joined inputs
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] =
    useDisclosure(false);

  const [pastInputs, setPastInputs] = useState<JSONCompatible>([]);
  const pullInputData = useStore((state) => state.pullInputData);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );

  const [inputHasLLMs, setInputHasLLMs] = useState(false);

  const [groupByVars, setGroupByVars] = useState([DEFAULT_GROUPBY_VAR_ALL]);
  const [groupByVar, setGroupByVar] = useState("A");

  const [groupByLLM, setGroupByLLM] = useState("within");
  const [formatting, setFormatting] = useState(formattingOptions[0].value);

  const handleOnConnect = useCallback(() => {
    let input_data: LLMResponsesByVarDict = pullInputData(["__input"], id);
    if (!input_data?.__input) {
      // soft fail
      return;
    }

    // Find all vars and metavars in the input data (if any):
    const { vars, metavars } = getVarsAndMetavars(input_data);

    // Create lookup table for LLMs in input, indexed by llm key
    const llm_lookup = extractLLMLookup(input_data);

    // Refresh the dropdown list with available vars/metavars:
    setGroupByVars(
      [DEFAULT_GROUPBY_VAR_ALL]
        .concat(
          vars.map((varname) => ({
            label: `by ${varname}`,
            value: `V${varname}`,
          })),
        )
        .concat(
          metavars.filter(cleanMetavarsFilterFunc).map((varname) => ({
            label: `by ${varname} (meta)`,
            value: `M${varname}`,
          })),
        ),
    );

    // Check whether more than one LLM is present in the inputs:
    const numLLMs = countNumLLMs(input_data);
    setInputHasLLMs(numLLMs > 1);

    // Tag all response objects in the input data with a metavar for their LLM (using the llm key as a uid)
    input_data = tagMetadataWithLLM(input_data);

    // A function to group the input (an array of texts/resp_objs) by the selected var
    // and then join the texts within the groups
    const joinByVar = (input: TemplateVarInfo[]) => {
      const varname = groupByVar.substring(1);
      const isMetavar = groupByVar[0] === "M";
      const [groupedResps, unspecGroup] = groupResponsesBy(
        input,
        isMetavar
          ? (r) => (r.metavars ? r.metavars[varname] : undefined)
          : (r) => (r.fill_history ? r.fill_history[varname] : undefined),
      );

      // Now join texts within each group:
      // (NOTE: We can do this directly here as response texts can't be templates themselves)
      const joined_texts: (TemplateVarInfo | string)[] = Object.entries(
        groupedResps,
      ).map(([var_val, resp_objs]) => {
        if (resp_objs.length === 0) return "";
        const llm = countNumLLMs(resp_objs) > 1 ? undefined : resp_objs[0].llm;
        const vars: Dict<string> = {};
        if (groupByVar !== "A") vars[varname] = var_val;
        return {
          text: joinTexts(
            resp_objs.map((r) => (typeof r === "string" ? r : r.text ?? "")),
            formatting,
          ),
          fill_history: isMetavar ? {} : vars,
          metavars: isMetavar ? vars : {},
          llm,
          uid: uuid(),
          // NOTE: We lose all other metadata here, because we could've joined across other vars or metavars values.
        };
      });

      // Add any data from unspecified group
      if (unspecGroup.length > 0) {
        const llm =
          countNumLLMs(unspecGroup) > 1 ? undefined : unspecGroup[0].llm;
        joined_texts.push({
          text: joinTexts(
            unspecGroup.map((u) => (typeof u === "string" ? u : u.text ?? "")),
            formatting,
          ),
          fill_history: {},
          metavars: {},
          llm,
          uid: uuid(),
        });
      }

      return joined_texts;
    };

    // Generate (flatten) the inputs, which could be recursively chained templates
    // and a mix of LLM resp objects, templates, and strings.
    // (We tagged each object with its LLM key so that we can use built-in features to keep track of the LLM associated with each response object)
    generatePrompts(
      "{__input}",
      input_data as Dict<(TemplateVarInfo | string)[]>,
    )
      .then((promptTemplates) => {
        // Convert the templates into response objects
        const resp_objs = promptTemplates.map(
          (p) =>
            ({
              text: p.toString(),
              fill_history: p.fill_history,
              llm:
                "__LLM_key" in p.metavars
                  ? llm_lookup[p.metavars.__LLM_key]
                  : undefined,
              metavars: removeLLMTagFromMetadata(p.metavars),
              uid: uuid(),
            }) as TemplateVarInfo,
        );

        // If there's multiple LLMs and groupByLLM is 'within', we need to
        // first group by the LLMs (and a possible 'undefined' group):
        if (numLLMs > 1 && groupByLLM === "within") {
          let joined_texts: (TemplateVarInfo | string)[] = [];
          const [groupedRespsByLLM, nonLLMRespGroup] = groupResponsesBy(
            resp_objs,
            (r) => (typeof r.llm === "string" ? r.llm : r.llm?.key),
          );
          // eslint-disable-next-line
          Object.entries(groupedRespsByLLM).forEach(([llm_key, resp_objs]) => {
            // Group only within the LLM
            joined_texts = joined_texts.concat(joinByVar(resp_objs));
          });

          if (nonLLMRespGroup.length > 0)
            joined_texts.push(
              joinTexts(
                nonLLMRespGroup.map((t) => t.text ?? ""),
                formatting,
              ),
            );

          setJoinedTexts(joined_texts);
          setDataPropsForNode(id, { fields: joined_texts });
        } else {
          // Join across LLMs (join irrespective of LLM):
          if (groupByVar !== "A") {
            // If groupByVar is set to non-ALL (not "A"), then we need to group responses by that variable first:
            const joined_texts = joinByVar(resp_objs);
            setJoinedTexts(joined_texts);
            setDataPropsForNode(id, { fields: joined_texts });
          } else {
            let joined_texts: string | TemplateVarInfo = joinTexts(
              resp_objs.map((r) => (typeof r === "string" ? r : r.text ?? "")),
              formatting,
            );

            // If there is exactly 1 LLM and it's present across all inputs, keep track of it:
            if (numLLMs === 1 && resp_objs.every((r) => r.llm !== undefined))
              joined_texts = {
                text: joined_texts,
                fill_history: {},
                llm: resp_objs[0].llm,
                uid: uuid(),
              };

            setJoinedTexts([joined_texts]);
            setDataPropsForNode(id, { fields: [joined_texts] });
          }
        }
      })
      .catch(console.error);
  }, [formatting, pullInputData, groupByVar, groupByLLM]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input !== pastInputs) {
      setPastInputs(data.input);
      handleOnConnect();
    }
  }

  // Refresh join output anytime the dropdowns change
  useEffect(() => {
    handleOnConnect();
  }, [groupByVar, groupByLLM, formatting]);

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
      <NodeLabel
        title={data.title || "Join Node"}
        nodeId={id}
        icon={<IconArrowMerge size="12pt" />}
        customButtons={[
          <JoinedTextsPopover
            key="joined-text-previews"
            textInfos={joinedTexts}
            onHover={handleOnConnect}
            onClick={openInfoModal}
            getColorForLLM={getColorForLLMAndSetIfNotFound}
          />,
        ]}
      />
      <Modal
        title={"List of joined inputs (" + joinedTexts.length + " total)"}
        size="xl"
        opened={infoModalOpened}
        onClose={closeInfoModal}
        styles={{
          header: { backgroundColor: "#FFD700" },
          root: { position: "relative", left: "-5%" },
        }}
      >
        <Box m="lg" mt="xl">
          {displayJoinedTexts(joinedTexts, getColorForLLMAndSetIfNotFound)}
        </Box>
      </Modal>
      <div
        style={{
          display: "flex",
          justifyContent: "left",
          maxWidth: "100%",
          marginBottom: "10px",
        }}
      >
        <Text mt="3px" mr="xs">
          Join
        </Text>
        <NativeSelect
          onChange={(e) => setGroupByVar(e.target.value)}
          className="nodrag nowheel"
          data={groupByVars}
          size="xs"
          value={groupByVar}
          miw="80px"
          mr="xs"
        />
      </div>
      {inputHasLLMs ? (
        <div
          style={{
            display: "flex",
            justifyContent: "left",
            maxWidth: "100%",
            marginBottom: "10px",
          }}
        >
          <NativeSelect
            onChange={(e) => setGroupByLLM(e.target.value)}
            className="nodrag nowheel"
            data={["within", "across"]}
            size="xs"
            value={groupByLLM}
            maw="80px"
            mr="xs"
            ml="40px"
          />
          <Text mt="3px">LLMs</Text>
        </div>
      ) : (
        <></>
      )}
      <Divider my="xs" label="formatting" labelPosition="center" />
      <NativeSelect
        onChange={(e) => setFormatting(e.target.value as JoinFormat)}
        className="nodrag nowheel"
        data={formattingOptions}
        size="xs"
        value={formatting}
        miw="80px"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="__input"
        className="grouped-handle"
        style={{ top: "50%" }}
        onConnect={handleOnConnect}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="grouped-handle"
        style={{ top: "50%" }}
      />
    </BaseNode>
  );
};

export default JoinNode;
