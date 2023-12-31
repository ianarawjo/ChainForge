import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Handle } from "reactflow";
import { Group, NativeSelect, Progress, Text, Textarea } from "@mantine/core";
import { IconRobot, IconSearch } from "@tabler/icons-react";
import { v4 as uuid } from "uuid";
import useStore, { initLLMProviders } from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import fetch_from_backend from "./fetch_from_backend";
import { getDefaultModelSettings } from "./ModelSettingSchemas";
import { LLMListContainer } from "./LLMListComponent";
import LLMResponseInspectorModal from "./LLMResponseInspectorModal";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";
import { stripLLMDetailsFromResponses } from "./backend/utils";

// The default prompt shown in gray highlights to give people a good example of an evaluation prompt.
const PLACEHOLDER_PROMPT =
  "Respond with 'true' if the text has a positive sentiment, 'false' if not.";

const OUTPUT_FORMATS = [
  {value: "bin", label: 'binary (true/false)'}, 
  {value: "cat", label: 'categorical'}, 
  {value: "num", label: 'numeric'},
  {value: "open", label: 'open-ended'}
];
const OUTPUT_FORMAT_PROMPTS = {
  "bin": "Only reply with boolean values true or false, nothing else.",
  "cat": "Only reply with your categorization, nothing else.",
  "num": "Only reply with a numeric value (a number), nothing else.",
  "open": "",
};

// The default LLM annotator is GPT-4 at temperature 0.
const DEFAULT_LLM_ITEM = (() => {
  const item = [initLLMProviders.find((i) => i.base_model === "gpt-4")].map(
    (i) => ({
      key: uuid(),
      settings: getDefaultModelSettings(i.base_model),
      ...i,
    }),
  )[0];
  item.settings.temperature = 0.0;
  return item;
})();

/**
 * Inner component for LLM evaluators, storing the body of the UI (outside of the header and footers).
 */
export const LLMEvaluatorComponent = forwardRef(function LLMEvaluatorComponent(
  {
    prompt,
    grader,
    format,
    id,
    showUserInstruction,
    onPromptEdit,
    onLLMGraderChange,
    onFormatChange,
    modelContainerBgColor,
  },
  ref,
) {
  const [promptText, setPromptText] = useState(prompt ?? "");
  const [llmScorers, setLLMScorers] = useState([grader ?? DEFAULT_LLM_ITEM]);
  const [expectedFormat, setExpectedFormat] = useState(format ?? "bin");
  const apiKeys = useStore((state) => state.apiKeys);

  const handlePromptChange = useCallback(
    (e) => {
      // Store prompt text
      setPromptText(e.target.value);
      if (onPromptEdit) onPromptEdit(e.target.value);
    },
    [setPromptText, onPromptEdit],
  );

  const handleLLMListItemsChange = useCallback(
    (new_items) => {
      setLLMScorers(new_items);

      if (new_items.length > 0 && onLLMGraderChange)
        onLLMGraderChange(new_items[0]);
    },
    [setLLMScorers, onLLMGraderChange],
  );

  const handleFormatChange = useCallback(
    (e) => {
      setExpectedFormat(e.target.value);
      if (onFormatChange) onFormatChange(e.target.value);
    },
    [setExpectedFormat, onFormatChange],
  );

  // Runs the LLM evaluator over the inputs, returning the results in a Promise.
  // Errors are raised as a rejected Promise.
  const run = (input_node_ids, onProgressChange) => {
    // Create prompt template to wrap user-specified scorer prompt and input data
    const formatting_instr = OUTPUT_FORMAT_PROMPTS[expectedFormat] ?? "";
    const template =
      "You are evaluating text that will be pasted below. " +
      promptText +
      " " +
      formatting_instr +
      "\n```\n{input}\n```";

    // Keeping track of progress (unpacking the progress state since there's only a single LLM)
    const llm_key = llmScorers[0].key;
    const _progress_listener = (progress_by_llm) =>
      onProgressChange({
        success: progress_by_llm[llm_key].success,
        error: progress_by_llm[llm_key].error,
      });

    // Run LLM as evaluator
    return fetch_from_backend("evalWithLLM", {
      id,
      llm: llmScorers[0],
      root_prompt: template,
      responses: input_node_ids,
      api_keys: apiKeys ?? {},
      progress_listener: onProgressChange ? _progress_listener : undefined,
    }).then(function (json) {
      // Check if there's an error; if so, bubble it up to user and exit:
      if (!json || json.error || json.responses === undefined)
        throw new Error(
          json?.error ||
            "Unknown error encountered when requesting evaluations: empty response returned.",
        );
      else if (json.errors && json.errors.length > 0)
        throw new Error(Object.values(json.errors[0])[0]);

      // Success!
      return json;
    });
  };

  // Export the current internal state as JSON
  const serialize = () => ({
    prompt: promptText,
    grader: llmScorers.length > 0 ? llmScorers[0] : undefined,
    format: expectedFormat,
  });

  // Define functions accessible from the parent component
  useImperativeHandle(ref, () => ({
    run,
    serialize,
  }));

  return (
    <>
      <Textarea
        autosize
        label={
          showUserInstruction
            ? "Describe how to 'score' a single response."
            : undefined
        }
        placeholder={PLACEHOLDER_PROMPT}
        description={
          showUserInstruction
            ? "The text of the response will be pasted directly below your rubric."
            : undefined
        }
        className="prompt-field-fixed nodrag nowheel"
        minRows="4"
        maxRows="12"
        w="100%"
        mb="sm"
        value={promptText}
        onChange={handlePromptChange}
      />

      <Group spacing="xs">
        <Text size="sm" fw="500" pl="2px" mb="14px">
          Expected format:
        </Text>
        <NativeSelect
          size="xs"
          data={OUTPUT_FORMATS}
          value={expectedFormat}
          onChange={handleFormatChange}
          mb="sm"
        />
      </Group>

      <LLMListContainer
        initLLMItems={llmScorers}
        description="Model to use as scorer:"
        modelSelectButtonText="Change"
        selectModelAction="replace"
        onItemsChange={handleLLMListItemsChange}
        hideTrashIcon={true}
        bgColor={modelContainerBgColor}
      />
    </>
  );
});

