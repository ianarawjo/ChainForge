import React, { useState } from "react";
import {
  Modal,
  Button,
  Group,
  Stepper,
  Title,
  Text,
  Card,
  Stack,
  Anchor,
  List,
  Flex,
} from "@mantine/core";
import { EvalCriteria, EvalGenReport } from "./backend/evalgen/typing";

/*
    PROPS FOR STEPPER SCREEN COMPONENTS
 */
interface WelcomeStepProps {
  onNext: () => void;
}

interface FeedbackStepProps {
  onNext: () => void;
  onPrevious: () => void;
  // setFeedbackData: (feedback: FeedbackItem[]) => void;
}

interface CriteriaStepProps {
  onNext: () => void;
  onPrevious: () => void;
  // feedbackData: FeedbackItem[];
  // setCriteriaData: (criteria: EvalCriteria[]) => void;
}

interface GradingStepProps {
  onNext: () => void;
  onPrevious: () => void;
  // criteriaData: EvalCriteria[];
  // setGradingData: (grades: GradeData) => void;
}

interface ResultsStepProps {
  onPrevious: () => void;
  onComplete: () => void;
  // criteriaData: Criterion[];
  // gradingData: GradeData;
}

// Main wizard component props
interface EvalGenWizardProps {
  opened: boolean;
  onClose: () => void;
  onComplete: (result: EvalGenReport) => void;
}

/*
    STEPPER SCREEN COMPONENTS
 */
const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => (
  <Stack spacing="md" m="lg" p="lg" mb={120}>
    <Title order={2}>Welcome to the EvalGen Wizard</Title>
    <Text>
      This wizard will guide you through creating automated evaluators for LLM
      responses that are aligned with your preferences. You'll look at data, 
      define what you care about, apply those criteria to grade
      data, and refine your criteria as you see more outputs. EvalGen then
      generates automated evaluators that implement each criteria, chooses
      implementations most aligned with your grades, and reports how aligned
      they are. 
    </Text>
    <Text>EvalGen is backed up by our{" "}
      <Anchor
        href="https://dl.acm.org/doi/abs/10.1145/3654777.3676450"
        target="_blank"
      >
        empirical research at UIST 2024
      </Anchor>, and is inspired by similar inductive processes in grounded theory and heuristic evaluation. Currently, Evalgen:</Text>
    <List>
      <List.Item>
        Only generates <b>assertions (pass/fail tests)</b>. Numeric and categorical
        evaluators are not included.
      </List.Item>
      <List.Item>
        Asks for grades on a <b>per-criteria</b> basis on the main grading screen. This
        is the chief difference from our paper.
      </List.Item>
      <List.Item>
        Requires access to the GenAI features of ChainForge. Set up the Provider
        you wish to use for this in your Global Settings view. The Provider must
        be powerful enough to generate code. (By default, it is OpenAI.)
      </List.Item>
      <List.Item>
        Should be run on the outputs of <b>already-run</b> Prompt Nodes (LLM responses).
      </List.Item>
      <List.Item>
        EvalGen will send off many requests during usage. 🔔 <b>By using Evalgen,
        you take full responsibility for credit usage.</b>
      </List.Item>
    </List>
    <Text>Currently, EvalGen does NOT:</Text>
    <List>
      <List.Item>
        Work on imported spreadsheets of data (although if you are interested in
        this, raise a Pull Request).
      </List.Item>
      <List.Item>
        Generate code that uses third-party libraries. For safety, LLM-generated
        Python code is run sandboxed in the browser with pyodide. (If your eval
        criteria implementation must use a third-party library, we suggest you
        use ChainForge’s genAI features on the specific eval node, outside this
        wizard.)
      </List.Item>
    </List>
    <Text>We have captured the following about your context:</Text>
    <ul>
      <li>…</li>
      <li>[x] Use this info when helping me think of evaluation criteria</li>
    </ul>
    <Text>
      After EvalGen finishes, the chosen evaluators appear in the MultiEval
      node. You can export evaluator details by right-clicking the node and
      selecting Copy Eval Specs.
    </Text>
    <Text>
      EvalGen is in Beta. To improve it, provide feedback on our Github Issues
      or Discussion pages, or raise a Pull Request with the changes.
    </Text>
    <Button onClick={onNext} fullWidth mt="xl">
      Get Started
    </Button>
  </Stack>
);

const FeedbackStep: React.FC<FeedbackStepProps> = ({ onNext, onPrevious }) => {
  // State for thumbs up/down feedback and written comments
  const [feedback, setFeedback] = useState([]);

  const handleSubmit = () => {
    // setFeedbackData(feedback);
    onNext();
  };

  return (
    <Stack spacing="lg">
      <Title order={3}>Provide Feedback on Some Model Outputs</Title>

      {/* TODO: Implement thumbs up/down feedback UI with written comments */}
      <Text>
        TODO: Display LLM responses with thumbs up/down controls and comment
        field
      </Text>

      <Group position="apart" mt="xl">
        <Button variant="default" onClick={onPrevious}>
          Back
        </Button>
        <Button onClick={handleSubmit}>Continue</Button>
      </Group>
    </Stack>
  );
};

