import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  MouseEventHandler,
} from "react";
import { Handle, Node, Position } from "reactflow";
import {
  Textarea,
  Tooltip,
  Skeleton,
  ScrollArea,
  Image,
  AspectRatio,
} from "@mantine/core";
import {
  IconTextPlus,
  IconEye,
  IconEyeOff,
  IconTransform,
  IconUpload,
} from "@tabler/icons-react";
import useStore from "./store";
import NodeLabel from "./NodeLabelComponent";
import UploadFileModal, { UploadFileModalRef } from "./UploadFileModal";
import TemplateHooks, {
  extractBracketedSubstrings,
} from "./TemplateHooksComponent";
import BaseNode from "./BaseNode";
import {
  DebounceRef,
  genDebounceFunc,
  setsAreEqual,
  get_image_infos,
} from "./backend/utils";
import { Func, Dict } from "./backend/typing";
import { AIGenReplaceItemsPopover } from "./AiPopover";
import AISuggestionsManager from "./backend/aiSuggestionsManager";
import {
  ItemsNodeProps,
  makeSafeForCSLFormat,
  prepareItemsNodeData,
} from "./ItemsNode";

// Helper funcs
const union = (setA: Set<any>, setB: Set<any>) => {
  const _union = new Set(setA);
  for (const elem of setB) {
    _union.add(elem);
  }
  return _union;
};

const delButtonId = "del-";
const visibleButtonId = "eye-";
const uploadButtonId = "upload-";

// export interface Field_Content {
//   is_image: boolean;
//   content: string;
// }

// const create_text_field = (content: string): Field_Content => {
//   return { is_image: false, content };
// }

interface TextFieldsNodeData {
  vars?: string[];
  title?: string;
  text?: string;
  fields?: Dict<string>;
  fields_visibility?: Dict<boolean>;
  fields_is_image?: Dict<boolean>;
  refresh?: boolean;
}

export interface TextFieldsNodeProps {
  data: TextFieldsNodeData;
  id: string;
}

