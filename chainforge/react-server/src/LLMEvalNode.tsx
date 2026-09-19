import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useContext,
  useMemo,
} from "react";
import { Handle, Position } from "reactflow";
import {
  Button,
  Group,
  NativeSelect,
  Popover,
  Progress,
  Select,
  Text,
  Textarea,
  Checkbox,
  Tooltip,
} from "@mantine/core";
import {
  IconEraser,
  IconPencil,
  IconRobot,
  IconSearch,
} from "@tabler/icons-react";
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
import {
  extractSettingsVars,
  genDebounceFunc,
  stripLLMDetailsFromResponses,
  withResponseMetavars,
} from "./backend/utils";
import { AlertModalContext } from "./AlertModal";
import { AIGenRubricPopover } from "./AiPopover";
import {
  Dict,
  LLMResponse,
  LLMResponseData,
  LLMSpec,
  QueryProgress,
} from "./backend/typing";
import { Status } from "./StatusIndicatorComponent";
import {
  InvalidScores,
  JudgeStats,
  clearCachedScores,
  countEvalQueries,
  evalWithLLM,
  generatePrompts,
  grabResponses,
} from "./backend/backend";
import { UserForcedPrematureExit } from "./backend/errors";
import CancelTracker from "./backend/canceler";
import { PromptInfo, PromptListModal, PromptListPopover } from "./PromptNode";
import { useDisclosure } from "@mantine/hooks";
import { PromptTemplate } from "./backend/template";
import StorageCache, { StringLookup } from "./backend/cache";
import {
  DATA_INPUT_NODE_TYPES,
  DataInputValue,
  dataInputCacheId,
  dataValuesToResponses,
} from "./backend/dataInputs";
import JudgeAgreementView from "./JudgeAgreementView";
import {
  ScoreSpec,
  findDisagreements,
  formatInstruction,
  judgeAgreement,
  reliability,
  runTooltipFor,
  scoreSpecFrom,
} from "./backend/scorerFormat";

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
  { value: OutputFormat.Bin, label: "true/false" },
  { value: OutputFormat.Cat, label: "categorical" },
  { value: OutputFormat.Num, label: "numeric" },
  { value: OutputFormat.Any, label: "open-ended" },
];

