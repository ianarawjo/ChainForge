import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import { Group, NativeSelect, Progress, Text, Textarea } from "@mantine/core";
import { IconRobot, IconSearch } from "@tabler/icons-react";
import { v4 as uuid } from "uuid";
import useStore, { initLLMProviders } from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { getDefaultModelSettings } from "./ModelSettingSchemas";
import { LLMListContainer } from "./LLMListComponent";
import LLMResponseInspectorModal, {
  LLMResponseInspectorModalRef,
} from "./LLMResponseInspectorModal";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";
import { genDebounceFunc, stripLLMDetailsFromResponses } from "./backend/utils";
import { AlertModalContext } from "./AlertModal";
import { Dict, LLMResponse, LLMSpec, QueryProgress } from "./backend/typing";
import { Status } from "./StatusIndicatorComponent";
import { evalWithLLM, grabResponses } from "./backend/backend";

// The default prompt shown in gray highlights to give people a good example of an evaluation prompt.
const PLACEHOLDER_PROMPT =
  "Respond with 'true' if the text has a positive sentiment, 'false' if not.";

enum OutputFormat {
  Bin = "bin",
  Cat = "cat",
  Num = "num",
  Any = "open",
}
const OUTPUT_FORMATS = [
  { value: OutputFormat.Bin, label: "binary (true/false)" },
  { value: OutputFormat.Cat, label: "categorical" },
  { value: OutputFormat.Num, label: "numeric" },
  { value: OutputFormat.Any, label: "open-ended" },
];
const OUTPUT_FORMAT_PROMPTS = {
  [OutputFormat.Bin]:
    "Only reply with boolean values true or false, nothing else.",
  [OutputFormat.Cat]: "Only reply with your categorization, nothing else.",
  [OutputFormat.Num]:
    "Only reply with a numeric value (a number), nothing else.",
  [OutputFormat.Any]: "",
};

// The default LLM annotator is GPT-4 at temperature 0.
const DEFAULT_LLM_ITEM = (() => {
  const item = [initLLMProviders.find((i) => i.base_model === "gpt-4")].map(
    (i) => ({
      key: uuid(),
      settings: getDefaultModelSettings((i as LLMSpec).base_model),
      ...i,
    }),
  )[0];
  item.settings.temperature = 0.0;
  return item as LLMSpec;
})();

export interface LLMEvaluatorComponentRef {
  run: (
    input_node_ids: string[],
    onProgressChange?: (progress: QueryProgress) => void,
  ) => Promise<LLMResponse[]>;
  serialize: () => {
    prompt: string;
    format: string;
    grader?: LLMSpec;
  };
}

export interface LLMEvaluatorComponentProps {
  prompt?: string;
  grader?: LLMSpec;
  format?: OutputFormat;
  id?: string;
  showUserInstruction?: boolean;
  onPromptEdit?: (newPrompt: string) => void;
  onLLMGraderChange?: (newGrader: LLMSpec) => void;
  onFormatChange?: (newFormat: OutputFormat) => void;
  modelContainerBgColor?: string;
}

/**
 * Inner component for LLM evaluators, storing the body of the UI (outside of the header and footers).
 */
export const LLMEvaluatorComponent = forwardRef<
  LLMEvaluatorComponentRef,
  LLMEvaluatorComponentProps
