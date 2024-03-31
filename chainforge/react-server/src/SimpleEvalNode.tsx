import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import {
  NativeSelect,
  TextInput,
  Flex,
  Text,
  Box,
  ActionIcon,
  Menu,
  Tooltip,
} from "@mantine/core";
import {
  IconCaretDown,
  IconHash,
  IconRuler2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorModal, {
  LLMResponseInspectorModalRef,
} from "./LLMResponseInspectorModal";
import useStore from "./store";
import {
  cleanMetavarsFilterFunc,
  stripLLMDetailsFromResponses,
  toStandardResponseFormat,
} from "./backend/utils";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";
import { AlertModalContext } from "./AlertModal";
import { Status } from "./StatusIndicatorComponent";
import { JSONCompatible, LLMResponse } from "./backend/typing";
import { executejs } from "./backend/backend";

type ResponseFormat = "response" | "response in lowercase";
const RESPONSE_FORMATS: ResponseFormat[] = [
  "response",
  "response in lowercase",
];

type Operator =
  | "contains"
  | "starts with"
  | "ends with"
  | "equals"
  | "appears in";
const OPERATORS: Operator[] = [
  "contains",
  "starts with",
  "ends with",
  "equals",
  "appears in",
];

const createJSEvalCodeFor = (
  responseFormat: ResponseFormat,
  operation: Operator,
  value: string,
  valueType: "var" | "meta" | "string",
) => {
  let responseObj = "r.text";
  if (responseFormat === "response in lowercase")
    responseObj = "r.text.toLowerCase()";

  let valueObj = `${JSON.stringify(value)}`;
  if (valueType === "var") valueObj = `r.var['${value}']`;
  else if (valueType === "meta") valueObj = `r.meta['${value}']`;

  let returnBody;
  switch (
    operation // 'contains', 'starts with', 'ends with', 'equals', 'appears in'
  ) {
    case "contains":
      returnBody = `${responseObj}.includes(${valueObj})`;
      break;
    case "starts with":
      returnBody = `${responseObj}.trim().startsWith(${valueObj})`;
      break;
    case "ends with":
      returnBody = `${responseObj}.trim().endsWith(${valueObj})`;
      break;
    case "equals":
      returnBody = `${responseObj} === ${valueObj}`;
      break;
    case "appears in":
      returnBody = `${valueObj}.includes(${responseObj})`;
      break;
    default:
      console.error(
        `Could not create JS code for simple evaluator: Operation type '${operation}' does not exist.`,
      );
      break;
  }
  return `function evaluate(r) {\n  return ${returnBody};\n}`;
};

export interface SimpleEvalNodeProps {
  data: {
    responseFormat: ResponseFormat;
    operation: Operator;
    textValue: string;
    varValue: string;
    varValueType: "var" | "meta";
    varSelected: boolean;
    availableVars: string[];
    availableMetavars: string[];
    input: JSONCompatible[];
    refresh: boolean;
    title: string;
  };
  id: string;
}

/**
 * A no-code evaluator node with a very basic options for scoring responses.
 */
const SimpleEvalNode: React.FC<SimpleEvalNodeProps> = ({ data, id }) => {
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pullInputData = useStore((state) => state.pullInputData);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);
  const [pastInputs, setPastInputs] = useState<JSONCompatible[]>([]);

  const [status, setStatus] = useState<Status>(Status.NONE);
  const showAlert = useContext(AlertModalContext);

  const inspectModal = useRef<LLMResponseInspectorModalRef>(null);
  // eslint-disable-next-line
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [lastResponses, setLastResponses] = useState<LLMResponse[]>([]);
  const [lastRunSuccess, setLastRunSuccess] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const [responseFormat, setResponseFormat] = useState<ResponseFormat>(
    data.responseFormat ?? "response",
  );
  const [operation, setOperation] = useState<Operator>(
    data.operation ?? "contains",
  );
  const [textValue, setTextValue] = useState(data.textValue ?? "");
  const [varValue, setVarValue] = useState(data.varValue ?? "");
  const [varValueType, setVarValueType] = useState(data.varValueType ?? "var");
  const [valueFieldDisabled, setValueFieldDisabled] = useState(
    data.varSelected ?? false,
  );
  const [lastTextValue, setLastTextValue] = useState("");

  const [availableVars, setAvailableVars] = useState(data.availableVars ?? []);
  const [availableMetavars, setAvailableMetavars] = useState(
    data.availableMetavars ?? [],
  );

  const dirtyStatus = useCallback(() => {
    if (status === Status.READY) setStatus(Status.WARNING);
  }, [status]);

  const handleSetVarAsValue = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, valueType: "var" | "meta") => {
      // @ts-expect-error innerText exists
      const innerText = e.target.innerText as string;
      const txt = `of ${innerText} (${valueType})`;
      setLastTextValue(textValue);
      setTextValue(txt);
      setVarValue(innerText);
      setVarValueType(valueType);
      setValueFieldDisabled(true);
      setDataPropsForNode(id, {
        varValue: innerText,
        varValueType: valueType,
        varSelected: true,
        textValue: txt,
      });
      dirtyStatus();
    },
    [textValue, dirtyStatus],
  );
  const handleClearValueField = useCallback(() => {
    setTextValue(lastTextValue);
    setValueFieldDisabled(false);
    setDataPropsForNode(id, { varSelected: false, textValue: lastTextValue });
    dirtyStatus();
  }, [lastTextValue, dirtyStatus]);

  const handlePullInputs = useCallback(() => {
    // Pull input data
    const pulled_inputs = pullInputData(["responseBatch"], id);
    if (!pulled_inputs || !pulled_inputs.responseBatch) {
      console.warn(`No inputs to the Simple Evaluator node.`);
      return [];
    }
    // Convert to standard response format (StandardLLMResponseFormat)
    return pulled_inputs.responseBatch.map(toStandardResponseFormat);
  }, [pullInputData, id, toStandardResponseFormat]);

  const handleRunClick = useCallback(() => {
    // Pull inputs to the node
    const pulled_inputs = handlePullInputs();

    // Set status and created rejection callback
    setStatus(Status.LOADING);
    setLastResponses([]);

    const rejected = (err_msg: string) => {
      setStatus(Status.ERROR);
      setLastRunSuccess(false);
      if (showAlert) showAlert(err_msg);
    };

    // Generate JS code for the user's spec
    const code = valueFieldDisabled
      ? createJSEvalCodeFor(responseFormat, operation, varValue, varValueType)
      : createJSEvalCodeFor(responseFormat, operation, textValue, "string");

    // Run evaluator in backend
    executejs(id, code, pulled_inputs, "response", "evaluator")
      .then(function (res) {
        // Check if there's an error; if so, bubble it up to user and exit:
        const resps = res.responses;
        if (res.error || resps === undefined) throw new Error(res.error);

        // Ping any vis + inspect nodes attached to this node to refresh their contents:
        pingOutputNodes(id);

        console.log(resps);
        setLastResponses(stripLLMDetailsFromResponses(resps));
        setLastRunSuccess(true);

        if (status !== Status.READY && !showDrawer)
          setUninspectedResponses(true);

        setStatus(Status.READY);
      })
      .catch((err: Error | string) =>
        rejected(typeof err === "string" ? err : err.message),
      );
  }, [
    handlePullInputs,
    pingOutputNodes,
    setStatus,
    showAlert,
    status,
    varValue,
    varValueType,
    responseFormat,
    textValue,
    showDrawer,
    valueFieldDisabled,
  ]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  const handleOnConnect = useCallback(() => {
    // Pull inputs to the node
    const pulled_inputs = handlePullInputs();
    if (pulled_inputs && pulled_inputs.length > 0) {
      // Find all vars and metavars in responses
      const varnames = new Set<string>();
      const metavars = new Set<string>();
      pulled_inputs.forEach((resp_obj) => {
        Object.keys(resp_obj.vars).forEach((v) => varnames.add(v));
        if (resp_obj.metavars)
          Object.keys(resp_obj.metavars).forEach((v) => metavars.add(v));
      });
      const avs = Array.from(varnames);
      const amvs = Array.from(metavars).filter(cleanMetavarsFilterFunc);
      setAvailableVars(avs);
      setAvailableMetavars(amvs);
      setDataPropsForNode(id, { availableVars: avs, availableMetavars: amvs });
    }
  }, [data, id, handlePullInputs, setDataPropsForNode]);

  if (data.input) {
    // If there's a change in inputs...
    if (data.input !== pastInputs) {
      setPastInputs(data.input);
      handleOnConnect();
    }
  }

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus(Status.WARNING);
      handleOnConnect();
    }
  }, [data]);

  return (
    <BaseNode classNames="evaluator-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Simple Evaluator"}
        nodeId={id}
        icon={<IconRuler2 size="16px" />}
        status={status}
        handleRunClick={handleRunClick}
        runButtonTooltip="Run evaluator over inputs"
      />

      <LLMResponseInspectorModal
        ref={inspectModal}
        jsonResponses={lastResponses}
      />
      <iframe style={{ display: "none" }} id={`${id}-iframe`}></iframe>

      <Flex gap="xs">
        <Text mt="6px" fz="sm">
          Return true if
        </Text>
        <NativeSelect
          data={RESPONSE_FORMATS}
          defaultValue={responseFormat}
          onChange={(e) => {
            setResponseFormat(e.target.value as ResponseFormat);
            setDataPropsForNode(id, {
              responseFormat: e.target.value as ResponseFormat,
            });
            dirtyStatus();
          }}
        />
      </Flex>

      <Flex gap="xs">
        <Box w="85px" />
        <NativeSelect
          mt="sm"
          data={OPERATORS}
          defaultValue={operation}
          onChange={(e) => {
            setOperation(e.target.value as Operator);
            setDataPropsForNode(id, { operation: e.target.value as Operator });
            dirtyStatus();
          }}
        />
      </Flex>

      <Flex gap="xs" mt="sm">
        <Text mt="6px" fz="sm">
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;the value
        </Text>
        <TextInput
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={(e) => setDataPropsForNode(id, { textValue: e.target.value })}
          onKeyDown={dirtyStatus}
          disabled={valueFieldDisabled}
          className="nodrag"
        />
        {valueFieldDisabled ? (
          <Tooltip
            label="Clear variable"
            withArrow
            position="right"
            withinPortal
          >
            <ActionIcon
              variant="light"
              size="lg"
              onClick={handleClearValueField}
            >
              <IconX size="20px" />
            </ActionIcon>
          </Tooltip>
        ) : availableVars.length > 0 || availableMetavars.length > 0 ? (
          <Menu shadow="md" width={200} withinPortal>
            <Menu.Target>
              <Tooltip
                label="Use a variable"
                withArrow
                position="right"
                withinPortal
              >
                <ActionIcon variant="light" size="lg">
                  <IconCaretDown size="20px" />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>

            <Menu.Dropdown>
              {availableVars.length > 0 ? (
                <>
                  <Menu.Label>Variables</Menu.Label>
                  {availableVars.map((v: string) => (
                    <Menu.Item
                      key={v}
                      icon={<IconHash size={14} />}
                      onClick={(e) => handleSetVarAsValue(e, "var")}
                    >
                      {v}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                </>
              ) : (
                <></>
              )}

              {availableMetavars.length > 0 ? (
                <>
                  <Menu.Label>Metavariables</Menu.Label>
                  {availableMetavars.map((v: string) => (
                    <Menu.Item
                      key={v}
                      icon={<IconHash size={14} />}
                      onClick={(e) => handleSetVarAsValue(e, "meta")}
                    >
                      {v}
                    </Menu.Item>
                  ))}
                </>
              ) : (
                <></>
              )}
            </Menu.Dropdown>
          </Menu>
        ) : (
          <></>
        )}
      </Flex>

      <Handle
        type="target"
        position={Position.Left}
        id="responseBatch"
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

      {lastRunSuccess && lastResponses && lastResponses.length > 0 ? (
        <InspectFooter
          label={
            <>
              Inspect scores&nbsp;
              <IconSearch size="12pt" />
            </>
          }
          onClick={showResponseInspector}
          isDrawerOpen={showDrawer}
          showDrawerButton={true}
          onDrawerClick={() => {
            setShowDrawer(!showDrawer);
            setUninspectedResponses(false);
            bringNodeToFront(id);
          }}
        />
      ) : (
        <></>
      )}

      <LLMResponseInspectorDrawer
        jsonResponses={lastResponses}
        showDrawer={showDrawer}
      />
    </BaseNode>
  );
};

export default SimpleEvalNode;