// The default LLM annotator is GPT-4 at temperature 0.
const DEFAULT_LLM_ITEM = (() => {
  const item = [initLLMProviders.find((i) => i.base_model === "gpt-4")].map(
    (i) => ({
      key: uuid(),
      settings: getDefaultModelSettings(
        StringLookup.get(i?.base_model) as string,
      ),
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
    cancelId?: string | number,
  ) => Promise<LLMResponse[]>;
  cancel: (cancelId: string | number, cancelProgress: () => void) => void;
  serialize: () => {
    prompt: string;
    format: string;
    grader?: LLMSpec;
    graders?: LLMSpec[];
    categories?: string;
    scale?: string;
  };
  /** The scorer's format, with its categories or scale levels. */
  getScoreSpec: () => ScoreSpec;
  /** The judges' names, in order. */
  getJudgeNames: () => string[];
  /**
   * How many new requests a run would send to each judge, by judge name,
   * given what's already cached. Rejects when the scorer can't run as set up.
   */
  countNewRequests: (input_node_ids: string[]) => Promise<Dict<number>>;
  getPromptTemplate: () => string;
  /** Replaces the rubric, as if the user had typed it. */
  setPrompt: (prompt: string) => void;
}

export interface LLMEvaluatorComponentProps {
  prompt?: string;
  grader?: LLMSpec;
  /** Several judges, when allowMultipleJudges is set. Takes precedence over grader. */
  graders?: LLMSpec[];
  /** Whether several models can judge side by side. Their scores are keyed by judge name. */
  allowMultipleJudges?: boolean;
  format?: OutputFormat;
  /** For categorical scores: one category per line, optionally "label: description". */
  categories?: string;
  /** For numeric scores: the scale's levels, lowest first, one per line. */
  scale?: string;
  onCategoriesChange?: (categories: string) => void;
  onScaleChange?: (scale: string) => void;
  onLLMGradersChange?: (newGraders: LLMSpec[]) => void;
  /** Called after each run with the judges' answers that didn't fit the format. */
  onInvalidScores?: (invalid: InvalidScores[]) => void;
  /** Called after each run with each judge's cost, time and tokens. */
  onJudgeStats?: (stats: JudgeStats[]) => void;
  id?: string;
  showUserInstruction?: boolean;
  onPromptEdit?: (newPrompt: string) => void;
  onLLMGraderChange?: (newGrader: LLMSpec) => void;
  onFormatChange?: (newFormat: OutputFormat) => void;
  modelContainerBgColor?: string;
  reasonBeforeScoring?: boolean;
  onReasonBeforeScoringChange?: (newValue: boolean) => void;
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
    graders,
    allowMultipleJudges,
    format,
    categories,
    scale,
    id,
    showUserInstruction,
    onPromptEdit,
    onLLMGraderChange,
    onLLMGradersChange,
    onFormatChange,
    onCategoriesChange,
    onScaleChange,
    onInvalidScores,
    onJudgeStats,
    modelContainerBgColor,
    reasonBeforeScoring,
    onReasonBeforeScoringChange,
  },
  ref,
) {
  const [promptText, setPromptText] = useState(prompt ?? "");
  const [llmScorers, setLLMScorers] = useState<LLMSpec[]>(
    allowMultipleJudges && graders && graders.length > 0
      ? graders
      : [grader ?? DEFAULT_LLM_ITEM],
  );
  const [categoriesText, setCategoriesText] = useState(categories ?? "");
  const [scaleText, setScaleText] = useState(scale ?? "");
  const [expectedFormat, setExpectedFormat] = useState<OutputFormat>(
    format ?? OutputFormat.Bin,
  );
  const [useReasoning, setUseReasoning] = useState<boolean>(
    reasonBeforeScoring ?? false,
  );
  const apiKeys = useStore((state) => state.apiKeys);

  // Debounce helpers
  const debounceTimeoutRef = useRef(null);
  const debounce = genDebounceFunc(debounceTimeoutRef);
  // A separate one for the categories and scale, so typing there doesn't drop a pending prompt edit
  const optionsDebounceRef = useRef(null);
  const debounceOptions = genDebounceFunc(optionsDebounceRef);

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
      if (onLLMGradersChange) onLLMGradersChange(new_items);
    },
    [setLLMScorers, onLLMGraderChange, onLLMGradersChange],
  );

  const handleCategoriesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCategoriesText(e.target.value);
      if (onCategoriesChange)
        debounceOptions(() => onCategoriesChange(e.target.value), 200)();
    },
    [onCategoriesChange],
  );

  const handleScaleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setScaleText(e.target.value);
      if (onScaleChange)
        debounceOptions(() => onScaleChange(e.target.value), 200)();
    },
    [onScaleChange],
  );

  // What the answer options button says: the categories or scale in brief
  const answerOptionsLabel = () => {
    const spec = getScoreSpec();
    const base =
      expectedFormat === OutputFormat.Cat
        ? spec.categories
          ? `${spec.categories.length} categories`
          : "Any answer"
        : expectedFormat === OutputFormat.Num
          ? spec.scale
            ? `${spec.scale.length}-level scale`
            : "Any number"
          : "Options";
    return useReasoning ? `${base} · reasons` : base;
  };

  const getScoreSpec = () =>
    scoreSpecFrom(expectedFormat, categoriesText, scaleText);

  // The judges that score each response: all of them, or just the first
  // where only one is allowed
  const activeJudges = () =>
    allowMultipleJudges ? llmScorers : llmScorers.slice(0, 1);

  const handleFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setExpectedFormat(e.target.value as OutputFormat);
      if (onFormatChange) onFormatChange(e.target.value as OutputFormat);
    },
    [setExpectedFormat, onFormatChange],
  );

  const handleReasoningChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUseReasoning(e.currentTarget.checked);
      if (onReasonBeforeScoringChange)
        onReasonBeforeScoringChange(e.currentTarget.checked);
    },
    [setUseReasoning, onReasonBeforeScoringChange],
  );

  const getPromptTemplate = () => {
    // Choose the appropriate format instruction based on the reasoning checkbox
    const formatting_instr = formatInstruction(getScoreSpec(), useReasoning);

    return (
      "You are evaluating text that will be pasted below. " +
      promptText +
      " " +
      "\n```\n{__input}\n```\n\n" +
      formatting_instr
    );
  };

  // Runs the LLM evaluator over the inputs, returning the results in a Promise.
  // Errors are raised as a rejected Promise.
  const run = (
    input_node_ids: string[],
    onProgressChange?: (progress: QueryProgress) => void,
    cancelId?: string | number,
  ) => {
    // Create prompt template to wrap user-specified scorer prompt and input data
    const template = getPromptTemplate();
    const judges = activeJudges();
    const spec = getScoreSpec();

    // Fetch info about the number of queries we'll need to make
    return grabResponses(input_node_ids)
      .then(function (resps) {
        // Create progress listener
        // Keeping track of progress (unpacking the progress state since there's only a single LLM)
        const num_resps_required = resps.reduce(
          (acc, resp_obj) => acc + resp_obj.responses.length,
          0,
        );
        // Text judges and decision judges (e.g. Jev) are queried separately, each
        // reporting progress for its own judges, so keep the latest for all of them
        const progress_so_far: Dict<QueryProgress> = {};
        return onProgressChange
          ? (progress_update: Dict<QueryProgress>) =>
              // Debounce the progress bars UI update to ensure we don't re-render too often:
              debounce(() => {
                Object.assign(progress_so_far, progress_update);
                const progress_by_llm = progress_so_far;
                // Progress across all judges
                const total = num_resps_required * judges.length;
                const sum = (k: "success" | "error") =>
                  judges.reduce(
                    (acc, j) => acc + (progress_by_llm[j.key ?? ""]?.[k] ?? 0),
                    0,
                  );
                onProgressChange({
                  success: (100 * sum("success")) / total,
                  error: (100 * sum("error")) / total,
                });
              }, 30)()
          : undefined;
      })
      .then((progress_listener) => {
        // Run LLM as evaluator
        return evalWithLLM(
          id ?? Date.now().toString(),
          judges.length > 1 ? judges : judges[0],
          template,
          input_node_ids,
          apiKeys ?? {},
          progress_listener,
          cancelId,
          undefined,
          useReasoning,
          spec,
          promptText,
        );
      })
      .then(function (res) {
        // eslint-disable-next-line
        debounce(() => {}, 1)(); // erase any pending debounces

        // Check if there's an error; if so, bubble it up to user and exit:
        if (res.errors && res.errors.length > 0) throw new Error(res.errors[0]);
        else if (res.responses === undefined)
          throw new Error(
            "Unknown error encountered when requesting evaluations: empty response returned.",
          );

        // Success!
        if (onInvalidScores) onInvalidScores(res.invalid ?? []);
        if (onJudgeStats) onJudgeStats(res.judge_stats ?? []);
        return res.responses;
      });
  };

  const countNewRequests = async (input_node_ids: string[]) => {
    const judges = activeJudges();
    const by_key = await countEvalQueries(
      id ?? "",
      judges.length > 1 ? judges : judges[0],
      getPromptTemplate(),
      input_node_ids,
      undefined,
      getScoreSpec(),
      promptText,
    );
    return Object.fromEntries(
      judges.map((j) => [j.name, by_key[j.key ?? ""] ?? 0]),
    );
  };

  const cancel = (cancelId: string | number, cancelProgress: () => void) => {
    CancelTracker.add(cancelId);
    // eslint-disable-next-line
    debounce(cancelProgress, 1)(); // erase any pending debounces
  };

  // Export the current internal state as JSON
  const serialize = () => ({
    prompt: promptText,
    grader: llmScorers.length > 0 ? llmScorers[0] : undefined,
    ...(allowMultipleJudges ? { graders: llmScorers } : {}),
    format: expectedFormat,
    categories: categoriesText,
    scale: scaleText,
    reasonBeforeScoring: useReasoning,
  });

  const setPrompt = (newPrompt: string) => {
    setPromptText(newPrompt);
    if (onPromptEdit) onPromptEdit(newPrompt);
  };

  // Define functions accessible from the parent component
  useImperativeHandle(ref, () => ({
    run,
    cancel,
    serialize,
    getPromptTemplate,
    setPrompt,
    getScoreSpec,
    getJudgeNames: () => activeJudges().map((j) => j.name),
    countNewRequests,
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

      <Group spacing={6} mb="sm" noWrap>
        <Text size="sm" fw={500} pl="2px">
          Answer
        </Text>
        <NativeSelect
          size="xs"
          data={OUTPUT_FORMATS}
          value={expectedFormat}
          onChange={handleFormatChange}
        />
        <Popover
          width={300}
          position="bottom-start"
          withArrow
          shadow="md"
          withinPortal
          // React Flow's canvas swallows mousedown, so close on click instead (as AiPopover does)
          clickOutsideEvents={["click"]}
        >
          <Popover.Target>
            <Button
              size="xs"
              compact
              variant="light"
              color="gray"
              rightIcon={<IconPencil size="12px" />}
              styles={{ label: { fontWeight: 400 } }}
            >
              {answerOptionsLabel()}
            </Button>
          </Popover.Target>
          <Popover.Dropdown className="nodrag nowheel">
            {expectedFormat === OutputFormat.Cat && (
              <Textarea
                autosize
                label="Categories"
                description="One per line, optionally with a description after a colon. Empty accepts any answer."
                placeholder={
                  "billing: charges, invoices, refunds\ntechnical: bugs, outages"
                }
                minRows={3}
                maxRows={12}
                mb="sm"
                value={categoriesText}
                onChange={handleCategoriesChange}
              />
            )}
            {expectedFormat === OutputFormat.Num && (
              <Textarea
                autosize
                label="Scale"
                description="Levels, lowest first, one per line. Scored 1, 2, 3, and so on. Empty accepts any number."
                placeholder={"Rude\nNeutral\nWarm"}
                minRows={3}
                maxRows={10}
                mb="sm"
                value={scaleText}
                onChange={handleScaleChange}
              />
            )}
            <Checkbox
              label="Reason before scoring"
              size="xs"
              checked={useReasoning}
              onChange={handleReasoningChange}
            />
          </Popover.Dropdown>
        </Popover>
      </Group>

      <LLMListContainer
        initLLMItems={llmScorers}
        description={allowMultipleJudges ? "Judges" : "Model to use as scorer:"}
        modelSelectButtonText={allowMultipleJudges ? "Add judge +" : "Change"}
        selectModelAction={allowMultipleJudges ? "add" : "replace"}
        onItemsChange={handleLLMListItemsChange}
        hideTrashIcon={!allowMultipleJudges || llmScorers.length <= 1}
        bgColor={modelContainerBgColor}
      />
    </>
  );
});