>(function LLMEvaluatorComponent(
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
  const [expectedFormat, setExpectedFormat] = useState<OutputFormat>(
    format ?? OutputFormat.Bin,
  );
  const apiKeys = useStore((state) => state.apiKeys);

  // Debounce helpers
  const debounceTimeoutRef = useRef(null);
  const debounce = genDebounceFunc(debounceTimeoutRef);

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Store prompt text
      setPromptText(e.target.value);

      // Update the caller, but debounce to reduce the number of callbacks when user is typing
      if (onPromptEdit) debounce(() => onPromptEdit(e.target.value), 200)();
    },
    [setPromptText, onPromptEdit],
  );

  const handleLLMListItemsChange = useCallback(
    (new_items: LLMSpec[]) => {
      setLLMScorers(new_items);

      if (new_items.length > 0 && onLLMGraderChange)
        onLLMGraderChange(new_items[0]);
    },
    [setLLMScorers, onLLMGraderChange],
  );

  const handleFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setExpectedFormat(e.target.value as OutputFormat);
      if (onFormatChange) onFormatChange(e.target.value as OutputFormat);
    },
    [setExpectedFormat, onFormatChange],
  );

  // Runs the LLM evaluator over the inputs, returning the results in a Promise.
  // Errors are raised as a rejected Promise.
  const run = (
    input_node_ids: string[],
    onProgressChange?: (progress: QueryProgress) => void,
  ) => {
    // Create prompt template to wrap user-specified scorer prompt and input data
    const formatting_instr = OUTPUT_FORMAT_PROMPTS[expectedFormat] ?? "";
    const template =
      "You are evaluating text that will be pasted below. " +
      promptText +
      " " +
      formatting_instr +
      "\n```\n{input}\n```";
    const llm_key = llmScorers[0].key ?? "";

    // Fetch info about the number of queries we'll need to make
    return grabResponses(input_node_ids)
      .then(function (resps) {
        // Create progress listener
        // Keeping track of progress (unpacking the progress state since there's only a single LLM)
        const num_resps_required = resps.reduce(
          (acc, resp_obj) => acc + resp_obj.responses.length,
          0,
        );
        return onProgressChange
          ? (progress_by_llm: Dict<QueryProgress>) =>
              onProgressChange({
                success:
                  (100 * progress_by_llm[llm_key].success) / num_resps_required,
                error:
                  (100 * progress_by_llm[llm_key].error) / num_resps_required,
              })
          : undefined;
      })
      .then((progress_listener) => {
        // Run LLM as evaluator
        return evalWithLLM(
          id ?? Date.now().toString(),
          llmScorers[0],
          template,
          input_node_ids,
          apiKeys ?? {},
          progress_listener,
        );
      })
      .then(function (res) {
        // Check if there's an error; if so, bubble it up to user and exit:
        if (res.errors && res.errors.length > 0) throw new Error(res.errors[0]);
        else if (res.responses === undefined)
          throw new Error(
            "Unknown error encountered when requesting evaluations: empty response returned.",
          );

        // Success!
        return res.responses;
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
        minRows={4}
        maxRows={12}
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

export interface LLMEvaluatorNodeProps {
  data: {
    prompt: string;
    grader: LLMSpec;
    format: OutputFormat;
    title: string;
    refresh: boolean;
  };
  id: string;
}

const LLMEvaluatorNode: React.FC<LLMEvaluatorNodeProps> = ({ data, id }) => {
  // The inner component storing the UI and logic for running the LLM-based evaluation
  const llmEvaluatorRef = useRef<LLMEvaluatorComponentRef>(null);

  const [status, setStatus] = useState<Status>(Status.NONE);
  const showAlert = useContext(AlertModalContext);

  const inspectModal = useRef<LLMResponseInspectorModalRef>(null);
  // eslint-disable-next-line
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);

  const [lastResponses, setLastResponses] = useState<LLMResponse[]>([]);

  // Progress when querying responses
  const [progress, setProgress] = useState<QueryProgress | undefined>(
    undefined,
  );

  const handleRunClick = useCallback(() => {
    // Get the ids from the connected input nodes:
    const input_node_ids = inputEdgesForNode(id).map((e) => e.source);
    if (input_node_ids.length === 0) {
      console.warn("No inputs for evaluator node.");
      return;
    }

    setStatus(Status.LOADING);
    setProgress({ success: 2, error: 0 });

    const handleError = (err: Error | string) => {
      setStatus(Status.ERROR);
      setProgress(undefined);
      if (typeof err !== "string") console.error(err);
      if (showAlert) showAlert(typeof err === "string" ? err : err?.message);
    };

    // Run LLM evaluator
    llmEvaluatorRef?.current
      ?.run(input_node_ids, setProgress)
      .then(function (evald_resps) {
        // Ping any vis + inspect nodes attached to this node to refresh their contents:
        pingOutputNodes(id);

        console.log(evald_resps);
        setLastResponses(evald_resps);

        if (!showDrawer) setUninspectedResponses(true);

        setStatus(Status.READY);
        setProgress(undefined);
      })
      .catch(handleError);
  }, [
    inputEdgesForNode,
    llmEvaluatorRef,
    pingOutputNodes,
    setStatus,
    showDrawer,
    showAlert,
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
      setStatus(Status.WARNING);
    }
  }, [data]);

  // On initialization
  useEffect(() => {
    // Attempt to grab cache'd responses
    grabResponses([id])
      .then(function (resps) {
        // Store responses and set status to green checkmark
        setLastResponses(stripLLMDetailsFromResponses(resps));
        setStatus(Status.READY);
      })
      .catch(() => {
        // soft fail
      });
  }, []);

  return (
    <BaseNode classNames="evaluator-node" nodeId={id}>
      <NodeLabel
        title={data.title ?? "LLM Scorer"}
        nodeId={id}
        icon={<IconRobot size="16px" />}
        status={status}
        handleRunClick={handleRunClick}
        runButtonTooltip="Run scorer over inputs"
      />
      <LLMResponseInspectorModal
        ref={inspectModal}
        jsonResponses={lastResponses}
      />

      <div className="llm-scorer-container">
        <LLMEvaluatorComponent
          ref={llmEvaluatorRef}
          prompt={data.prompt}
          onPromptEdit={(prompt: string) => {
            setDataPropsForNode(id, { prompt });
            setStatus(Status.WARNING);
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
        position={Position.Left}
        id="responseBatch"
        className="grouped-handle"
        style={{ top: "50%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
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
