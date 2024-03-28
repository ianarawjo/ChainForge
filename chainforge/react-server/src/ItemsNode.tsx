import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  KeyboardEventHandler,
  useMemo,
} from "react";
import { Skeleton, Text } from "@mantine/core";
import useStore from "./store";
import NodeLabel from "./NodeLabelComponent";
import { IconForms, IconTransform } from "@tabler/icons-react";
import { Handle, Node, Position } from "reactflow";
import BaseNode from "./BaseNode";
import { DebounceRef, genDebounceFunc, processCSV } from "./backend/utils";
import { AIGenReplaceItemsPopover } from "./AiPopover";
import { cleanEscapedBraces, escapeBraces } from "./backend/template";
import { TextFieldsNodeProps } from "./TextFieldsNode";

const replaceDoubleQuotesWithSingle = (str: string) => str.replaceAll('"', "'");
const wrapInQuotesIfContainsComma = (str: string) =>
  str.includes(",") ? `"${str}"` : str;
export const makeSafeForCSLFormat = (str: string) =>
  wrapInQuotesIfContainsComma(replaceDoubleQuotesWithSingle(str));
const stripWrappingQuotes = (str: string) => {
  if (
    typeof str === "string" &&
    str.length >= 2 &&
    str.charAt(0) === '"' &&
    str.charAt(str.length - 1) === '"'
  )
    return str.substring(1, str.length - 1);
  else return str;
};
export const prepareItemsNodeData = (text: string) => ({
  text,
  fields: processCSV(text).map(stripWrappingQuotes).map(escapeBraces),
});

export interface ItemsNodeProps {
  data: {
    title?: string;
    text?: string;
    fields?: string[];
  };
  id: string;
}

