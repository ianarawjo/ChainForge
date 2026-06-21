import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  MouseEventHandler,
} from "react";
import { Handle, Node, Position } from "reactflow";
import { Textarea, Tooltip, Skeleton, ScrollArea, Loader } from "@mantine/core";
import {
  IconTextPlus,
  IconEye,
  IconEyeOff,
  IconTransform,
} from "@tabler/icons-react";
import useStore from "./store";
import NodeLabel from "./NodeLabelComponent";
import TemplateHooks, {
  extractBracketedSubstrings,
} from "./TemplateHooksComponent";
import BaseNode from "./BaseNode";
import { DebounceRef, genDebounceFunc, setsAreEqual } from "./backend/utils";
import { Func, Dict } from "./backend/typing";
import { AIGenReplaceItemsPopover } from "./AiPopover";
import AISuggestionsManager from "./backend/aiSuggestionsManager";
import {
  ItemsNodeProps,
  makeSafeForCSLFormat,
  prepareItemsNodeData,
} from "./ItemsNode";
import { useMarkerLogic } from "./backend/useSelectionText";
import MarkerPopover from "./DraggablePopover";

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

interface TextFieldsNodeData {
  vars?: string[];
  title?: string;
  text?: string;
  fields?: Dict<string>;
  fields_visibility?: Dict<boolean>;
  refresh?: boolean;
}

export interface TextFieldsNodeProps {
  data: TextFieldsNodeData;
  id: string;
}

