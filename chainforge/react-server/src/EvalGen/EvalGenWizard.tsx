import React, { useCallback, useState } from "react";
import { EvalCriteria, EvalGenReport } from "../backend/evalgen/typing";
import { LLMResponse } from "../backend/typing";
import useStore from "../store";
import { escapeBraces } from "../backend/template";
import { StringLookup } from "../backend/cache";
import { generateLLMEvaluationCriteria } from "../backend/evalgen/utils";
import { Button, Flex, Modal, Stepper } from "@mantine/core";
import WelcomeStep from "./WelcomeStep";
import FeedbackStep from "./FeedbackStep";
import PickCriteriaStep from "./PickCriteriaStep";
import ReportCardStep from "./ReportCardStep";
import GradingResponsesStep from "./GradeResponsesStep";

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
  const [active, setActive] = useState(0);

  // Criteria the user defines across the stages
  const [criteria, setCriteria] = useState<EvalCriteria[]>([]);
  const [onNextCallback, setOnNextCallback] = useState(() => () => {});

  // Global state
  const apiKeys = useStore((state) => state.apiKeys);

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
    const inputPromptTemplate = getLikelyPromptTemplateAsContext(responses);

    if (inputPromptTemplate === null) {
      console.error("No context found. Cannot proceed.");
      return;
    }

    // Attempt to generate criteria using an LLM
    return await generateLLMEvaluationCriteria(inputPromptTemplate, apiKeys);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="EvalGen Wizard"
      size="90%"
      padding="md"
      // keepMounted
      // closeOnClickOutside={true}
      style={{ position: "relative", left: "-5%" }}
      styles={{
        inner: {
          padding: "5%", // This creates space around the modal (10% total)
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
          responses={responses}
          setOnNextCallback={setOnNextCallback}
        />
      )}

      {active === 2 && (
        <PickCriteriaStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          criteria={criteria}
          setCriteria={setCriteria}
          genCriteriaFromContext={() => genCriteriaFromContext(responses ?? [])}
          setOnNextCallback={setOnNextCallback}
        />
      )}

      {active === 3 && (
        <GradingResponsesStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          responses={responses}
          criteria={criteria}
          setCriteria={setCriteria}
          setOnNextCallback={setOnNextCallback}
        />
      )}

      {active === 4 && (
        <ReportCardStep
          onPrevious={handlePrevious}
          onComplete={handleComplete}
          criteria={criteria}
          setOnNextCallback={setOnNextCallback}
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

          <Button onClick={handleNext} disabled={active === 4}>
            Next &gt;
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