export interface LLMEvaluatorNodeProps {
  data: {
    prompt: string;
    grader: LLMSpec;
    graders?: LLMSpec[];
    format: OutputFormat;
    categories?: string;
    scale?: string;
    /** The input variable (or "__meta_"-prefixed metavariable) holding each response's true label. */
    labelVar?: string | null;
    /** Each judge's cost, time and tokens over the last run. */
    judgeStats?: JudgeStats[];
    title: string;
    refresh: boolean;
    reasonBeforeScoring?: boolean;
  };
  id: string;
}

const LLMEvaluatorNode: React.FC<LLMEvaluatorNodeProps> = ({ data, id }) => {
  // The inner component storing the UI and logic for running the LLM-based evaluation
  const llmEvaluatorRef = useRef<LLMEvaluatorComponentRef>(null);
  const aiSupport = useStore((state) => state.globalSettings.aiSupport);

  const [status, setStatus] = useState<Status>(Status.NONE);
  const showAlert = useContext(AlertModalContext);

  // Cancelation of pending queries
  const [cancelId, setCancelId] = useState(Date.now());
  const refreshCancelId = () => setCancelId(Date.now());

  const inspectModal = useRef<LLMResponseInspectorModalRef>(null);
  // eslint-disable-next-line
  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // For an info pop-up that shows all the prompts that will be sent off
  // NOTE: This is the 'full' version of the PromptListPopover that activates on hover.
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] =
    useDisclosure(false);

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);
  const getNode = useStore((state) => state.getNode);
  const nodeOutput = useStore((state) => state.output);

  // The ids of the responses to score, one per input. Values from data nodes
  // (a table column, text fields, items, images) are made into responses here
  // (see ./backend/dataInputs) and cached under an id of their own; other
  // inputs, e.g. Prompt Nodes, have cached their responses already.
  const resolveInputIds = useCallback(
    () =>
      inputEdgesForNode(id).map((e) => {
        const src = getNode(e.source);
        if (
          !src?.type ||
          !DATA_INPUT_NODE_TYPES.has(src.type) ||
          !e.sourceHandle
        )
          return e.source;
        const values = (nodeOutput(
          e.source,
          e.sourceHandle,
          e.target,
          e.targetHandle ?? undefined,
        ) ?? []) as DataInputValue[];
        // Name them by their column, or else by the node
        const label =
          src.type === "table"
            ? e.sourceHandle
            : (src.data?.title as string | undefined) ?? src.type;
        const cacheId = dataInputCacheId(id, e.source, e.sourceHandle);
        StorageCache.store(
          `${cacheId}.json`,
          dataValuesToResponses(e.source, label, values),
        );
        return cacheId;
      }),
    [id, inputEdgesForNode, getNode, nodeOutput],
  );
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);

  const [lastResponses, setLastResponses] = useState<LLMResponse[]>([]);
  const [invalidScores, setInvalidScores] = useState<InvalidScores[]>([]);

  // Variables and metavariables of the inputs, as candidates for the ground-truth label
  const [labelOptions, setLabelOptions] = useState<
    { value: string; label: string }[]
  >(
    data.labelVar
      ? [
          {
            value: data.labelVar,
            label: data.labelVar.startsWith("__meta_")
              ? `${data.labelVar.slice("__meta_".length)} (metavariable)`
              : data.labelVar,
          },
        ]
      : [],
  );
  const refreshLabelOptions = useCallback(() => {
    const input_node_ids = resolveInputIds();
    if (input_node_ids.length === 0) return;
    grabResponses(input_node_ids)
      .then((resps) => {
        const vars = new Set<string>();
        const metavars = new Set<string>();
        resps.forEach((r) => {
          Object.keys(r.vars ?? {}).forEach((v) => vars.add(v));
          Object.keys(r.metavars ?? {}).forEach((v) => {
            if (!v.startsWith("__")) metavars.add(v);
          });
        });
        setLabelOptions([
          ...Array.from(vars).map((v) => ({ value: v, label: v })),
          ...Array.from(metavars)
            .filter((v) => !vars.has(v))
            .map((v) => ({
              value: `__meta_${v}`,
              label: `${v} (metavariable)`,
            })),
        ]);
      })
      .catch(() => {
        // soft fail: the inputs haven't been run yet
      });
  }, [id, resolveInputIds]);

  // Agreement with the label, and between judges, over the last run's scores
  const scoreSpec = useMemo(
    () => scoreSpecFrom(data.format, data.categories, data.scale),
    [data.format, data.categories, data.scale],
  );
  // The judges in the last run's scores, and whether they're keyed by judge
  const scoredJudges = useMemo(() => {
    const keyed = lastResponses.some((r) =>
      r.eval_res?.dtype?.startsWith("KeyValue"),
    );
    const judges = keyed
      ? Array.from(
          new Set(
            lastResponses.flatMap((r) =>
              (r.eval_res?.items ?? []).flatMap((i) =>
                typeof i === "object" ? Object.keys(i) : [],
              ),
            ),
          ),
        )
      : [data.grader?.name ?? "Judge"];
    return { keyed, judges };
  }, [lastResponses, data.grader]);
  const disagreements = useMemo(
    () =>
      lastResponses.length === 0 || scoreSpec.format === "open"
        ? []
        : findDisagreements(
            lastResponses,
            scoredJudges.judges,
            scoredJudges.keyed,
            scoreSpec,
            data.labelVar ?? undefined,
          ),
    [lastResponses, scoredJudges, scoreSpec, data.labelVar],
  );
  // Reliability tables for judges that state probabilities (e.g. Jev), against the label
  const reliabilityByJudge = useMemo(() => {
    const labelVar = data.labelVar;
    if (!labelVar || lastResponses.length === 0) return {};
    const withProbs = scoredJudges.judges.filter((judge) =>
      lastResponses.some((r) =>
        (r.eval_res?.probs ?? []).some((p) =>
          scoredJudges.keyed
            ? typeof p === "object" && p !== null && judge in p
            : typeof p === "number",
        ),
      ),
    );
    return Object.fromEntries(
      withProbs.map((judge) => [
        judge,
        reliability(
          lastResponses,
          judge,
          scoredJudges.keyed,
          scoreSpec,
          labelVar,
        ),
      ]),
    );
  }, [lastResponses, scoredJudges, scoreSpec, data.labelVar]);

  const agreement = useMemo(() => {
    if (lastResponses.length === 0 || scoreSpec.format === "open")
      return undefined;
    const { keyed, judges } = scoredJudges;
    if (!data.labelVar && judges.length < 2) return undefined;
    return judgeAgreement(
      lastResponses,
      judges,
      keyed,
      scoreSpec,
      data.labelVar ?? undefined,
    );
  }, [lastResponses, scoredJudges, scoreSpec, data.labelVar]);

  // Progress when querying responses
  const [progress, setProgress] = useState<QueryProgress | undefined>(
    undefined,
  );

  // On hover over the 'info' button, to preview the prompts that will be sent out
  const [promptPreviews, setPromptPreviews] = useState<PromptInfo[]>([]);
  const handlePreviewHover = () => {
    // Get the ids from the connected input nodes:
    const input_node_ids = resolveInputIds();
    if (input_node_ids.length === 0) {
      console.warn("No inputs for evaluator node.");
      return;
    }

    const promptText = llmEvaluatorRef?.current?.getPromptTemplate();
    if (!promptText) return;

    // Pull input data
    try {
      grabResponses(input_node_ids)
        .then(function (resp_objs) {
          const inputs = resp_objs
            .map((obj: LLMResponse) =>
              obj.responses.map((r: LLMResponseData, j: number) => ({
                text:
                  typeof r === "string" || typeof r === "number"
                    ? r
                    : undefined,
                image: typeof r === "object" && r.t === "img" ? r.d : undefined,
                fill_history: obj.vars,
                metavars: withResponseMetavars(obj.metavars, obj, j),
              })),
            )
            .flat();
          return generatePrompts(promptText, { __input: inputs });
        })
        .then(function (prompts) {
          setPromptPreviews(
            prompts.map(
              (p: PromptTemplate) =>
                new PromptInfo(
                  p.toString(),
                  extractSettingsVars(p.fill_history),
                ),
            ),
          );
        });
    } catch (err) {
      // soft fail
      console.error(err);
      setPromptPreviews([]);
    }
  };

  // What a run will do, for the Run button's tooltip. Set on hovering over it,
  // and cleared once a run starts, since the run changes what's cached.
  const [runTooltip, setRunTooltip] = useState<string | undefined>(undefined);

  const handleRunClick = useCallback(() => {
    // Get the ids from the connected input nodes:
    const input_node_ids = resolveInputIds();
    if (input_node_ids.length === 0) {
      console.warn("No inputs for evaluator node.");
      return;
    }

    setStatus(Status.LOADING);
    setRunTooltip(undefined);
    setProgress({ success: 2, error: 0 });

    const handleError = (err: Error | string) => {
      setProgress(undefined);
      if (
        err instanceof UserForcedPrematureExit ||
        CancelTracker.has(cancelId)
      ) {
        // Handle a premature cancelation
        console.log("Canceled.");
        setStatus(Status.NONE);
      } else {
        setStatus(Status.ERROR);
        if (showAlert) showAlert(typeof err === "string" ? err : err?.message);
      }
    };

    // Run LLM evaluator
    llmEvaluatorRef?.current
      ?.run(input_node_ids, setProgress, cancelId)
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
    resolveInputIds,
    llmEvaluatorRef,
    pingOutputNodes,
    setStatus,
    showDrawer,
    showAlert,
    cancelId,
    data.reasonBeforeScoring,
  ]);

  // What a run will do, for the Run button's tooltip, as the Prompt Node shows
  const handleRunHover = useCallback(() => {
    const input_node_ids = resolveInputIds();
    if (input_node_ids.length === 0) {
      setRunTooltip("Connect responses to score first.");
      return;
    }
    setRunTooltip("Checking the cache...");
    llmEvaluatorRef.current
      ?.countNewRequests(input_node_ids)
      .then((by_judge) => {
        setRunTooltip(runTooltipFor(by_judge));
      })
      .catch((err: Error) => setRunTooltip(err.message));
  }, [id, resolveInputIds]);

  // Right-click menu: clear the cached scores, so the judges are asked again
  const customContextMenuItems = useMemo(
    () => [
      {
        key: "clear_cache",
        icon: <IconEraser size="11pt" />,
        text: "Clear cached scores",
        onClick: () => {
          clearCachedScores(id);
          setDataPropsForNode(id, { judgeStats: [] });
          setLastResponses([]);
          setInvalidScores([]);
          setStatus(Status.NONE);
          setRunTooltip(undefined);
        },
      },
    ],
    [id],
  );

  const handleStopClick = useCallback(() => {
    llmEvaluatorRef?.current?.cancel(cancelId, () => setProgress(undefined));
    refreshCancelId();
    setStatus(Status.NONE);
  }, [cancelId, refreshCancelId]);

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
    <BaseNode
      classNames="evaluator-node"
      nodeId={id}
      contextMenuExts={customContextMenuItems}
    >
      <NodeLabel
        title={data.title ?? "LLM Scorer"}
        nodeId={id}
        icon={<IconRobot size="16px" />}
        status={status}
        isRunning={status === Status.LOADING}
        handleRunClick={handleRunClick}
        handleStopClick={handleStopClick}
        handleRunHover={handleRunHover}
        runButtonTooltip={runTooltip ?? "Run scorer over inputs"}
        customButtons={[
          ...(aiSupport
            ? [
                <AIGenRubricPopover
                  key="ai-popover"
                  format={data.format ?? OutputFormat.Bin}
                  currentRubric={data.prompt ?? ""}
                  onGeneratedRubric={(rubric) =>
                    llmEvaluatorRef.current?.setPrompt(rubric)
                  }
                />,
              ]
            : []),
          <PromptListPopover
            key="prompt-previews"
            promptInfos={promptPreviews}
            onHover={handlePreviewHover}
            onClick={openInfoModal}
          />,
        ]}
      />
      <LLMResponseInspectorModal
        ref={inspectModal}
        jsonResponses={lastResponses}
        judgesPanel={
          <JudgeAgreementView
            summary={agreement}
            numeric={scoreSpec.format === "num"}
            labelVar={data.labelVar ?? undefined}
            invalid={invalidScores}
            disagreements={disagreements}
            judges={scoredJudges.judges}
            judgeStats={data.judgeStats}
            reliabilityByJudge={reliabilityByJudge}
          />
        }
      />
      <PromptListModal
        promptPreviews={promptPreviews}
        infoModalOpened={infoModalOpened}
        closeInfoModal={closeInfoModal}
      />

      <div className="llm-scorer-container">
        <LLMEvaluatorComponent
          ref={llmEvaluatorRef}
          prompt={data.prompt}
          onPromptEdit={(prompt: string) => {
            setDataPropsForNode(id, { prompt });
            setStatus(Status.WARNING);
          }}
          reasonBeforeScoring={data.reasonBeforeScoring}
          onReasonBeforeScoringChange={(newValue) =>
            setDataPropsForNode(id, { reasonBeforeScoring: newValue })
          }
          onLLMGraderChange={(new_grader) =>
            setDataPropsForNode(id, { grader: new_grader })
          }
          onLLMGradersChange={(new_graders) => {
            setDataPropsForNode(id, { graders: new_graders });
            setStatus(Status.WARNING);
          }}
          onFormatChange={(new_format) =>
            setDataPropsForNode(id, { format: new_format })
          }
          onCategoriesChange={(categories) => {
            setDataPropsForNode(id, { categories });
            setStatus(Status.WARNING);
          }}
          onScaleChange={(scale) => {
            setDataPropsForNode(id, { scale });
            setStatus(Status.WARNING);
          }}
          onInvalidScores={setInvalidScores}
          onJudgeStats={(judgeStats) =>
            setDataPropsForNode(id, { judgeStats: judgeStats as Dict[] })
          }
          grader={data.grader}
          graders={data.graders}
          allowMultipleJudges={true}
          format={data.format}
          categories={data.categories}
          scale={data.scale}
          id={id}
          showUserInstruction={true}
        />

        {data.format !== OutputFormat.Any && (
          <Tooltip
            label="An input column with each response's true label, to measure how often each judge agrees with it"
            multiline
            width={240}
            withArrow
            openDelay={500}
            withinPortal
          >
            <Group spacing={6} mt="xs" noWrap>
              <Text
                size="sm"
                fw={500}
                pl="2px"
                style={{ whiteSpace: "nowrap" }}
              >
                Compare to
              </Text>
              <Select
                size="xs"
                placeholder="No label"
                clearable
                searchable
                data={labelOptions}
                value={data.labelVar ?? null}
                onDropdownOpen={refreshLabelOptions}
                onChange={(v) => setDataPropsForNode(id, { labelVar: v })}
                className="nodrag"
                style={{ flex: 1 }}
                withinPortal
              />
            </Group>
          </Tooltip>
        )}
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