const LLMEvaluatorNode = ({ data, id }) => {
  // The inner component storing the UI and logic for running the LLM-based evaluation
  const llmEvaluatorRef = useRef(null);

  const [status, setStatus] = useState("none");
  const alertModal = useRef(null);

  const inspectModal = useRef(null);
  // eslint-disable-next-line
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);

  const [lastResponses, setLastResponses] = useState([]);

  // Progress when querying responses
  const [progress, setProgress] = useState(undefined);

  const handleRunClick = useCallback(() => {
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map((e) => e.source);
    if (input_node_ids.length === 0) {
      console.warn("No inputs for evaluator node.");
      return;
    }

    setStatus("loading");
    setProgress({ success: 2, error: 0 });

    const handleError = (err) => {
      setStatus("error");
      setProgress(undefined);
      if (typeof err !== "string") console.error(err);
      alertModal.current.trigger(typeof err === "string" ? err : err?.message);
    };

    // Fetch info about the number of queries we'll need to make
    fetch_from_backend("grabResponses", {
      responses: input_node_ids,
    }).then(function (json) {
      if (!json?.responses || json.responses.length === 0) {
        handleError("Error pulling input data for node: No input data found.");
        return;
      }

      // Create progress listener
      const num_resps_required = json.responses.reduce(
        (acc, resp_obj) => acc + resp_obj.responses.length,
        0,
      );
      const onProgressChange = (prog) => {
        setProgress({
          success: (100 * prog.success) / num_resps_required,
          error: (100 * prog.error) / num_resps_required,
        });
      };

      // Run LLM evaluator
      llmEvaluatorRef?.current
        ?.run(input_node_ids, onProgressChange)
        .then(function (json) {
          if (json?.responses === undefined) {
            // We shouldn't be able to reach here, but just in case:
            handleError("Unknown error encounted when running LLM evaluator.");
            return;
          }

          // Ping any vis + inspect nodes attached to this node to refresh their contents:
          pingOutputNodes(id);

          console.log(json.responses);
          setLastResponses(json.responses);

          if (!showDrawer) setUninspectedResponses(true);

          setStatus("ready");
          setProgress(undefined);
        })
        .catch(handleError);
    });
  }, [
    inputEdgesForNode,
    llmEvaluatorRef,
    pingOutputNodes,
    setStatus,
    showDrawer,
    alertModal,
  ]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus("warning");
    }
  }, [data]);

  // On initialization
  useEffect(() => {
    // Attempt to grab cache'd responses
    fetch_from_backend("grabResponses", {
      responses: [id],
    }).then(function (json) {
      if (json.responses && json.responses.length > 0) {
        // Store responses and set status to green checkmark
        setLastResponses(stripLLMDetailsFromResponses(json.responses));
        setStatus("ready");
      }
    });
  }, []);

  return (
    <BaseNode classNames="evaluator-node" nodeId={id}>
      <NodeLabel title={data.title || 'LLM Scorer'} 
                  nodeId={id} 
                  icon={<IconRobot size="16px" />} 
                  status={status}
                  alertModal={alertModal}
                  handleRunClick={handleRunClick}
                  runButtonTooltip="Run scorer over inputs" />
      <LLMResponseInspectorModal ref={inspectModal} jsonResponses={lastResponses} />

      <div className="llm-scorer-container">
        <LLMEvaluatorComponent
          ref={llmEvaluatorRef}
          prompt={data.prompt}
          onPromptEdit={(prompt) => {
            setDataPropsForNode(id, { prompt });
            setStatus("warning");
          }}
          onLLMGraderChange={(new_grader) =>
            setDataPropsForNode(id, { grader: new_grader })
          }
          onFormatChange={(new_format) =>
            setDataPropsForNode(id, { format: new_format })
          }
          grader={data.grader}
          format={data.format}
          id={id}
          showUserInstruction={true}
        />
      </div>

      {progress !== undefined ? (
        <Progress
          animate={true}
          sections={[
            {
              value: progress.success,
              color: "blue",
              tooltip: "API call succeeded",
            },
            {
              value: progress.error,
              color: "red",
              tooltip: "Error collecting response",
            },
          ]}
        />
      ) : (
        <></>
      )}

      {/* <Alert icon={<IconAlertTriangle size="1rem" />} p='10px' radius='xs' title="Caution" color="yellow" maw='270px' mt='xs' styles={{title: {margin: '0px'}, icon: {marginRight: '4px'}, message: {fontSize: '10pt'}}}>
        AI scores are not 100% accurate.
      </Alert>  */}

      <Handle
        type="target"
        position="left"
        id="responseBatch"
        className="grouped-handle"
        style={{ top: "50%" }}
      />
      <Handle
        type="source"
        position="right"
        id="output"
        className="grouped-handle"
        style={{ top: "50%" }}
      />

      {lastResponses && lastResponses.length > 0 ? (
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

export default LLMEvaluatorNode;
