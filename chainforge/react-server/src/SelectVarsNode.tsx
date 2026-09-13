import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Handle, Position } from "reactflow";
import { v4 as uuid } from "uuid";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Group,
  ScrollArea,
  Text,
} from "@mantine/core";
import { IconFilter } from "@tabler/icons-react";

import useStore from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";

import { generatePrompts } from "./backend/backend";
import {
  extractLLMLookup,
  tagMetadataWithLLM,
  removeLLMTagFromMetadata,
} from "./backend/utils";
import {
  Dict,
  JSONCompatible,
  TemplateVarInfo,
  LLMResponsesByVarDict,
} from "./backend/typing";

const ALWAYS_INCLUDED_KEYS = ["__pt", "id", "signature"];

interface SelectVarsNodeProps {
  data: {
    input?: JSONCompatible;
    title?: string;
    refresh?: boolean;
    selectedKeys?: string[];
  };
  id: string;
}

function toPlainObject(maybe: any): Record<string, any> {
  if (!maybe) return {};
  if (maybe instanceof Map) return Object.fromEntries(maybe.entries());
  if (
    Array.isArray(maybe) &&
    maybe.length > 0 &&
    Array.isArray(maybe[0]) &&
    maybe[0].length === 2
  ) {
    try {
      return Object.fromEntries(maybe as any);
    } catch {
      /* ignore */
    }
  }
  if (typeof maybe === "object") {
    const out: Record<string, any> = {};
    Object.getOwnPropertyNames(maybe).forEach((k) => {
      out[k] = (maybe as any)[k];
    });
    return out;
  }
  return {};
}