const ItemsNode: React.FC<ItemsNodeProps> = ({ data, id }) => {
  const duplicateNode = useStore((state) => state.duplicateNode);
  const addNode = useStore((state) => state.addNode);
  const removeNode = useStore((state) => state.removeNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const flags = useStore((state) => state.flags);

  const [contentDiv, setContentDiv] = useState<React.ReactNode | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [csvInput, setCsvInput] = useState<React.ReactNode | null>(null);
  const [countText, setCountText] = useState<React.ReactNode | null>(null);

  // Whether text field is in a loading state
  const [isLoading, setIsLoading] = useState(false);

  // Debounce helpers
  const debounceTimeoutRef: DebounceRef = useRef(null);
  const debounce = genDebounceFunc(debounceTimeoutRef);

  // initializing
  useEffect(() => {
    if (!data.fields) {
      setDataPropsForNode(id, { text: "", fields: [] });
    }
  }, []);

  // Handle a change in a text fields' input.
  const setFieldsFromText = useCallback(
    (text_val: string, no_debounce: boolean) => {
      const _update = (_text_val: string) => {
        // Update the data for this text fields' id.
        const new_data = prepareItemsNodeData(_text_val);
        setDataPropsForNode(id, new_data);
        pingOutputNodes(id);
      };

      // Debounce the state change to only run 300 ms after the edit
      if (no_debounce) _update(text_val);
      else debounce(_update, 300)(text_val);
    },
    [id, pingOutputNodes, setDataPropsForNode],
  );

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && data.text && data.text.trim().length > 0) {
        setIsEditing(false);
        setCsvInput(null);
      }
    },
    [],
  );

  // handling Div Click
  const handleDivOnClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleOnBlur = useCallback(() => {
    if (data.text && data.text.trim().length > 0) setIsEditing(false);
  }, [data.text]);

  // render csv div
  const renderCsvDiv = useCallback(() => {
    // Take the data.text as csv (only 1 row), and get individual elements
    const elements = data.fields ?? [];

    // generate a HTML code that highlights the elements
    const html: JSX.Element[] = [];
    elements.forEach((e, idx) => {
      // html.push(<Badge color="orange" size="lg" radius="sm">{e}</Badge>)
      html.push(
        <span key={idx} className="csv-element">
          {cleanEscapedBraces(e)}
        </span>,
      );
      if (idx < elements.length - 1) {
        html.push(
          <span key={idx + "comma"} className="csv-comma">
            ,
          </span>,
        );
      }
    });

    setContentDiv(
      <div className="csv-div nowheel" onClick={handleDivOnClick}>
        {html}
      </div>,
    );
    setCountText(
      <Text size="xs" style={{ marginTop: "5px" }} color="gray" align="right">
        {elements.length} elements
      </Text>,
    );
  }, [data, handleDivOnClick]);

  // When isEditing changes, add input
  useEffect(() => {
    if (!isEditing && data.text && data.text.trim().length > 0) {
      setCsvInput(null);
      renderCsvDiv();
      return;
    }

    const text_val = data.text || "";
    setCsvInput(
      <div className="input-field" key={id}>
        <textarea
          id={id}
          name={id}
          className="text-field-fixed nodrag csv-input"
          rows={2}
          cols={40}
          defaultValue={text_val}
          placeholder="Put your comma-separated list here"
          onKeyDown={handleKeyDown}
          onChange={(event) => setFieldsFromText(event.target.value, false)}
          onBlur={handleOnBlur}
          autoFocus={true}
        />
      </div>,
    );
    setContentDiv(null);
    setCountText(null);
  }, [isEditing, setFieldsFromText, handleOnBlur, handleKeyDown]);

  // when data.text changes, update the content div
  useEffect(() => {
    // When in editing mode, don't update the content div
    if (isEditing || !data.text) return;

    renderCsvDiv();
  }, [id, data]);

  // Add custom context menu options on right-click.
  // 1. Convert Items Node to TextFields, for convenience.
  const customContextMenuItems = useMemo(
    () => [
      {
        key: "to_tf_node",
        icon: <IconTransform size="11pt" />,
        text: "To TextFields Node",
        onClick: () => {
          if (!data.fields) return;
          // Convert the fields of this node into TextFields Node format:
          const textfields = data.fields.reduce<Record<string, string>>(
            (acc, curr, idx) => {
              acc[`f${idx}`] = curr;
              return acc;
            },
            {},
          );
          // Duplicate this Items Node
          const dup = duplicateNode(id) as Node;
          // Swap the data for new data:
          const tf_node_data: TextFieldsNodeProps["data"] = {
            title: dup.data.title,
            fields: textfields,
          };
          // Add the duplicated node, with correct type:
          addNode({
            ...dup,
            id: `textFieldsNode-${Date.now()}`,
            type: `textfields`,
            data: tf_node_data,
          });
          // Remove the current Items Node on redraw:
          removeNode(id);
        },
      },
    ],
    [id, data.fields],
  );

  return (
    <BaseNode
      classNames="text-fields-node"
      nodeId={id}
      contextMenuExts={customContextMenuItems}
    >
      <NodeLabel
        title={data.title || "Items Node"}
        nodeId={id}
        icon={<IconForms size="16px" />}
        customButtons={
          flags.aiSupport
            ? [
                <AIGenReplaceItemsPopover
                  key="ai-popover"
                  values={data.fields ?? []}
                  onAddValues={(vals: string[]) =>
                    setFieldsFromText(
                      data.text +
                        ", " +
                        vals.map(makeSafeForCSLFormat).join(", "),
                      true,
                    )
                  }
                  onReplaceValues={(vals: string[]) =>
                    setFieldsFromText(
                      vals.map(makeSafeForCSLFormat).join(", "),
                      true,
                    )
                  }
                  areValuesLoading={isLoading}
                  setValuesLoading={setIsLoading}
                />,
              ]
            : []
        }
      />
      <Skeleton visible={isLoading}>
        {csvInput}
        {contentDiv}
        {countText}
      </Skeleton>
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

export default ItemsNode;
