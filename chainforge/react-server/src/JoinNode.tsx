import React, { useState, useEffect, useCallback } from "react";
import {
  runnerFromStatus,
  useNodeRunner,
  useTrackedStatus,
} from "./useNodeRunner";
import { Status } from "./StatusIndicatorComponent";
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
  MultiSelect,
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
  llmResponseDataToString,
} from "./backend/utils";
import StorageCache, { StringLookup } from "./backend/cache";
import { TextResponseCard } from "./TableResponseCell";
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
  return textInfos.map((info, idx) => {
    if (typeof info === "string")
      return <TextResponseCard key={"r" + idx} text={info} />;
    const llm_name = info.llm
      ? typeof info.llm === "string" || typeof info.llm === "number"
        ? StringLookup.get(info.llm)
        : StringLookup.get(info.llm?.name)
      : undefined;
    return (
      <TextResponseCard
        key={"r" + idx}
        text={StringLookup.get(info.text) ?? ""}
        modelName={llm_name}
        modelColor={llm_name ? getColorForLLM(llm_name) : undefined}
        vars={info.fill_history}
      />
    );
  });
};

interface JoinedTextsPopoverProps {
  textInfos: (TemplateVarInfo | string)[];
  /** Optional: the preview no longer recomputes the node on hover. */
  onHover?: () => void;
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
    onHover?.();
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
    >
      <Popover.Target>
        <Tooltip label="Click to view all joined inputs" withArrow withinPortal>
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
      <Popover.Dropdown className="prompt-preview-popover">
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
    groupByVars: {
      label: string;
      value: string;
    }[];
    selectedGroupVars?: string[];
    groupByLLM: string;
    formatting: JoinFormat;
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

