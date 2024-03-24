import React, { useState, useEffect, useCallback } from "react";
import { Handle, Position } from "reactflow";
import { v4 as uuid } from "uuid";
import useStore from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { IconArrowsSplit, IconList } from "@tabler/icons-react";
import {
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
  processCSV,
  deepcopy,
  deepcopy_and_modify,
  dict_excluding_key,
  toStandardResponseFormat,
  tagMetadataWithLLM,
  extractLLMLookup,
  removeLLMTagFromMetadata,
} from "./backend/utils";

import { fromMarkdown } from "mdast-util-from-markdown";
import StorageCache from "./backend/cache";
import { ResponseBox } from "./ResponseBoxes";
import { Root, RootContent } from "mdast";
import { Dict, TemplateVarInfo } from "./backend/typing";
import { generatePrompts } from "./backend/backend";

const formattingOptions = [
  { value: "list", label: "- list items" },
  { value: "\n", label: "newline \\n" },
  { value: "\n\n", label: "double newline \\n\\n" },
  { value: ",", label: "commas (,)" },
  { value: "code", label: "code blocks" },
  { value: "paragraph", label: "paragraphs (md)" },
];

/** Flattens markdown AST as dict to text (string) */
function compileTextFromMdAST(md: Root | RootContent): string {
  if (md === undefined) return "";
  else if ("value" in md) return typeof md.value === "string" ? md.value : "";
  else if ("children" in md && md.children?.length > 0)
    return md.children.map(compileTextFromMdAST).join("");
  return "";
}

export const splitText = (
  s: string,
  format: string,
  shouldEscapeBraces: boolean,
) => {
  const _escapeBraces = shouldEscapeBraces ? escapeBraces : (x: string) => x;

  // If format is newline separators, we can just split:
  if (format === "\n\n" || format === "\n")
    return s
      .split(format)
      .map((s) => _escapeBraces(s.trim()))
      .filter((s) => s.length > 0);
  else if (format === ",")
    return processCSV(s)
      .map((s) => _escapeBraces(s))
      .filter((s) => s.length > 0);

  // Other formatting rules require markdown parsing:
  // Parse string as markdown
  const md = fromMarkdown(s);
  let results: string[] = [];

  const extract_md_blocks = (block_type: string) => {
    if (
      md?.children.length > 0 &&
      md.children.some((c) => c.type === block_type)
    ) {
      // Find the relevant block(s) that appear in the markdown text, at the root level:
      const md_blocks = md.children.filter((c) => c.type === block_type);
      for (const md_block of md_blocks) {
        if (block_type === "list") {
          // Extract the list items, flattening the ASTs to text
          const items = "children" in md_block ? md_block.children : [];
          for (const item of items) {
            const text = compileTextFromMdAST(item).trim();
            results.push(text);
          }
        } else if ("children" in md_block) {
          results.push(compileTextFromMdAST(md_block).trim());
        }
        if ("value" in md_block) results.push(md_block.value);
      }
    }
  };

  extract_md_blocks(format);
  results = results.filter((s) => s.length > 0).map(_escapeBraces);

  // NOTE: It is possible to have an empty [] results after split.
  // This happens if the splitter is a markdown separator, and none were found in the input(s).
  return results;
};

const displaySplitTexts = (
  textInfos: (TemplateVarInfo | string)[],
  getColorForLLM: (llm_name: string) => string,
) => {
  const color_for_llm = (llm_name: string) => getColorForLLM(llm_name) + "99";
  return textInfos.map((info, idx) => {
    const text = typeof info === "string" ? info : info.text;
    const ps = <pre className="small-response">{text}</pre>;
    if (typeof info === "string") {
      return (
        <ResponseBox
          key={"r" + idx}
          boxColor="#ddd"
          width="100%"
          vars={{}}
          truncLenForVars={72}
          llmName=""
        >
          {ps}
        </ResponseBox>
      );
    } else {
      const llm_color =
        typeof info.llm === "object" && "name" in info.llm
          ? color_for_llm(info.llm?.name)
          : "#ddd";
      const llm_name =
        typeof info.llm === "object" && "name" in info.llm
          ? info.llm?.name
          : "";
      return (
        <ResponseBox
          key={"r" + idx}
          boxColor={llm_color}
          width="100%"
          vars={info.fill_history ?? {}}
          truncLenForVars={72}
          llmName={llm_name}
        >
          {ps}
        </ResponseBox>
      );
    }
  });
};

export interface SplitTextsPopoverProps {
  textInfos: (TemplateVarInfo | string)[];
  onHover: () => void;
  onClick: (evt: React.MouseEvent<HTMLButtonElement>) => void;
  getColorForLLM: (llm_name: string) => string;
}