const CriteriaStep: React.FC<CriteriaStepProps> = ({ onNext, onPrevious }) => {
  // State for criteria cards
  const [criteria, setCriteria] = useState([]);
  const [newCriteriaText, setNewCriteriaText] = useState("");

  // TODO: Use feedbackData to generate initial criteria when component mounts

  const handleAddCriteria = () => {
    // TODO: Add new criteria based on text input
  };

  const handleModifyCriteria = (uid: string, newText: string) => {
    // TODO: Modify existing criteria
  };

  const handleRemoveCriteria = (uid: string) => {
    // TODO: Remove criteria
  };

  const handleGenerateCriteria = () => {
    // TODO: Generate new criteria based on user input
  };

  const handleSubmit = () => {
    // setCriteriaData(criteria);
    onNext();
  };

  return (
    <Stack spacing="lg">
      <Title order={3}>Define Evaluation Criteria</Title>
      <Text>
        Based on your feedback, we&apos;ve generated these starter criteria:
      </Text>

      {/* TODO: Implement criteria cards UI */}
      <Text>TODO: Display criteria cards with edit/delete functionality</Text>

      {/* TODO: Implement input for new criteria */}
      <Text>TODO: Input field for adding new criteria</Text>

      <Group position="apart" mt="xl">
        <Button variant="default" onClick={onPrevious}>
          Back
        </Button>
        <Button onClick={handleSubmit}>Ready to Grade!</Button>
      </Group>
    </Stack>
  );
};

const GradingStep: React.FC<GradingStepProps> = ({ onNext, onPrevious }) => {
  // State for per-criteria grades
  const [grades, setGrades] = useState({});

  // TODO: Set up grading UI for each criteria

  const handleSubmit = () => {
    // setGradingData(grades);
    onNext();
  };

  return (
    <Stack spacing="lg">
      <Title order={3}>Grade LLM Responses By Criteria</Title>
      <Text>Please evaluate each response according to your criteria:</Text>

      {/* TODO: Implement grading UI per criteria */}
      <Text>TODO: Display grading interface for each criteria</Text>

      <Group position="apart" mt="xl">
        <Button variant="default" onClick={onPrevious}>
          Back
        </Button>
        <Button onClick={handleSubmit}>I&apos;m tired, process results</Button>
      </Group>
    </Stack>
  );
};

const ResultsStep: React.FC<ResultsStepProps> = ({
  onPrevious,
  onComplete,
}) => {
  // TODO: Calculate alignment scores based on criteria and grading data
  const alignmentScores = {};

  return (
    <Stack spacing="lg">
      <Title order={3}>Evaluation Results</Title>
      <Text>
        Here&apos;s how well each evaluation criteria aligns with your grades:
      </Text>

      {/* TODO: Display alignment scores */}
      <Text>TODO: Show alignment scores for each criteria</Text>

      <Group position="apart" mt="xl">
        <Button variant="default" onClick={onPrevious}>
          Back
        </Button>
        <Button onClick={onComplete} color="green">
          Done
        </Button>
      </Group>
    </Stack>
  );
};

const EvalGenWizard: React.FC<EvalGenWizardProps> = ({
  opened,
  onClose,
  onComplete,
}) => {
  const [active, setActive] = useState(0);

  // State for data collected across steps
  const [feedbackData, setFeedbackData] = useState([]);
  const [criteriaData, setCriteriaData] = useState([]);
  const [gradingData, setGradingData] = useState({});

  const handleNext = () => {
    setActive((current) => current + 1);
  };

  const handlePrevious = () => {
    setActive((current) => current - 1);
  };

  const handleComplete = () => {
    // Return final data to the caller
    onComplete({
      criteria: criteriaData,
      failureCoverage: 0,
      falseFailureRate: 0,
      // grades: gradingData,
      // alignmentScores: {} // TODO: Include actual alignment scores
    });
    onClose();
  };

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
      {active === 0 && <WelcomeStep onNext={handleNext} />}

      {active === 1 && (
        <FeedbackStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          // setFeedbackData={setFeedbackData}
        />
      )}

      {active === 2 && (
        <CriteriaStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          // feedbackData={feedbackData}
          // setCriteriaData={setCriteriaData}
        />
      )}

      {active === 3 && (
        <GradingStep
          onNext={handleNext}
          onPrevious={handlePrevious}
          // criteriaData={criteriaData}
          // setGradingData={setGradingData}
        />
      )}

      {active === 4 && (
        <ResultsStep
          onPrevious={handlePrevious}
          onComplete={handleComplete}
          // criteriaData={criteriaData}
          // gradingData={gradingData}
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
          <Button variant="default">&lt; Back</Button>
          <Button>Next &gt;</Button>
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