  // A join is run from its button, like the prompt and evaluator nodes, and
  // reports how it went through its status indicator.
  const [status, setStatus, statusRef] = useTrackedStatus();
  const pullInputData = useStore((state) => state.pullInputData);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );

  const [inputHasLLMs, setInputHasLLMs] = useState(false);
  // Available variables / metavariables to group by
  const [groupByVars, setGroupByVars] = useState(
    data.groupByVars ?? [DEFAULT_GROUPBY_VAR_ALL],
  );
  const [selectedGroupVars, setSelectedGroupVars] = useState<string[]>(
    data.selectedGroupVars ?? ["A"],
  );
  const [groupByLLM, setGroupByLLM] = useState(data.groupByLLM ?? "within");
  const [formatting, setFormatting] = useState(
    data.formatting ?? formattingOptions[0].value,
  );

  // Set and save a value to a state variable and also save it to the node's data
  const handleSetAndSave = <T,>(
    value: T,
    setter: React.Dispatch<React.SetStateAction<T>>,
    propName: string,
  ) => {
    setter(value);
    setDataPropsForNode(id, { [propName]: value as any });
  };

  /* ------------------------------------------------------------------ *
   *  Recursive helper – groups & joins by an ordered list of vars.
   * ------------------------------------------------------------------ */
  const groupAndJoinByVars = useCallback(
    (
      items: TemplateVarInfo[],
      varnames: string[],
      eatenvars: string[] = [],
    ): (TemplateVarInfo | string)[] => {
      if (items.length === 0) return [];
      if (varnames.length === 0) {
        /* Base‑case: no more vars to eat → just join texts */
        const joined_text = joinTexts(
          items.map((it) =>
            typeof it === "string" || typeof it === "number"
              ? StringLookup.get(it) ?? ""
              : StringLookup.get(it.text) ?? "",
          ),
          formatting,
        );
        const llm = countNumLLMs(items) === 1 ? items[0].llm : undefined;

        /* Preserve ONLY metadata common to all items in this bucket */
        const shared_meta: Dict = {};
        const shared_fill: Dict = {};
        const first = items.find((it) => typeof it !== "string");
        if (first && typeof first !== "string") {
          Object.assign(shared_meta, first.metavars ?? {});
          Object.assign(shared_fill, first.fill_history ?? {});
          items.forEach((it) => {
            if (typeof it === "string") return;
            Object.keys(shared_meta).forEach(
              (k) =>
                it.metavars?.[k] !== shared_meta[k] && delete shared_meta[k],
            );
            Object.keys(shared_fill).forEach(
              (k) =>
                it.fill_history?.[k] !== shared_fill[k] &&
                delete shared_fill[k],
            );
          });
        }
        return [
          {
            text: joined_text,
            fill_history: shared_fill,
            metavars: shared_meta,
            llm,
            uid: uuid(),
          },
        ];
      }

      /* Recursive case – group by the first remaining var */
      const cur = varnames[0];
      const isMeta = cur[0] === "M";
      const vname = cur.substring(1);
      const [groups, leftover] = groupResponsesBy(
        items,
        isMeta
          ? (r) =>
              r.metavars
                ? llmResponseDataToString(r.metavars[vname])
                : undefined
          : (r) =>
              r.fill_history
                ? llmResponseDataToString(r.fill_history[vname])
                : undefined,
      );

      const res: (TemplateVarInfo | string)[] = [];
      Object.entries(groups).forEach(([val, grp]) =>
        groupAndJoinByVars(grp, varnames.slice(1), [
          ...eatenvars,
          vname,
        ]).forEach((item) => {
          if (typeof item !== "string") {
            if (isMeta) item.metavars = { ...item.metavars, [vname]: val };
            else item.fill_history = { ...item.fill_history, [vname]: val };
            res.push(item);
          }
        }),
      );
      if (leftover.length > 0)
        res.push(
          ...groupAndJoinByVars(leftover, varnames.slice(1), [
            ...eatenvars,
            vname,
          ]),
        );
      return res;
    },
    [formatting],
  );

  /**
   * Pulls the attached input and refreshes the group-by dropdown from the
   * variables it carries. Kept apart from the join itself so that connecting a
   * node, or an upstream change, can keep the dropdown honest without quietly
   * producing output the user never asked for.
   */
  const refreshInputOptions = useCallback(() => {
    const input_data: LLMResponsesByVarDict = pullInputData(["__input"], id);
    if (!input_data?.__input) return null;

    // Find all vars and metavars in the input data (if any):
    const { vars, metavars } = getVarsAndMetavars(input_data);

    // Create lookup table for LLMs in input, indexed by llm key
    const llm_lookup = extractLLMLookup(input_data);

    // Refresh the dropdown list with available vars/metavars:
    handleSetAndSave(
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
      setGroupByVars,
      "groupByVars",
    );

    // Check whether more than one LLM is present in the inputs:
    const numLLMs = countNumLLMs(input_data);
    setInputHasLLMs(numLLMs > 1);

    return { input_data, llm_lookup, numLLMs };
  }, [pullInputData, id, handleSetAndSave]);

  const runJoin = useCallback(() => {
    const pulled = refreshInputOptions();
    if (pulled === null) {
      // Nothing attached yet; leave the node marked as not-yet-run.
      setStatus(Status.WARNING);
      return Promise.resolve(false);
    }
    const { llm_lookup, numLLMs } = pulled;
    setStatus(Status.LOADING);

    // Tag all response objects in the input data with a metavar for their LLM (using the llm key as a uid)
    const input_data = tagMetadataWithLLM(pulled.input_data);

    // Generate (flatten) the inputs, which could be recursively chained templates
    // and a mix of LLM resp objects, templates, and strings.
    // (We tagged each object with its LLM key so that we can use built-in features to keep track of the LLM associated with each response object)
    // Returned so a driver can wait for the join to finish writing its fields.
    // Joining is asynchronous, and a prompt node run straight after it would
    // otherwise read the previous join's output.
    return generatePrompts(
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
            (r) =>
              typeof r.llm === "string" || typeof r.llm === "number"
                ? StringLookup.get(r.llm)
                : r.llm?.key,
          );
          // eslint-disable-next-line
          Object.entries(groupedRespsByLLM).forEach(([_, llmGroup]) => {
            joined_texts = joined_texts.concat(
              groupAndJoinByVars(
                llmGroup,
                selectedGroupVars.filter((v) => v !== "A"),
              ),
            );
          });
          if (nonLLMRespGroup.length > 0)
            joined_texts.push(
              joinTexts(
                nonLLMRespGroup.map((t) => StringLookup.get(t.text) ?? ""),
                formatting,
              ),
            );
          setJoinedTexts(joined_texts);
          setDataPropsForNode(id, { fields: joined_texts });
        } else {
          // Join across LLMs (join irrespective of LLM):
          if (
            selectedGroupVars.length > 1 ||
            (selectedGroupVars.length === 1 && selectedGroupVars[0] !== "A")
          ) {
            const joined_texts = groupAndJoinByVars(
              resp_objs,
              selectedGroupVars.filter((v) => v !== "A"),
            );
            setJoinedTexts(joined_texts);
            setDataPropsForNode(id, { fields: joined_texts });
          } else {
            let joined_texts: string | TemplateVarInfo = joinTexts(
              resp_objs.map(
                (r) =>
                  (typeof r === "string" || typeof r === "number"
                    ? StringLookup.get(r)
                    : StringLookup.get(r.text)) ?? "",
              ),
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
        setStatus(Status.READY);
        return true;
      })
      .catch((err) => {
        console.error(err);
        setStatus(Status.ERROR);
        return false;
      });
  }, [
    formatting,
    refreshInputOptions,
    selectedGroupVars,
    groupByLLM,
    groupAndJoinByVars,
    id,
    setDataPropsForNode,
    setStatus,
  ]);

  // Lets a driver ("run all", a chat box over this flow) run this node without
  // a click. See backend/runGraph.ts.
  useNodeRunner(id, runnerFromStatus(runJoin, statusRef));

  if (data.input) {
    // A new input arrived: keep the group-by options honest, but leave the
    // join itself for the run button.
    if (data.input !== pastInputs) {
      setPastInputs(data.input);
      refreshInputOptions();
      setStatus(Status.WARNING);
    }
  }

  // Changing how to group or format doesn't re-join on its own: like the
  // evaluators, the node goes stale and waits to be run.
  useEffect(() => {
    if (joinedTexts.length > 0) setStatus(Status.WARNING);
  }, [selectedGroupVars, groupByLLM, formatting]);

  // Store the outputs to the cache whenever they change
  useEffect(() => {
    StorageCache.store(`${id}.json`, joinedTexts.map(toStandardResponseFormat));
  }, [joinedTexts]);

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      // An upstream node changed: this node's output is stale until it is run.
      setDataPropsForNode(id, { refresh: false });
      refreshInputOptions();
      setStatus(Status.WARNING);
    }
  }, [data, id, refreshInputOptions, setDataPropsForNode, setStatus]);

  return (
    <BaseNode classNames="join-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Join Node"}
        nodeId={id}
        icon={<IconArrowMerge size="12pt" />}
        status={status}
        handleRunClick={runJoin}
        runButtonTooltip="Join the input texts"
        customButtons={[
          <JoinedTextsPopover
            key="joined-text-previews"
            textInfos={joinedTexts}
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
        className="prompt-list-modal"
      >
        <Box m="lg" mt="xl">
          {displayJoinedTexts(joinedTexts, getColorForLLMAndSetIfNotFound)}
        </Box>
      </Modal>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "left",
          maxWidth: "100%",
          marginBottom: "10px",
        }}
      >
        <Text mb="xs">Group by (in order):</Text>
        <MultiSelect
          data={groupByVars}
          value={selectedGroupVars}
          onChange={(value) =>
            handleSetAndSave(value, setSelectedGroupVars, "selectedGroupVars")
          }
          className="nodrag nowheel"
          placeholder="Select grouping variables"
          size="xs"
          clearable
          searchable
          mb="sm"
          style={{ maxWidth: "200px" }}
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
            onChange={(e) =>
              handleSetAndSave(e.target.value, setGroupByLLM, "groupByLLM")
            }
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
        onChange={(e) =>
          handleSetAndSave(
            e.target.value as JoinFormat,
            setFormatting,
            "formatting",
          )
        }
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
        onConnect={() => setStatus(Status.WARNING)}
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
