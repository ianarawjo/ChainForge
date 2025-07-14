import { useState, useCallback, useMemo, useEffect, useContext } from "react";
import { uuid } from "uuidv4";
import { AlertModalContext } from "../AlertModal";
import { extractBracketedSubstrings } from "../TemplateHooksComponent";
import { generateAndReplace } from "./ai";
import { suggestUniqueName } from "./suggestUniqueName";
import useStore from "../store";
import { markerUtils } from "./markerUtils";

export interface TextSelection {
  start: number;
  end: number;
  id: string;
  anchorX: number;
  anchorY: number;
}

interface MarkerLogicOptions {
  nodeId: string;
  isPromptNode?: boolean;
  fieldValues: Record<string, string>;
  templateVars: string[];
  onFieldChange: (fieldId: string, value: string) => void;
  onTemplateVarsChange: (vars: string[]) => void;
  onDataUpdate: (data: any) => void;
  findNodeByParam?: (nodeId: string, param: string) => any;
}

export const useMarkerLogic = (options: MarkerLogicOptions) => {
  const {
    nodeId,
    fieldValues,
    isPromptNode,
    templateVars,
    onFieldChange,
    onTemplateVarsChange,
    onDataUpdate,
    findNodeByParam,
  } = options;

  // Store hooks
  const addNode = useStore((state) => state.addNode);
  const addEdge = useStore((state) => state.addEdge);
  const getNode = useStore((state) => state.getNode);
  const removeNode = useStore((state) => state.removeNode);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const apiKeys = useStore((state) => state.apiKeys);
  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);
  const { nodeContexts, setNodeContext } = useStore() as any;

  const showAlert = useContext(AlertModalContext);

  const [markerSet, setMarkerSet] = useState<Set<string>>(
    new Set(templateVars),
  );
  const [markerList, setMarkerList] = useState<string[]>(templateVars);
  const [textSelection, setTextSelection] = useState<TextSelection | null>(
    null,
  );
  const [contextDraft, setContextDraft] = useState("");
  const [numVariants, setNumVariants] = useState("3");

  // Store contexts per parameter, not globally
  const [paramContexts, setParamContexts] = useState<Record<string, string>>(
    {},
  );
  const [currentLoadedParam, setCurrentLoadedParam] = useState<string | null>(
    null,
  );
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Sync templateVars with local state
  useEffect(() => {
    if (!markerUtils.setsAreEqual(new Set(templateVars), markerSet)) {
      setMarkerSet(new Set(templateVars));
      setMarkerList(templateVars);
    }
  }, [templateVars, markerSet]);

  //  Load context when parameter changes
  useEffect(() => {
    if (textSelection) {
      const detectedParam = markerUtils.detectParameter(
        textSelection,
        fieldValues,
        markerSet,
      );
      const selectedText = fieldValues[textSelection.id]
        ?.slice(textSelection.start, textSelection.end)
        ?.trim();
      const potentialParam = selectedText?.replace(/[{}]/g, "").trim();
      const param = detectedParam || potentialParam;

      if (param && param !== currentLoadedParam) {
        setCurrentLoadedParam(param);

        // Load context for this parameter
        let contextToLoad = "";
        if (paramContexts[param]) {
          contextToLoad = paramContexts[param];
        } else {
          // Check existing node context
          const existingNode = findNodeByParam?.(nodeId, param);
          if (existingNode && nodeContexts[existingNode.id]) {
            contextToLoad = nodeContexts[existingNode.id];
          }
        }

        setContextDraft(contextToLoad);
      }
    }
  }, [
    textSelection,
    fieldValues,
    markerSet,
    currentLoadedParam,
    paramContexts,
    nodeContexts,
    findNodeByParam,
    nodeId,
  ]);

  const spawnVariationsNode = useCallback(
    async (
      param: string,
      selectedStr: string,
      n: number,
      forcedContext?: string,
    ) => {
      // ⃣ assemble context
      let ctx = forcedContext ?? "";
      const existingNode = findNodeByParam?.(nodeId, param) ?? null;
      if (!forcedContext) {
        if (paramContexts[param]) {
          ctx = paramContexts[param];
        } else if (existingNode && nodeContexts[existingNode.id]) {
          ctx = nodeContexts[existingNode.id];
        }
      }

      const fullPrompt = ctx
        ? `${ctx}\n\nRephrase or vary this text: ${selectedStr}`
        : `Rephrase or vary this text: ${selectedStr}`;

      setSuggestionsLoading(true);
      let variants: string[];
      try {
        variants = await generateAndReplace(
          fullPrompt,
          n,
          false,
          aiFeaturesProvider,
          apiKeys,
        );
      } catch (err) {
        console.error("LLM variation failed:", err);
        return;
      } finally {
        setSuggestionsLoading(false);
      }

      const cleaned = variants.map((v) => {
        let s = v
          .trim()
          .replace(/^Rephrase or vary this text:\s*/i, "")
          .replace(/^[-\d.]+\s*/, "");
        if (s.startsWith("{") && s.endsWith("}")) {
          s = s.slice(1, -1).trim();
        }
        return s;
      });

      // Handle based on node type
      const node = getNode(nodeId);
      if (!node) return;

      const newFields: Record<string, string> = {};
      cleaned.forEach((s, i) => (newFields[`f${i}`] = s));

      if (existingNode) {
        setDataPropsForNode(existingNode.id, { fields: newFields });
        pingOutputNodes(existingNode.id);
        return;
      }

      const { x, y } = node.position;
      let title: string;
      try {
        title =
          (await suggestUniqueName(param, aiFeaturesProvider, apiKeys)) ||
          param;
      } catch {
        title = param;
      }

      const newID = `textfields-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      addNode({
        id: newID,
        type: "textfields",
        position: { x: x + 150, y: y + Math.random() * 100 },
        data: { title, fields: newFields },
      });

      addEdge({
        id: uuid(),
        source: newID,
        target: nodeId,
        sourceHandle: "output",
        targetHandle: param,
      });

      if (ctx.trim()) setNodeContext?.(newID, ctx);
    },
    [
      nodeId,
      isPromptNode,
      paramContexts,
      nodeContexts,
      aiFeaturesProvider,
      apiKeys,
      getNode,
      findNodeByParam,
      setDataPropsForNode,
      pingOutputNodes,
      addNode,
      addEdge,
      setNodeContext,
    ],
  );

  const createParam = useCallback(
    (nVariants: string) => {
      if (!textSelection) {
        return;
      }

      const { start, end, id: fieldId } = textSelection;

      const actualFieldId = isPromptNode ? "prompt" : fieldId;
      const text = isPromptNode
        ? fieldValues.prompt || ""
        : fieldValues[fieldId] || "";

      const selectedText = text.slice(start, end);
      const cleanSelected = selectedText.replace(/[{}]/g, "").trim();

      // BLOCK ANY HALF‐BRACE SELECTIONS OR STRAY BRACES INSIDE
      if (/[{}]/.test(selectedText) && !/^{[^{}]+}$/.test(selectedText)) {
        showAlert?.("Cannot select partial or stray braces.");
        setTextSelection(null);
        return;
      }

      // EMPTY selection check
      if (!cleanSelected) {
        setTextSelection(null);
        return;
      }

      const tokensInSelection = extractBracketedSubstrings(selectedText) || [];
      const allTokensInText = extractBracketedSubstrings(text) || [];

      // EXACT REFRESH:  user selected entire braced token
      if (
        tokensInSelection.length === 1 &&
        selectedText === `{${tokensInSelection[0]}}`
      ) {
        spawnVariationsNode(
          tokensInSelection[0],
          tokensInSelection[0],
          Number(nVariants),
          contextDraft,
        );
        setTextSelection(null);
        return;
      }

      // PLAIN REFRESH - user selected existing marker text without braces
      if (!tokensInSelection.length && markerSet.has(cleanSelected)) {
        spawnVariationsNode(
          cleanSelected,
          cleanSelected,
          Number(nVariants),
          contextDraft,
        );
        setTextSelection(null);
        return;
      }

      // SPLIT OPERATION - user selected part of existing marker content
      let splitMarker: string | null = null;
      let markerStartPos = -1;
      let markerEndPos = -1;

      // Find if selection is inside an existing marker
      for (const token of allTokensInText) {
        const markerText = `{${token}}`;
        let searchPos = 0;
        let markerPos;

        while ((markerPos = text.indexOf(markerText, searchPos)) !== -1) {
          const markerStart = markerPos;
          const markerEnd = markerPos + markerText.length;
          const contentStart = markerStart + 1; // After opening brace
          const contentEnd = markerEnd - 1; // Before closing brace

          // Check if our selection is ENTIRELY within the marker content (not including braces)
          if (start >= contentStart && end <= contentEnd) {
            // Additional check: make sure the selected text is actually part of the token content
            const tokenContent = token;
            if (tokenContent.includes(cleanSelected)) {
              splitMarker = token;
              markerStartPos = markerStart;
              markerEndPos = markerEnd;
              break;
            }
          }
          searchPos = markerPos + 1;
        }
        if (splitMarker) break;
      }

      if (splitMarker && markerStartPos >= 0) {
        // Find where the selected text appears in the marker content
        const splitIndex = splitMarker.indexOf(cleanSelected);
        if (splitIndex === -1) {
          console.error("Selected text not found in marker content");
          setTextSelection(null);
          return;
        }

        const leftPart = splitMarker.slice(0, splitIndex);
        const rightPart = splitMarker.slice(splitIndex + cleanSelected.length);

        let leftMarker = leftPart || "left";
        let rightMarker = cleanSelected;

        // Ensure uniqueness
        let counter = 2;
        while (markerSet.has(leftMarker) && leftMarker !== splitMarker) {
          leftMarker = `${leftPart || "left"}_${counter++}`;
        }
        counter = 2;
        while (markerSet.has(rightMarker) && rightMarker !== splitMarker) {
          rightMarker = `${cleanSelected}_${counter++}`;
        }

        // Store context for the split markers
        const contextToPreserve =
          contextDraft.trim() || paramContexts[splitMarker] || "";

        // Build replacement - preserve original order
        const replacement = leftPart
          ? `{${leftMarker}}{${rightMarker}}`
          : `{${rightMarker}}`;

        const updatedText =
          text.slice(0, markerStartPos) +
          replacement +
          text.slice(markerEndPos);

        onFieldChange(actualFieldId, updatedText);

        // Recalculate markers
        const newMarkers = Array.from(
          new Set(extractBracketedSubstrings(updatedText) || []),
        );
        setMarkerSet(new Set(newMarkers));
        setMarkerList(newMarkers);
        onTemplateVarsChange(newMarkers);

        // Update data based on node type
        if (isPromptNode) {
          onDataUpdate({ vars: newMarkers, prompt: updatedText });
        } else {
          const updatedFields = {
            ...fieldValues,
            [actualFieldId]: updatedText,
          };
          onDataUpdate({ vars: newMarkers, fields: updatedFields });
        }

        const store = useStore.getState();
        const oldNode = store.nodes.find((n) => n.data?.title === splitMarker);
        if (oldNode) {
          removeNode(oldNode.id);
        }

        const markersToCreate = leftPart
          ? [leftMarker, rightMarker]
          : [rightMarker];

        // Store contexts for the new markers
        markersToCreate.forEach((markerName) => {
          if (contextToPreserve) {
            setParamContexts((prev) => ({
              ...prev,
              [markerName]: contextToPreserve,
            }));
          }
        });

        // Remove old marker context
        setParamContexts((prev) => {
          const newContexts = { ...prev };
          if (splitMarker !== null) {
            delete newContexts[splitMarker];
          }
          return newContexts;
        });

        // Wait for React to process updates, then create nodes
        setTimeout(() => {
          const parent = getNode(nodeId);
          if (!parent) return;

          const { x, y } = parent.position;

          markersToCreate.forEach((markerName, index) => {
            // Generate variations to create the node with proper content
            spawnVariationsNode(
              markerName,
              markerName,
              Number(nVariants),
              contextToPreserve,
            );
          });
        }, 100);

        setTextSelection(null);
        return;
      }

      // NEW PARAMETER - create new marker from selection
      let uniqueName = cleanSelected;
      let counter = 2;
      while (markerSet.has(uniqueName)) {
        uniqueName = `${cleanSelected}_${counter++}`;
      }

      if (contextDraft.trim()) {
        setParamContexts((prev) => ({
          ...prev,
          [uniqueName]: contextDraft.trim(),
        }));
      }

      const updatedText =
        text.slice(0, start) + `{${uniqueName}}` + text.slice(end);

      onFieldChange(actualFieldId, updatedText);

      const newMarkerSet = new Set([...markerSet, uniqueName]);
      const newMarkerList = [...markerList, uniqueName];

      setMarkerSet(newMarkerSet);
      setMarkerList(newMarkerList);
      onTemplateVarsChange(newMarkerList);

      if (isPromptNode) {
        onDataUpdate({ vars: newMarkerList, prompt: updatedText });
      } else {
        const updatedFields = { ...fieldValues, [actualFieldId]: updatedText };
        onDataUpdate({ vars: newMarkerList, fields: updatedFields });
      }

      // Wait for marker updates to be processed, then generate variations
      setTimeout(() => {
        spawnVariationsNode(
          uniqueName,
          uniqueName,
          Number(nVariants),
          contextDraft,
        );
      }, 100);

      setTextSelection(null);
    },
    [
      textSelection,
      fieldValues,
      markerSet,
      markerList,
      spawnVariationsNode,
      showAlert,
      onFieldChange,
      onTemplateVarsChange,
      onDataUpdate,
      nodeId,
      removeNode,
      contextDraft,
      paramContexts,
      setParamContexts,
      getNode,
      isPromptNode,
    ],
  );

  // Rest of the code remains the same...
  const selectionPreview = useMemo(() => {
    if (!textSelection) return "";
    const fv = fieldValues[textSelection.id] ?? "";
    return fv
      .slice(textSelection.start, textSelection.end)
      .trim()
      .slice(0, 120);
  }, [textSelection, fieldValues]);

  const getCaretCoords = useCallback(
    (textarea: HTMLTextAreaElement, pos: number) => {
      const div = document.createElement("div");
      const style = window.getComputedStyle(textarea);

      [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "letterSpacing",
        "textTransform",
        "wordSpacing",
        "whiteSpace",
        "lineHeight",
        "padding",
        "border",
        "boxSizing",
      ].forEach((p) => (div.style[p as any] = style[p as any]));

      div.style.position = "absolute";
      div.style.visibility = "hidden";
      div.style.whiteSpace = "pre-wrap";
      div.style.width = `${textarea.clientWidth}px`;
      document.body.appendChild(div);

      const text = textarea.value;
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      div.textContent = before;

      const span = document.createElement("span");
      span.textContent = "\u200b";
      div.appendChild(span);
      div.appendChild(document.createTextNode(after || "\u200b"));

      const { offsetLeft: left, offsetTop: top, offsetHeight: height } = span;
      document.body.removeChild(div);
      return { top, left, height };
    },
    [],
  );

  const handleMouseUp = useCallback(
    (
      e: React.MouseEvent<HTMLTextAreaElement>,
      nodeRef: React.RefObject<HTMLDivElement>,
    ) => {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, id } = textarea;

      if (selectionStart === selectionEnd) {
        setTextSelection(null);
        return;
      }

      const calculateToolbarPosition = () => {
        const midPos = Math.floor((selectionStart + selectionEnd) / 2);
        const caret = getCaretCoords(textarea, midPos);

        const textareaRect = textarea.getBoundingClientRect();
        const nodeRect = nodeRef.current?.getBoundingClientRect() || {
          left: 0,
          top: 0,
        };

        const absoluteX = textareaRect.left + caret.left;
        const TOOLBAR_OFFSET = 10;
        const absoluteY =
          textareaRect.top + caret.top - caret.height - TOOLBAR_OFFSET;

        return {
          x: absoluteX - nodeRect.left,
          y: absoluteY - nodeRect.top,
        };
      };

      const { x, y } = calculateToolbarPosition();

      setTextSelection({
        start: selectionStart,
        end: selectionEnd,
        id,
        anchorX: x,
        anchorY: y,
      });
    },
    [getCaretCoords],
  );

  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      const prevIds = new Set(prev.nodes.map((n) => n.id));
      const currIds = new Set(state.nodes.map((n) => n.id));

      const removed = [...prevIds].filter((id) => !currIds.has(id));
      const added = [...currIds].filter((id) => !prevIds.has(id));

      if (removed.length > 0 && added.length === 0) {
        const removedMarkers = removed.flatMap((removedId) => {
          const edge = prev.edges.find(
            (e) => e.source === removedId && e.target === nodeId,
          );
          if (edge?.targetHandle) return edge.targetHandle;
          const title = prev.nodes.find((n) => n.id === removedId)?.data?.title;
          return title ? title : [];
        });

        const unique = Array.from(new Set(removedMarkers));
        if (!unique.length) return;

        const updated: Record<string, string> = { ...fieldValues };
        unique.forEach((marker) => {
          const re = new RegExp(`\\{${marker}\\}`, "g");
          Object.keys(updated).forEach((key) => {
            updated[key] = updated[key].replace(re, marker);
          });
        });

        const newSet = new Set<string>();
        Object.values(updated).forEach((txt) =>
          extractBracketedSubstrings(txt)?.forEach((v) => newSet.add(v)),
        );
        const newList = Array.from(newSet);

        if (!markerUtils.setsAreEqual(markerSet, newSet)) {
          setMarkerSet(newSet);
          setMarkerList(newList);
          onTemplateVarsChange(newList);

          if (isPromptNode) {
            onFieldChange("prompt", updated["prompt"]);
            onDataUpdate({
              vars: newList,
              prompt: updated["prompt"],
            });
          } else {
            onDataUpdate({
              vars: newList,
              fields: updated,
            });
          }

          setParamContexts((ctx) => {
            const newCtx = { ...ctx };
            unique.forEach((m) => delete newCtx[m]);
            return newCtx;
          });
        }
      }
    });
    return () => unsub();
  }, [
    fieldValues,
    markerSet,
    isPromptNode,
    onTemplateVarsChange,
    onDataUpdate,
    setParamContexts,
    nodeId,
    onFieldChange,
  ]);

  const handleGenerate = useCallback(() => {
    if (!textSelection) {
      return;
    }

    const detectedParam = markerUtils.detectParameter(
      textSelection,
      fieldValues,
      markerSet,
    );
    const selectedText = fieldValues[textSelection.id]
      ?.slice(textSelection.start, textSelection.end)
      ?.trim();
    const potentialParam = selectedText?.replace(/[{}]/g, "").trim();

    const param = detectedParam || potentialParam;

    if (param && contextDraft.trim()) {
      setParamContexts((prev) => ({
        ...prev,
        [param]: contextDraft.trim(),
      }));

      if (findNodeByParam) {
        const bundleNode = findNodeByParam(nodeId, param);
        if (bundleNode && setNodeContext) {
          setNodeContext(bundleNode.id, contextDraft.trim());
        }
      }
    }

    createParam(numVariants);
  }, [
    textSelection,
    fieldValues,
    markerSet,
    contextDraft,
    numVariants,
    createParam,
    findNodeByParam,
    nodeId,
    setNodeContext,
    currentLoadedParam,
    setParamContexts,
  ]);

  return {
    textSelection,
    contextDraft,
    setContextDraft,
    numVariants,
    setNumVariants,
    markerSet,
    markerList,
    suggestionsLoading,
    selectionPreview,
    handleMouseUp,
    handleGenerate,
    setTextSelection,
    getCaretCoords,
    spawnVariationsNode,
    createParam,
    paramContexts,
    currentLoadedParam,
  };
};