const SplitTextsPopover: React.FC<SplitTextsPopoverProps> = ({
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
        <Tooltip label="Click to view all split inputs" withArrow>
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
            Preview of split inputs ({textInfos?.length} total)
          </Text>
        </Center>
        {displaySplitTexts(textInfos, getColorForLLM)}
      </Popover.Dropdown>
    </Popover>
  );
};

export interface SplitNodeProps {
  data: {
    title: string;
    splitFormat: string;
    refresh: boolean;
  };
  id: string;
}

const SplitNode: React.FC<SplitNodeProps> = ({ data, id }) => {
  const [splitTexts, setSplitTexts] = useState<(TemplateVarInfo | string)[]>(
    [],
  );

  // For an info pop-up that previews all the joined inputs
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] =
    useDisclosure(false);

  const pullInputData = useStore((state) => state.pullInputData);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore(
    (state) => state.getColorForLLMAndSetIfNotFound,
  );

  const [splitOnFormat, setSplitOnFormat] = useState(
    data.splitFormat || "list",
  );

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
    input_data = tagMetadataWithLLM(input_data) as Dict<
      string[] | TemplateVarInfo[]
    >;

    // Generate (flatten) the inputs, which could be recursively chained templates
    // and a mix of LLM resp objects, templates, and strings.
    // (We tagged each object with its LLM key so that we can use built-in features to keep track of the LLM associated with each response object)
    generatePrompts("{__input}", input_data)
      .then((promptTemplates) => {
        // Convert the templates into response objects
        const resp_objs = promptTemplates.map((p) => ({
          text: p.toString(),
          fill_history: dict_excluding_key(p.fill_history, "__input"),
          llm:
            "__LLM_key" in p.metavars
              ? llm_lookup[p.metavars.__LLM_key]
              : undefined,
          metavars: removeLLMTagFromMetadata(p.metavars),
          uid: uuid(),
        }));

        // The naive splitter is just to look at every
        // response object's text value, and split that into N objects
        // that have the exact same properties except for their text values.
        const split_objs: (TemplateVarInfo | string)[] = resp_objs
          .map((resp_obj: TemplateVarInfo | string) => {
            if (typeof resp_obj === "string")
              return splitText(resp_obj, formatting, true);
            const texts = splitText(resp_obj?.text ?? "", formatting, true);
            if (texts !== undefined && texts.length >= 1)
              return texts.map(
                (t: string) =>
                  deepcopy_and_modify(resp_obj, { text: t }) as TemplateVarInfo,
              );
            else if (texts?.length === 0) return [];
            else return deepcopy(resp_obj) as TemplateVarInfo;
          })
          .flat(); // flatten the split response objects

        setSplitTexts(split_objs);
        setDataPropsForNode(id, { fields: split_objs });
      })
      .catch((err: Error | string) => {
        console.error(err);
      });
  }, [
    pullInputData,
    splitOnFormat,
    splitText,
    extractLLMLookup,
    tagMetadataWithLLM,
  ]);

  // Refresh split output anytime the dropdown changes
  useEffect(() => {
    handleOnConnect();
  }, [splitOnFormat]);

  // Store the outputs to the cache whenever they change
  useEffect(() => {
    StorageCache.store(
      `${id}.json`,
      splitTexts.map((r) => {
        if (typeof r === "string") return r;
        return toStandardResponseFormat(r);
      }),
    );
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
      <NodeLabel
        title={data.title || "Split Node"}
        nodeId={id}
        icon={<IconArrowsSplit size="12pt" />}
        customButtons={[
          <SplitTextsPopover
            key="split-text-previews"
            textInfos={splitTexts}
            onHover={handleOnConnect}
            onClick={openInfoModal}
            getColorForLLM={getColorForLLMAndSetIfNotFound}
          />,
        ]}
      />
      <Modal
        title={"List of split inputs (" + splitTexts.length + " total)"}
        size="xl"
        opened={infoModalOpened}
        onClose={closeInfoModal}
        styles={{
          header: { backgroundColor: "#FFD700" },
          root: { position: "relative", left: "-5%" },
        }}
      >
        <Box m="lg" mt="xl">
          {displaySplitTexts(splitTexts, getColorForLLMAndSetIfNotFound)}
        </Box>
      </Modal>
      <NativeSelect
        onChange={(e) => {
          setSplitOnFormat(e.target.value);
          setDataPropsForNode(id, { splitFormat: e.target.value });
        }}
        className="nowheel"
        label={"Split on"}
        data={formattingOptions}
        size="xs"
        value={splitOnFormat}
        miw="80px"
        mr="xs"
        mt="-6px"
      />
      {!(splitOnFormat?.length <= 2) ? (
        <Text color="gray" size="8pt" mt="xs" maw="150px">
          All other parts of the input text will be ignored.
        </Text>
      ) : (
        <></>
      )}
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

export default SplitNode;