const TextFieldsNode: React.FC<TextFieldsNodeProps> = ({ data, id }) => {
  const [templateVars, setTemplateVars] = useState(data.vars || []);
  const duplicateNode = useStore((state) => state.duplicateNode);
  const addNode = useStore((state) => state.addNode);
  const removeNode = useStore((state) => state.removeNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const apiKeys = useStore((state) => state.apiKeys);
  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);
  const flags = useStore((state) => state.flags);

  const [textfieldsValues, setTextfieldsValues] = useState<Dict<string>>(
    data.fields ?? {},
  );
  const [fieldVisibility, setFieldVisibility] = useState<Dict<boolean>>(
    data.fields_visibility || {},
  );
  const [fieldIsImage, setFieldIsImage] = useState<Dict<boolean>>(
    data.fields_is_image || {},
  );

  // For when textfields exceed the TextFields Node max height,
  // when we add a new field, this gives us a way to scroll to the bottom. Better UX.
  const viewport = useRef<HTMLDivElement>(null);
  const scrollToBottom = () =>
    viewport?.current?.scrollTo({
      top: viewport.current.scrollHeight,
      behavior: "smooth",
    });

  // Whether the text fields should be in a loading state
  const [isLoading, setIsLoading] = useState(false);

  const [aiSuggestionsManager] = useState(
    new AISuggestionsManager(
      () => aiFeaturesProvider,
      // Do nothing when suggestions are simply updated because we are managing the placeholder state manually here.
      undefined,
      // When suggestions are refreshed, throw out existing placeholders.
      () => setPlaceholders({}),
      () => apiKeys,
    ),
  );

  // Placeholders to show in the textareas. Object keyed by textarea index.
  const [placeholders, setPlaceholders] = useState<Dict<string>>({});

  // Debounce helpers
  const debounceTimeoutRef: DebounceRef = useRef(null);
  const debounce: Func<Func> = genDebounceFunc(debounceTimeoutRef);

  const getUID = useCallback((textFields: Dict<string>) => {
    if (textFields) {
      return (
        "f" +
        (
          1 +
          Object.keys(textFields).reduce(
            (acc, key) => Math.max(acc, parseInt(key.slice(1))),
            0,
          )
        ).toString()
      );
    } else {
      return "f0";
    }
  }, []);

  // Handle delete text field.
  const handleDelete: MouseEventHandler<HTMLButtonElement> = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // Update the data for this text field's id.
      const new_fields = { ...textfieldsValues };
      const new_vis = { ...fieldVisibility };
      const new_imgs = { ...fieldIsImage };
      const item_id = (event.target as HTMLButtonElement).id.substring(
        delButtonId.length,
      );
      delete new_fields[item_id];
      delete new_vis[item_id];
      delete new_imgs[item_id];
      // if the new_data is empty, initialize it with one empty field
      if (Object.keys(new_fields).length === 0) {
        new_fields[getUID(textfieldsValues)] = "";
      }
      setTextfieldsValues(new_fields);
      setFieldVisibility(new_vis);
      setFieldIsImage(new_imgs);
      setDataPropsForNode(id, {
        fields: new_fields,
        fields_visibility: new_vis,
      });
      pingOutputNodes(id);
    },
    [
      textfieldsValues,
      fieldVisibility,
      id,
      delButtonId,
      setDataPropsForNode,
      pingOutputNodes,
    ],
  );

  // Initialize fields (run once at init)
  useEffect(() => {
    if (!textfieldsValues || Object.keys(textfieldsValues).length === 0) {
      const init_fields: Dict<string> = {};
      init_fields[getUID(textfieldsValues)] = "";
      setTextfieldsValues(init_fields);
      setDataPropsForNode(id, { fields: init_fields });
    }
  }, []);

  // Add a text field
  const handleAddField = useCallback(() => {
    const new_fields = { ...textfieldsValues };
    const new_uid = getUID(textfieldsValues);
    new_fields[new_uid] = "";

    // Initialize fields_is_image for the new field
    const new_imgs = { ...fieldIsImage };
    new_imgs[new_uid] = false;

    setTextfieldsValues(new_fields);
    setFieldIsImage(new_imgs);
    setDataPropsForNode(id, {
      fields: new_fields,
      fields_is_image: new_imgs,
    });
    pingOutputNodes(id);

    setTimeout(() => {
      scrollToBottom();
    }, 10);

    // Ping AI suggestions to generate autocomplete options
    if (flags.aiAutocomplete)
      aiSuggestionsManager.update(Object.values(textfieldsValues));
  }, [
    textfieldsValues,
    id,
    flags,
    setDataPropsForNode,
    pingOutputNodes,
    fieldIsImage,
  ]);

  // Disable/hide a text field temporarily
  const handleDisableField = useCallback(
    (field_id: string) => {
      const vis = { ...fieldVisibility };
      vis[field_id] = fieldVisibility[field_id] === false; // toggles it
      setFieldVisibility(vis);
      setDataPropsForNode(id, { fields_visibility: vis });
      pingOutputNodes(id);
    },
    [fieldVisibility, setDataPropsForNode, pingOutputNodes],
  );

  const updateTemplateVars = useCallback(
    (new_data: TextFieldsNodeData) => {
      // TODO: Optimize this check.
      let all_found_vars = new Set<string>();
      const new_field_ids = Object.keys(new_data.fields ?? {});
      new_field_ids.forEach((fid: string) => {
        const found_vars = extractBracketedSubstrings(
          (new_data.fields as Dict<string>)[fid],
        );
        if (found_vars && found_vars.length > 0) {
          all_found_vars = union(all_found_vars, new Set(found_vars));
        }
      });

      // Update template var fields + handles, if there's a change in sets
      const past_vars = new Set(templateVars);
      if (!setsAreEqual(all_found_vars, past_vars)) {
        const new_vars_arr = Array.from(all_found_vars);
        new_data.vars = new_vars_arr;
      }

      return new_data;
    },
    [templateVars],
  );

  // Save the state of a textfield when it changes and update hooks
  const handleTextFieldChange = useCallback(
    (field_id: string, val: string, shouldDebounce: boolean) => {
      // Update the value of the controlled Textarea component
      const new_fields = { ...textfieldsValues };

      // If this is an image field, ensure proper formatting
      if (fieldIsImage[field_id]) {
        new_fields[field_id] = val.replace(/%IMAGE%/g, ""); // Remove any existing %IMAGE% prefix
      } else {
        new_fields[field_id] = val;
      }

      setTextfieldsValues(new_fields);

      // Update the data for the ReactFlow node
      const new_data = updateTemplateVars({ fields: new_fields });
      if (new_data.vars) setTemplateVars(new_data.vars);

      // Debounce the global state change
      debounce(
        (_id: string, _new_data: TextFieldsNodeData) => {
          setDataPropsForNode(_id, _new_data as Dict);
          pingOutputNodes(_id);
        },
        shouldDebounce ? 300 : 1,
      )(id, new_data);
    },
    [
      textfieldsValues,
      setTextfieldsValues,
      templateVars,
      updateTemplateVars,
      setTemplateVars,
      pingOutputNodes,
      setDataPropsForNode,
      id,
      fieldIsImage,
    ],
  );

  // Dynamically update the textareas and position of the template hooks
  const ref = useRef<HTMLDivElement | null>(null);
  const [hooksY, setHooksY] = useState(120);
  useEffect(() => {
    const node_height = ref?.current?.clientHeight ?? 0;
    setHooksY(node_height + 68);
  }, [textfieldsValues]);

  const setRef = useCallback(
    (elem: HTMLDivElement) => {
      // To listen for resize events of the textarea, we need to use a ResizeObserver.
      // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div wrapping textfields.
      // NOTE: This won't work on older browsers, but there's no alternative solution.
      if (!ref.current && elem && window.ResizeObserver) {
        let past_hooks_y = 120;
        const observer = new window.ResizeObserver(() => {
          if (!ref || !ref.current) return;
          const new_hooks_y = ref.current.clientHeight + 68;
          if (past_hooks_y !== new_hooks_y) {
            setHooksY(new_hooks_y);
            past_hooks_y = new_hooks_y;
          }
        });

        observer.observe(elem);
        ref.current = elem;
      }
    },
    [ref],
  );

  // Pass upstream changes down to later nodes in the chain
  const refresh = useMemo(() => data.refresh, [data.refresh]);
  useEffect(() => {
    if (refresh === true) {
      pingOutputNodes(id);
      setDataPropsForNode(id, { refresh: false });
    }
  }, [refresh]);

  // Handle keydown events for the text fields
  const handleTextAreaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    placeholder: string,
    fieldIdx: string,
  ) => {
    // Insert the AI suggested text if:
    // (1) the user presses the Tab key
    // (2) the user has not typed anything in the textarea
    // (3) the suggestions are loaded
    if (
      event.key === "Tab" &&
      textfieldsValues[fieldIdx] === "" &&
      !aiSuggestionsManager.areSuggestionsLoading()
    ) {
      event.preventDefault();
      // Insert the suggestion corresponding to the text field that was tabbed into by index.
      aiSuggestionsManager.removeSuggestion(placeholder);
      handleTextFieldChange(fieldIdx, placeholder, false);
    }
  };

  // Add the entire list of `fields` to `textfieldsValues`
  function addMultipleFields(strs: string[]) {
    // Unpack the object to force a re-render
    const buffer = { ...textfieldsValues };
    for (const field of strs) {
      const uid = getUID(buffer);
      buffer[uid] = field;
    }
    setTextfieldsValues(buffer);
    setDataPropsForNode(id, { fields: buffer });
    pingOutputNodes(id);
  }

  // Replace the entirety of `textfieldValues` with `new_vals`
  const replaceFields = useCallback(
    (new_vals: string[]) => {
      const buffer: Dict<string> = {};
      for (const field of new_vals) {
        const uid = getUID(buffer);
        buffer[uid] = field;
      }
      setTextfieldsValues(buffer);
      const new_data = updateTemplateVars({ fields: buffer });
      if (new_data.vars !== undefined) setTemplateVars(new_data.vars);
      setDataPropsForNode(id, new_data as Dict);
      pingOutputNodes(id);
    },
    [
      updateTemplateVars,
      setTextfieldsValues,
      getUID,
      setTemplateVars,
      setDataPropsForNode,
      pingOutputNodes,
      id,
    ],
  );

  // Whether a placeholder is needed for the text field with id `i`.
  function placeholderNeeded(i: string) {
    return !textfieldsValues[i] && !placeholders[i] && flags.aiAutocomplete;
  }

  // Load a placeholder into placeholders for the text field with id `i` if needed.
  function loadPlaceholderIfNeeded(i: string) {
    if (placeholderNeeded(i) && !aiSuggestionsManager.areSuggestionsLoading()) {
      placeholders[i] = aiSuggestionsManager.popSuggestion();
    }
  }

  // Upload File button mechanisms
  const uploadFileModal = useRef<UploadFileModalRef>(null);
  const [uploadFileInitialVal, setUploadFileInitialVal] = useState<string>("");

  // Disable/hide a text field temporarily
  const openUploadFileModal = useCallback(
    (field_id: string) => {
      setUploadFileInitialVal(field_id);
      if (uploadFileModal && uploadFileModal.current)
        uploadFileModal.current.open();
    },
    [uploadFileModal],
  );

  const handleUploadFile = useCallback(
    (new_text: string) => {
      if (typeof uploadFileInitialVal !== "string") {
        console.error("Initial column value was not set.");
        return;
      }
      // Clean the URL first by removing any existing %IMAGE% prefix
      const cleanUrl = new_text.replace(/%IMAGE%/g, "");

      const new_fields = { ...textfieldsValues };
      new_fields[uploadFileInitialVal] = cleanUrl;

      const imgs = { ...fieldIsImage };
      imgs[uploadFileInitialVal] = true;
      setFieldIsImage(imgs);
      setTextfieldsValues(new_fields);
      setDataPropsForNode(id, {
        fields: new_fields,
        fields_is_image: imgs,
      });
      pingOutputNodes(id);
    },
    [
      textfieldsValues,
      pingOutputNodes,
      setDataPropsForNode,
      id,
      uploadFileInitialVal,
    ],
  );

  // Cache the rendering of the text fields.
  const textFields = useMemo(
    () =>
      Object.keys(textfieldsValues).map((i) => {
        loadPlaceholderIfNeeded(i);
        const placeholder = placeholders[i];
        return (
          <div className="input-field" key={i}>
            <Textarea
              id={i}
              name={i}
              className="text-field-fixed nodrag nowheel"
              autosize
              minRows={2}
              maxRows={8}
              value={textfieldsValues[i]}
              placeholder={flags.aiAutocomplete ? placeholder : undefined}
              disabled={fieldVisibility[i] === false}
              onChange={(event) =>
                handleTextFieldChange(i, event.currentTarget.value, true)
              }
              onKeyDown={(event) =>
                handleTextAreaKeyDown(event, placeholder, i)
              }
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              {Object.keys(textfieldsValues).length > 1 ? (
                <>
                  <Tooltip
                    label="remove field"
                    position="right"
                    withArrow
                    arrowSize={10}
                    withinPortal
                  >
                    <button
                      id={delButtonId + i}
                      className="remove-text-field-btn nodrag"
                      onClick={handleDelete}
                      style={{ flex: 1 }}
                    >
                      X
                    </button>
                  </Tooltip>
                  <Tooltip
                    label={
                      (fieldVisibility[i] === false ? "enable" : "disable") +
                      " field"
                    }
                    position="right"
                    withArrow
                    arrowSize={10}
                    withinPortal
                  >
                    <button
                      id={visibleButtonId + i}
                      className="remove-text-field-btn nodrag"
                      onClick={() => handleDisableField(i)}
                      style={{ flex: 1 }}
                    >
                      {fieldVisibility[i] === false ? (
                        <IconEyeOff size="14pt" pointerEvents="none" />
                      ) : (
                        <IconEye size="14pt" pointerEvents="none" />
                      )}
                    </button>
                  </Tooltip>
                </>
              ) : (
                <></>
              )}

              <Tooltip
                label="Upload Text/Image File "
                position="right"
                withArrow
                arrowSize={10}
                withinPortal
              >
                <button
                  id={uploadButtonId + i}
                  className="remove-text-field-btn nodrag"
                  onClick={() => openUploadFileModal(i)}
                  style={{ flex: 1 }}
                >
                  <IconUpload size="14pt" pointerEvents="none" />
                </button>
              </Tooltip>
            </div>
            {fieldIsImage[i] ? (
              <Tooltip
                multiline={true}
                label={JSON.stringify(get_image_infos(textfieldsValues[i]))}
              >
                <div
                  style={{ width: 50, marginLeft: "auto", marginRight: "auto" }}
                >
                  <Image
                    src={
                      textfieldsValues[i].startsWith("http")
                        ? textfieldsValues[i]
                        : "" // TODO : handle local file case
                    }
                    radius={"lg"}
                  />
                </div>
              </Tooltip>
            ) : (
              <></>
            )}
          </div>
        );
      }),
    // Update the text fields only when their values, placeholders, or visibility changes.
    [textfieldsValues, placeholders, fieldVisibility],
  );

  // Add custom context menu options on right-click.
  // 1. Convert TextFields to Items Node, for convenience.
  const customContextMenuItems = useMemo(
    () => [
      {
        key: "to_item_node",
        icon: <IconTransform size="11pt" />,
        text: "To Items Node",
        onClick: () => {
          // Convert the fields of this node into Items Node CSL format:
          const csl_fields =
            Object.values(textfieldsValues).map(makeSafeForCSLFormat);
          const text = csl_fields.join(", ");
          // Duplicate this TextFields node
          const dup = duplicateNode(id) as Node;
          // Swap the data for new data:
          const items_node_data: ItemsNodeProps["data"] = {
            title: dup.data.title,
            text,
            fields: prepareItemsNodeData(text).fields,
          };
          // Add the duplicated node, with correct type:
          addNode({
            ...dup,
            id: `csvNode-${Date.now()}`,
            type: `csv`,
            data: items_node_data,
          });
          // Remove the current TF node on redraw:
          removeNode(id);
        },
      },
    ],
    [id, textfieldsValues],
  );

  return (
    <BaseNode
      classNames="text-fields-node"
      nodeId={id}
      contextMenuExts={customContextMenuItems}
    >
      <NodeLabel
        title={data.title ?? "TextFields Node"}
        nodeId={id}
        icon={<IconTextPlus size="16px" />}
        customButtons={
          flags.aiSupport
            ? [
                <AIGenReplaceItemsPopover
                  key="ai-popover"
                  values={textfieldsValues}
                  onAddValues={addMultipleFields}
                  onReplaceValues={replaceFields}
                  areValuesLoading={isLoading}
                  setValuesLoading={setIsLoading}
                />,
              ]
            : []
        }
      />

      <UploadFileModal
        ref={uploadFileModal}
        title="Upload Text/Image File "
        label="Provide a remote URL pointing to an image"
        onSubmit={handleUploadFile}
      />

      <Skeleton visible={isLoading}>
        <div ref={setRef} className="nodrag nowheel">
          <ScrollArea.Autosize mah={580} type="hover" viewportRef={viewport}>
            {textFields}
          </ScrollArea.Autosize>
        </div>
      </Skeleton>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="grouped-handle"
        style={{ top: "50%" }}
      />
      <TemplateHooks
        vars={templateVars}
        nodeId={id}
        startY={hooksY}
        position={Position.Left}
      />
      <div className="add-text-field-btn">
        <button onClick={handleAddField}>+</button>
      </div>
    </BaseNode>
  );
};

export default TextFieldsNode;