const TextFieldsNode: React.FC<TextFieldsNodeProps> = ({ data, id }) => {
  const [templateVars, setTemplateVars] = useState(
    Array.isArray(data.vars) ? data.vars : [],
  );
  const duplicateNode = useStore((state) => state.duplicateNode);
  const addNode = useStore((state) => state.addNode);
  const removeNode = useStore((state) => state.removeNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const apiKeys = useStore((state) => state.apiKeys);
  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);
  const flags = useStore((state) => state.globalSettings);

  const [textfieldsValues, setTextfieldsValues] = useState<Dict<string>>(
    data.fields ?? {},
  );
  const [fieldVisibility, setFieldVisibility] = useState<Dict<boolean>>(
    data.fields_visibility || {},
  );
  useEffect(() => {
    if (data.fields) {
      setTextfieldsValues(data.fields);
    }
    if (data.fields_visibility) {
      setFieldVisibility(data.fields_visibility);
    }
  }, [data.fields, data.fields_visibility]);

  const nodeRef = useRef<HTMLDivElement>(null);

  const markerLogic = useMarkerLogic({
    nodeId: id,
    isPromptNode: false,
    fieldValues: textfieldsValues,
    templateVars,
    onFieldChange: (fieldId: string, value: string) => {
      handleTextFieldChange(fieldId, value, true);
    },
    onTemplateVarsChange: setTemplateVars,
    onDataUpdate: (data: any) => {
      setDataPropsForNode(id, data);
      pingOutputNodes(id);
    },
    findNodeByParam: (tfNodeId: string, param: string) => {
      const rf = useStore.getState();
      const edge = rf.edges.find(
        (e: any) => e.target === tfNodeId && e.targetHandle === param,
      );
      if (!edge) return undefined;
      return (rf.nodes as Node[]).find((n) => n.id === edge.source);
    },
  });

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
  // Whether we are waiting for LLM to generate the prompts
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    setSuggestionsLoading(aiSuggestionsManager.areSuggestionsLoading());
  });
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
      const item_id = (event.target as HTMLButtonElement).id.substring(
        delButtonId.length,
      );
      delete new_fields[item_id];
      delete new_vis[item_id];
      // if the new_data is empty, initialize it with one empty field
      if (Object.keys(new_fields).length === 0) {
        new_fields[getUID(textfieldsValues)] = "";
      }
      setTextfieldsValues(new_fields);
      setFieldVisibility(new_vis);
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
    new_fields[getUID(textfieldsValues)] = "";
    setTextfieldsValues(new_fields);
    setDataPropsForNode(id, { fields: new_fields });
    pingOutputNodes(id);

    setTimeout(() => {
      scrollToBottom();
    }, 10);

    // Cycle suggestions when new field is created
    // aiSuggestionsManager.cycleSuggestions();

    // Ping AI suggestions to generate autocomplete options
    if (flags.aiAutocomplete)
      aiSuggestionsManager.update(Object.values(textfieldsValues));
  }, [textfieldsValues, id, flags, setDataPropsForNode, pingOutputNodes]);

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

  const [textSelection, setTextSelection] = useState<{
    start: number;
    end: number;
    id: string;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const [contextDraft, setContextDraft] = useState("");

  const [markerSet, setMarkerSet] = useState<Set<string>>(
    new Set(Array.isArray(data.vars) ? data.vars : []),
  );

  const clean = (s: string) =>
    s.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();

  const [markerList, setMarkerList] = useState<string[]>(
    (Array.isArray(data.vars) ? data.vars : []).map(clean),
  );

  const stripLooseBraces = (txt: string) => txt.replace(/[{}]/g, "").trim();

  const [paramContexts, setParamContexts] = useState<Record<string, string>>(
    {},
  );

  const detectParameter = useCallback(
    (textSelection: any, textfieldsValues: any, markerSet: Set<string>) => {
      if (!textSelection) return null;

      const { start, end, id: fieldId } = textSelection;
      const full = textfieldsValues[fieldId] ?? "";
      const slice = full.slice(start, end);
      const raw = stripLooseBraces(slice).trim();

      let param: string | null = null;

      // Case 1: Exact match with a bracketed parameter like "{ice}"
      const inside = extractBracketedSubstrings(slice);
      if (inside.length === 1 && `{${inside[0]}}` === slice) {
        param = inside[0];
      }
      // Case 2: Raw text matches a known marker like "ice"
      else if (markerSet.has(raw)) {
        param = raw;
      }
      // Case 3: Selection is inside a larger bracketed parameter
      else {
        const allBracketedParams = extractBracketedSubstrings(full) || [];

        for (const bracketedParam of allBracketedParams) {
          const bracketedSpan = `{${bracketedParam}}`;
          let searchStart = 0;
          let bracketedIndex = full.indexOf(bracketedSpan, searchStart);

          while (bracketedIndex !== -1) {
            const bracketedStart = bracketedIndex;
            const bracketedEnd = bracketedIndex + bracketedSpan.length;

            if (start >= bracketedStart && end <= bracketedEnd) {
              if (slice !== bracketedSpan) {
                param = bracketedParam;
                break;
              }
            }

            searchStart = bracketedIndex + 1;
            bracketedIndex = full.indexOf(bracketedSpan, searchStart);
          }

          if (param) break;
        }
      }

      return param;
    },
    [],
  );

  const [currentLoadedParam, setCurrentLoadedParam] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!textSelection) {
      // Only reset when selection is completely cleared
      setCurrentLoadedParam(null);
      setContextDraft("");
      return;
    }

    const detectedParam = detectParameter(
      textSelection,
      textfieldsValues,
      markerSet,
    );

    const selectedText = textfieldsValues[textSelection.id]
      ?.slice(textSelection.start, textSelection.end)
      ?.trim();
    const potentialParam = selectedText?.replace(/[{}]/g, "").trim();

    const workingParam = detectedParam || potentialParam;

    // Only update context when we're working with a different parameter
    if (workingParam !== currentLoadedParam) {
      setCurrentLoadedParam(workingParam);

      if (workingParam) {
        // Load saved context for this parameter
        const savedContext = paramContexts[workingParam] || "";
        setContextDraft(savedContext);
       } else {
        setContextDraft("");
      }
    }
    // IMPORTANT: If workingParam === currentLoadedParam, don't touch contextDraft at all
    // This prevents clearing the context while the user is typing
  }, [
    textSelection,
    textfieldsValues,
    markerSet,
    currentLoadedParam,
    paramContexts,
    detectParameter,
  ]);

  const contextPopover = markerLogic.textSelection && (
    <MarkerPopover
      anchor={{
        x: markerLogic.textSelection.anchorX,
        y: markerLogic.textSelection.anchorY,
      }}
      preview={markerLogic.selectionPreview}
      context={markerLogic.contextDraft}
      setContext={markerLogic.setContextDraft}
      variants={markerLogic.numVariants}
      setVariants={markerLogic.setNumVariants}
      onGenerate={markerLogic.handleGenerate}
      loading={markerLogic.suggestionsLoading}
      nodeType="textfields"
    />
  );

  useEffect(() => {
    const unsub = useStore.subscribe((state: any, prevState: any) => {
      // Only run cleanup if nodes were actually removed (not added)
      const prevNodeIds = new Set(prevState.nodes?.map((n: any) => n.id) || []);
      const currentNodeIds = new Set(state.nodes?.map((n: any) => n.id) || []);

      const me = state.nodes.find((n: any) => n.id === id);
      if (!me || me.type !== "textfields") {
        return;
      }

      const removedNodeIds = Array.from(prevNodeIds).filter(
        (nodeId) => !currentNodeIds.has(nodeId),
      );

      // Skip cleanup if nodes are being added (which happens during splits)
      const addedNodeIds = Array.from(currentNodeIds).filter(
        (nodeId) => !prevNodeIds.has(nodeId),
      );

      if (removedNodeIds.length > 0 && addedNodeIds.length === 0) {
        // Use a longer delay and re-extract markers from current text
        setTimeout(() => {
          const currentState = useStore.getState();
          const currentNode = currentState.nodes.find((n: any) => n.id === id);
          if (!currentNode) return;

          const currentTextFields = currentNode.data?.fields || {};

          // Re-extract markers using the same logic as updateTemplateVars
          let all_found_vars = new Set<string>();
          Object.values(currentTextFields).forEach((fieldText) => {
            const found_vars = extractBracketedSubstrings(fieldText as string);
            if (found_vars && found_vars.length > 0) {
              found_vars.forEach((v) => all_found_vars.add(v));
            }
          });

          const actualMarkers = Array.from(all_found_vars);
          const actualMarkerSet = new Set(actualMarkers);

          // Only update if our local state is out of sync with actual markers
          if (!setsAreEqual(actualMarkerSet, markerSet)) {
            setMarkerSet(actualMarkerSet);
            setMarkerList(actualMarkers);
            setTemplateVars(actualMarkers);
            setDataPropsForNode(id, {
              vars: actualMarkers,
              fields: currentTextFields,
            });
            pingOutputNodes(id);

            const removedMarkers = Array.from(markerSet).filter(
              (marker) => !actualMarkerSet.has(marker),
            );

            if (removedMarkers.length > 0) {
              setParamContexts((prevContexts) => {
                const newContexts = { ...prevContexts };
                removedMarkers.forEach((marker) => {
                  delete newContexts[marker];
                });
                return newContexts;
              });
            }
          }
        }, 800);
      }
    });

    return () => unsub();
  }, [markerSet, id, setDataPropsForNode, pingOutputNodes]);

  const handleTextFieldChange = useCallback(
    (field_id: string, val: string, shouldDebounce: boolean) => {
      const new_fields = { ...textfieldsValues };
      new_fields[field_id] = val;
      setTextfieldsValues(new_fields);

      const new_data = updateTemplateVars({ fields: new_fields });

      if (
        new_data.vars &&
        !setsAreEqual(new Set(new_data.vars), new Set(templateVars))
      ) {
        setTemplateVars(new_data.vars);
      }

      debounce(
        (_id: string, _new_data: any) => {
          setDataPropsForNode(_id, _new_data);
          pingOutputNodes(_id);
        },
        shouldDebounce ? 300 : 1,
      )(id, new_data);
    },
    [
      textfieldsValues,
      templateVars,
      updateTemplateVars,
      setDataPropsForNode,
      pingOutputNodes,
      debounce,
      id,
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
              onMouseUp={(e) => markerLogic.handleMouseUp(e, nodeRef)}
            />
            {Object.keys(textfieldsValues).length > 1 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
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
              </div>
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
    <>
      <div ref={nodeRef}>
        <BaseNode
          classNames="text-fields-node"
          nodeId={id}
          contextMenuExts={customContextMenuItems}
        >
          {contextPopover}
          <NodeLabel
            title={data.title ?? "TextFields Node"}
            nodeId={id}
            icon={<IconTextPlus size="16px" />}
            customButtons={[
              ...(flags.aiSupport
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
                : []),
              suggestionsLoading && (
                <Loader
                  key="suggestions-loader"
                  size="xs"
                  variant="dots"
                  style={{ marginLeft: 6, marginRight: 6 }}
                />
              ),
            ]}
          />
          <Skeleton visible={isLoading}>
            <div ref={setRef} className="nodrag nowheel">
              <ScrollArea.Autosize
                mah={580}
                type="hover"
                viewportRef={viewport}
              >
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
      </div>
    </>
  );
};

export default TextFieldsNode;
