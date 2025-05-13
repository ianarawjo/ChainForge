/**
 * EvalGen 2.0
 *
 * Ian Arawjo, Shreya Shankar, J.D. Zamfirescu, Helen Weixu Chen
 *
 * This file and its directory concerns the front-end to evaluation generator, EvalGen.
 * EvalGen supports users in generating eval funcs (here binary assertions) and aligning them with their preferences.
 *
 * Specifically, the modal lets users:
 *  - make and refine criteria to grade on (on the left)
 *  - grade responses (on the right)
 *  - while in the backend, an LLM is generating candidate assertions and selected the ones most aligned with user grades
 * As the user grades responses, they add/refine existing criteria.
 * This modal presents a shared interface where criteria can be iterated on *alongside* grading.
 * This is because of **criteria drift,** a phenomenon identified observing users in EvalGen 1.0 (unreleased).
 *
 * An AI (LLM call) can also suggest criteria based on the implicit context (inputs, such as the prompt)
 * and user feedback during grading (written feedback about failing outputs whose failure couldn't be classified under the immediate criteria set.)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  EvalCriteria,
  EvalFunctionSetReport,
  EvalGenReport,
} from "../backend/evalgen/typing";
import { Dict, LLMResponse, RatingDict } from "../backend/typing";
import useStore from "../store";
import { escapeBraces } from "../backend/template";
import StorageCache, { StringLookup } from "../backend/cache";
import { generateLLMEvaluationCriteria } from "../backend/evalgen/utils";
import { Button, Flex, Modal, Stepper } from "@mantine/core";
import WelcomeStep from "./WelcomeStep";
import FeedbackStep from "./FeedbackStep";
import PickCriteriaStep from "./PickCriteriaStep";
import ReportCardStep from "./ReportCardStep";
import GradingResponsesStep from "./GradeResponsesStep";
import {
  batchResponsesByUID,
  deepcopy,
  sampleRandomElements,
} from "../backend/utils";
import { getRatingKeyForResponse } from "../ResponseRatingToolbar";
import EvaluationFunctionExecutor from "../backend/evalgen/executor";
import { getAIFeaturesModels } from "../backend/ai";

// Main wizard component props
interface EvalGenWizardProps {
  opened: boolean;
  onClose: () => void;
  onComplete: (result: EvalGenReport) => void;
  responses: LLMResponse[];
}

const EvalGenWizard: React.FC<EvalGenWizardProps> = ({
  opened,
  onClose,
  onComplete,
  responses, // The LLM responses to operate over
}) => {
  // The active screen (stage) of EvalGen
  const [active, setActive] = useState(0);

  // From global state
  const apiKeys = useStore((state) => state.apiKeys);
  const genAIFeaturesProvider = useStore((state) => state.aiFeaturesProvider);
  const genAIModelNames = useMemo(() => {
    const models = getAIFeaturesModels(genAIFeaturesProvider);
    return {
      large: models.large,
      small: models.small,
    };
  }, [genAIFeaturesProvider]);

  // Regroup input responses by batch UID, whenever jsonResponses changes
  const batchedResponses = useMemo(
    () => (responses ? batchResponsesByUID(responses) : []),
    [responses],
  );

  // For updating the global human ratings state
  const setState = useStore((store) => store.setState);
  const updateGlobalRating = useCallback(
    (uid: string, label: string, payload: RatingDict) => {
      const key = getRatingKeyForResponse(uid, label);
      const safe_payload = deepcopy(payload);
      setState(key, safe_payload);
      StorageCache.store(key, safe_payload);
    },
    [setState],
  );

  // Criteria the user defines across the stages
  const [criteria, setCriteria] = useState<EvalCriteria[]>([]);
  const [onNextCallback, setOnNextCallback] = useState(() => () => {});

  // Per-criteria grades (indexed by uid of response, then uid of criteria)
  const [perCriteriaGrades, setPerCriteriaGrades] = useState<
    Dict<Dict<boolean | undefined>>
  >({});
  const [annotation, setAnnotation] = useState<string | undefined>(undefined);
  const setPerCriteriaGrade = (
    responseUID: string,
    criteriaUID: string,
    newGrade: boolean | undefined,
  ) => {
    setPerCriteriaGrades((grades) => {
      if (!grades[responseUID]) grades[responseUID] = {};
      grades[responseUID][criteriaUID] = newGrade;
      updateGlobalRating(responseUID, "perCriteriaGrades", grades[responseUID]);

      // If the EvalGen executor is running, update the per-criteria grade for this sample:
      executor?.setGradeForExample(responseUID, grades[responseUID]);

      return { ...grades };
    });
  };
  const numResponsesGraded = useMemo(() => {
    let count = 0;
    for (const uid in perCriteriaGrades) {
      const gs = perCriteriaGrades[uid];
      if (Object.values(gs).some((v) => v !== undefined && v !== null))
        count += 1;
    }
    return count;
  }, [perCriteriaGrades]);
  const minNumToGrade = useMemo(() => {
    return Math.min(10, Math.ceil(batchedResponses.length * 0.5));
  }, [batchedResponses]);
  const minNumToGradeToStartExecutor = useMemo(() => {
    return Math.min(5, Math.ceil(batchedResponses.length * 0.25));
  }, [batchedResponses]);

  // The EvalGen object responsible for generating, implementing, and filtering candidate implementations
  // :: Used on screen 4 (when `active` === 3).
  const [executor, setExecutor] = useState<EvaluationFunctionExecutor | null>(
    null,
  );
  const [evalGenReport, setEvalGenReport] =
    useState<EvalFunctionSetReport | null>(null);

  // Logs and state from the EvalGen backend
  const [logs, setLogs] = useState<{ date: Date; message: string }[]>([]);
  const [numCallsMade, setNumCallsMade] = useState({ strong: 0, weak: 0 });
  const [execProgress, setExecProgress] = useState(0);

  // The samples to pass the executor / grading responses features. This will be bounded
  // by maxNumSamplesForExecutor, instead of the whole dataset.
  const samplesForExecutor = useMemo(() => {
    // The max number of samples (responses) to pass the executor. This controls how many requests will
    // need to be sent off and how many evaluation function executions are performed.
    // TODO: Give the user some control over this.
    const maxNumSamplesForExecutor = 16;

    // Sample from the full set of responses, if needed:
    if (batchedResponses.length > maxNumSamplesForExecutor)
      return sampleRandomElements(responses, maxNumSamplesForExecutor);
    else return batchedResponses.slice();
  }, [batchedResponses]);

  // When the user is done per-criteria grading
  const handleDonePerCriteriaGrading = useCallback(async () => {
    // Await completion of all gen + execution of eval funcs
    await executor?.waitForCompletion();

    // Filtering eval funcs by grades and present results
    const filteredFunctions =
      (await executor?.filterEvaluationFunctions(0.25)) ?? null;
    console.log("Filtered Functions: ", filteredFunctions);

    // Return selected implementations to caller
    // TODO
    console.warn(filteredFunctions);

    setActive(4); // Move to the report card step
    setEvalGenReport(filteredFunctions);
  }, [executor]);

  // Update executor whenever resps, grades, or criteria change
  useEffect(() => {
    if (
      criteria.length === 0 ||
      numResponsesGraded < minNumToGradeToStartExecutor
    )
      return;
    if (!executor) {
      const addLog = (message: string) => {
        setLogs((prevLogs) => [...prevLogs, { date: new Date(), message }]);
      };

      const ex = new EvaluationFunctionExecutor(
        genAIModelNames,
        apiKeys,
        getLikelyPromptTemplateAsContext(samplesForExecutor) ?? "",
        samplesForExecutor,
        criteria,
        (strong, weak) => {
          // Callback to update GPT call counts
          setNumCallsMade((n_calls) => {
            n_calls.strong += strong;
            n_calls.weak += weak;
            return { ...n_calls };
          });
        },
        addLog,
        undefined, // don't pass any holistic grades at this stage
        perCriteriaGrades,
      );
      setExecutor(ex);

      // Start executor process
      ex.start((progress) => {
        setExecProgress(progress?.success ?? 0);
      });
    } else if (executor) {
      // Update criteria in executor
      executor.updateCriteria(criteria);
    }
  }, [
    criteria,
    samplesForExecutor,
    numResponsesGraded,
    minNumToGradeToStartExecutor,
  ]);

  const handleNext = useCallback(() => {
    setActive((current) => Math.min(4, current + 1));
  }, []);

  const handlePrevious = useCallback(() => {
    setActive((current) => Math.max(0, current - 1));
  }, []);

  const handleComplete = () => {
    // Return final data to the caller
    onComplete({
      criteria: criteria,
      failureCoverage: 0,
      falseFailureRate: 0,
      // grades: gradingData,
      // alignmentScores: {} // TODO: Include actual alignment scores
    });
    onClose();
  };

  const getLikelyPromptTemplateAsContext = (resps: LLMResponse[]) => {
    // Attempt to infer the prompt template used to generate the responses:
    const prompts = new Set<string>();
    for (const resp_obj of resps) {
      const pt = resp_obj?.metavars?.__pt;
      if (pt !== undefined) {
        prompts.add(StringLookup.get(pt) as string);
      }
    }

    if (prompts.size === 0) return null;

    // Pick a prompt template at random to serve as context....
    return escapeBraces(prompts.values().next().value ?? "");
  };

  async function genCriteriaFromContext(responses: LLMResponse[]) {
    // Get the context from the input responses
    const inputPromptTemplate =
      getLikelyPromptTemplateAsContext(batchedResponses);

    if (inputPromptTemplate === null) {
      console.error("No context found. Cannot proceed.");
      return;
    }

    // Attempt to generate criteria using an LLM
    return await generateLLMEvaluationCriteria(
      inputPromptTemplate,
      genAIModelNames.large,
      apiKeys,
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      // title="EvalGen Wizard"
      size="95%"
      padding="md"
      // keepMounted
      // closeOnClickOutside={true}
      styles={{
        inner: {
          padding: "5%", // This creates space around the modal (10% total)
        },
        header: {
          padding: "0px",
          backgroundColor: "transparent",
          // borderBottom: "1px solid black",
        },
        content: {
          height: "100%", // Fill the available space
          maxHeight: "90vh", // Limit to 90% of viewport height
          display: "flex",
          flexDirection: "column",
        },
        body: {
          flex: 1, // This makes the body expand to fill available space
          overflow: "auto", // Add scrolling if content is too tall
        },
      }}
    >
      {active === 0 && <WelcomeStep setOnNextCallback={setOnNextCallback} />}

      {active === 1 && (
        <FeedbackStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          responses={batchedResponses}
          setOnNextCallback={setOnNextCallback}
        />
      )}

      {active === 2 && (
        <PickCriteriaStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          criteria={criteria}
          setCriteria={setCriteria}
          genCriteriaFromContext={() =>
            genCriteriaFromContext(batchedResponses)
          }
          genAIModelNames={genAIModelNames}
          setOnNextCallback={setOnNextCallback}
        />
      )}

      {active === 3 && (
        <GradingResponsesStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          genAIModelNames={genAIModelNames}
          numCallsMade={numCallsMade}
          executor={executor}
          logs={logs}
          responses={samplesForExecutor} // This is deliberately not the entire list of responses, for now.
          criteria={criteria}
          setCriteria={setCriteria}
          grades={perCriteriaGrades}
          setPerCriteriaGrade={setPerCriteriaGrade}
          setOnNextCallback={setOnNextCallback}
        />
      )}

      {active === 4 && (
        <ReportCardStep
          onPrevious={handlePrevious}
          onFinish={handleComplete}
          criteria={criteria}
          setOnNextCallback={setOnNextCallback}
          report={evalGenReport}
        />
      )}

      {/* Sticky footer - button and steppers */}
      <div
        style={{
          position: "fixed",
          bottom: 106,
          padding: "10px",
          width: "95%",
        }}
      >
        <Flex justify="space-between">
          <Button
            variant="default"
            onClick={handlePrevious}
            disabled={active === 0}
          >
            &lt; Back
          </Button>

          <Button
            color={active === 3 ? "green" : "blue"}
            onClick={active !== 3 ? handleNext : handleDonePerCriteriaGrading}
            disabled={
              active === 4 ||
              (active === 3 && numResponsesGraded < minNumToGrade)
            }
          >
            {active === 3
              ? numResponsesGraded >= minNumToGrade
                ? "I think I'm done"
                : `Grade at least ${minNumToGrade - numResponsesGraded} more`
              : "Next >"}
          </Button>
        </Flex>
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          background: "white",
          padding: "10px",
          borderTop: "1px solid #ddd",
          width: "95%",
        }}
      >
        <Stepper active={active} mb="xl">
          <Stepper.Step label="Welcome" description="Get started">
            {/* Step content is rendered below */}
          </Stepper.Step>
          <Stepper.Step label="Feedback" description="Rate some responses">
            {/* Step content is rendered below */}
          </Stepper.Step>
          <Stepper.Step label="Criteria" description="Define eval criteria">
            {/* Step content is rendered below */}
          </Stepper.Step>
          <Stepper.Step
            label="Grading and Generation"
            description="Grade by criteria, while we generate implementations"
          >
            {/* Step content is rendered below */}
          </Stepper.Step>
          <Stepper.Step label="Results" description="View alignment">
            {/* Step content is rendered below */}
          </Stepper.Step>
        </Stepper>
      </div>
    </Modal>
  );
};

export default EvalGenWizard;