const SelectVarsNode: React.FC<SelectVarsNodeProps> = ({ data, id }) => {
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pullInputData = useStore((state) => state.pullInputData);

  const [pastInputs, setPastInputs] = useState<JSONCompatible>([]);
  const [inputItems, setInputItems] = useState<any[]>([]);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    data.selectedKeys ?? [],
  );

  // Toujours inclure les clés spéciales
  const selectedSet = useMemo(
    () => new Set([...(selectedKeys ?? []), ...ALWAYS_INCLUDED_KEYS]),
    [selectedKeys],
  );

  const handleSetAndSave = <T,>(
    value: T,
    setter: React.Dispatch<React.SetStateAction<T>>,
    propName: string,
  ) => {
    setter(value);
    setDataPropsForNode(id, { [propName]: value as any });
  };

  const handleOnConnect = useCallback(() => {
    let input_data: LLMResponsesByVarDict = pullInputData(["__input"], id);
    if (!input_data || !input_data.__input) {
      setInputItems([]);
      setAvailableKeys([]);
      setDataPropsForNode(id, { fields: [], output: [] });
      return;
    }

    const llm_lookup = extractLLMLookup(input_data);
    input_data = tagMetadataWithLLM(input_data);

    generatePrompts(
      "{__input}",
      input_data as Dict<(TemplateVarInfo | string)[]>,
    )
      .then((promptTemplates) => {
        const resp_objs = promptTemplates.map((p: any) => {
          const sourceVars =
            "fill_history" in p && p.fill_history ? p.fill_history : p.vars;
          const normalized = toPlainObject(sourceVars);

          const obj: any = {
            text: p.toString(),
            llm:
              p.metavars && "__LLM_key" in p.metavars
                ? llm_lookup[p.metavars.__LLM_key]
                : undefined,
            metavars: removeLLMTagFromMetadata(p.metavars),
            uid: uuid(),
            fill_history: normalized, // on ne passe jamais 'vars'
          };

          // Toujours conserver les clés spéciales si présentes
          ALWAYS_INCLUDED_KEYS.forEach((key) => {
            if (p.metavars && key in p.metavars) {
              if (!obj.metavars) obj.metavars = {};
              obj.metavars[key] = p.metavars[key];
            }
          });

          return obj;
        });

        setInputItems(resp_objs);

        // Clés disponibles: union des clés de metavars + fill_history (sans ALWAYS_INCLUDED_KEYS)
        const keys = new Set<string>();
        resp_objs.forEach((r) => {
          Object.keys(r.metavars ?? {}).forEach((k) => keys.add(k));
          Object.keys(r.fill_history ?? {}).forEach((k) => keys.add(k));
        });
        ALWAYS_INCLUDED_KEYS.forEach((k) => keys.delete(k));
        const nextAvailable = Array.from(keys).sort();
        setAvailableKeys(nextAvailable);

        // Initialiser/mettre à jour selectedKeys
        if ((selectedKeys ?? []).length === 0) {
          handleSetAndSave(nextAvailable, setSelectedKeys, "selectedKeys");
        } else {
          const merged = Array.from(
            new Set([...(selectedKeys ?? []), ...nextAvailable]),
          );
          if (merged.length !== (selectedKeys ?? []).length) {
            handleSetAndSave(merged, setSelectedKeys, "selectedKeys");
          }
        }
      })
      .catch((e) => {
        console.error(e);
        setInputItems([]);
        setAvailableKeys([]);
        setDataPropsForNode(id, { fields: [], output: [] });
      });
  }, [id, pullInputData, selectedKeys, setDataPropsForNode]);

  if (data.input && data.input !== pastInputs) {
    setPastInputs(data.input);
    handleOnConnect();
  }

  useEffect(() => {
    if (data.refresh) {
      setDataPropsForNode(id, { refresh: false });
      handleOnConnect();
    }
  }, [data.refresh, id, handleOnConnect, setDataPropsForNode]);

  // Sortie: filtrer metavars ET appliquer le filtre à fill_history
  useEffect(() => {
    if (inputItems.length === 0) {
      setDataPropsForNode(id, { fields: [], output: [] });
      return;
    }

    const out = inputItems.map((f) => {
      const mv = f.metavars || {};
      const fhAll = toPlainObject(f.fill_history ?? {});

      // 1) Filtrer metavars selon la sélection + ALWAYS_INCLUDED_KEYS
      const filteredMetavars: Record<string, any> = {};
      Object.keys(mv).forEach((k) => {
        if (selectedSet.has(k)) filteredMetavars[k] = mv[k];
      });
      ALWAYS_INCLUDED_KEYS.forEach((key) => {
        if (key in mv) filteredMetavars[key] = mv[key];
      });

      // 2) Appliquer le filtre à fill_history (ne garder que selectedSet + ALWAYS_INCLUDED_KEYS)
      const filteredFillHistory: Record<string, any> = {};
      Object.keys(fhAll).forEach((k) => {
        if (selectedSet.has(k)) filteredFillHistory[k] = fhAll[k];
      });
      ALWAYS_INCLUDED_KEYS.forEach((key) => {
        if (key in fhAll) filteredFillHistory[key] = fhAll[key];
      });

      // Ne jamais renvoyer 'vars'
      const { vars: _omitVars, ...rest } = f;

      return {
        ...rest,
        metavars: filteredMetavars,
        fill_history: filteredFillHistory,
      };
    });

    setDataPropsForNode(id, { fields: out, output: out });
  }, [inputItems, selectedSet, id, setDataPropsForNode]);

  const toggleKey = (k: string) => {
    const next = selectedSet.has(k)
      ? selectedKeys.filter((x) => x !== k)
      : [...selectedKeys, k];
    handleSetAndSave(next, setSelectedKeys, "selectedKeys");
  };

  const selectAll = () =>
    handleSetAndSave(availableKeys, setSelectedKeys, "selectedKeys");
  const unselectAll = () =>
    handleSetAndSave<string[]>([], setSelectedKeys, "selectedKeys");

  return (
    <BaseNode classNames="select-vars-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Filter variables"}
        nodeId={id}
        icon={<IconFilter size="12pt" />}
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

      <Box mt="sm">
        <Group position="apart" mb="xs">
          <Text size="sm" weight={500}>
            Variable keys: {availableKeys.length}
          </Text>
          <Group spacing="xs">
            <Button size="xs" variant="light" onClick={selectAll}>
              Select all
            </Button>
            <Button size="xs" variant="light" onClick={unselectAll}>
              Deselect all
            </Button>
          </Group>
        </Group>

        <ScrollArea.Autosize
          mah={220}
          className="select-vars-node-list nopan nowheel"
        >
          {availableKeys.length === 0 ? (
            <Text size="sm" color="dimmed">
              No variables found in input.
            </Text>
          ) : (
            <Flex direction="column" gap="xs">
              {availableKeys.map((k) => (
                <Checkbox
                  key={k}
                  label={k}
                  checked={selectedSet.has(k)}
                  onChange={() => toggleKey(k)}
                />
              ))}
            </Flex>
          )}
        </ScrollArea.Autosize>

        <Box mt="sm"></Box>
      </Box>
    </BaseNode>
  );
};

export default SelectVarsNode;
