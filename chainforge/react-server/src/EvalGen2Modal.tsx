import React, { useMemo, useState } from "react";
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
  TextInput,
  ScrollArea,
  SimpleGrid,
  Tooltip,
  Skeleton,
  Code,
  Divider,
  Checkbox,
  Textarea,
  Popover,
  RingProgress,
  Switch,
  Accordion,
  useMantineTheme,
} from "@mantine/core";
import {
  EvalCriteria,
  EvalFunctionReport,
  EvalGenReport,
} from "./backend/evalgen/typing";
import {
  IconCode,
  IconRepeat,
  IconRobot,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { generateLLMEvaluationCriteria } from "./backend/evalgen/utils";
import useStore from "./store";
import { v4 as uuid } from "uuid";
import Plot from "react-plotly.js";
import { useDisclosure } from "@mantine/hooks";
import { accuracyToColor, cmatrixTextAnnotations } from "./backend/utils";
import { LLMResponse } from "./backend/typing";
import { escapeBraces } from "./backend/template";
import { StringLookup } from "./backend/cache";

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
  criteria: EvalCriteria[];
  setCriteria: React.Dispatch<React.SetStateAction<EvalCriteria[]>>;
  genCriteriaFromContext: () => Promise<EvalCriteria[] | undefined>;
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
  responses: LLMResponse[] | undefined;
}

/*
    STEPPER SCREEN COMPONENTS
 */
const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => (
  <Stack spacing="md" m="lg" p="lg" mb={120}>
    <Title order={2}>Welcome to the EvalGen Wizard</Title>
    <Text>
      This wizard will guide you through creating automated evaluators for LLM
      responses that are aligned with your preferences. You`&apos;ll look at
      data, define what you care about, apply those criteria to grade data, and
      refine your criteria as you see more outputs. EvalGen then generates
      automated evaluators that implement each criteria, chooses implementations
      most aligned with your grades, and reports how aligned they are.
    </Text>
    <Text>
      EvalGen is backed up by our{" "}
      <Anchor
        href="https://dl.acm.org/doi/abs/10.1145/3654777.3676450"
        target="_blank"
      >
        empirical research at UIST 2024
      </Anchor>
      , and is inspired by similar inductive processes in grounded theory and
      heuristic evaluation. Currently, Evalgen:
    </Text>
    <List>
      <List.Item>
        Only generates <b>assertions (pass/fail tests)</b>. Numeric and
        categorical evaluators are not included.
      </List.Item>
      <List.Item>
        Asks for grades on a <b>per-criteria</b> basis on the main grading
        screen. This is the chief difference from our paper.
      </List.Item>
      <List.Item>
        Requires access to the GenAI features of ChainForge. Set up the Provider
        you wish to use for this in your Global Settings view. The Provider must
        be powerful enough to generate code. (By default, it is OpenAI.)
      </List.Item>
      <List.Item>
        Should be run on the outputs of <b>already-run</b> Prompt Nodes (LLM
        responses).
      </List.Item>
      <List.Item>
        EvalGen will send off many requests during usage. 🔔{" "}
        <b>By using Evalgen, you take full responsibility for credit usage.</b>
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

interface CriteriaCardProps {
  title: string;
  description: string;
  evalMethod: string;
  onTitleChange?: (newTitle: string) => void;
  onDescriptionChange?: (newDesc: string) => void;
  onEvalMethodChange?: (newEvalMethod: string) => void;
  onRemove?: () => void;
  reportMode?: boolean;
  evalFuncReport?: EvalFunctionReport;
  onCheck?: (newChecked: boolean) => void;
  otherFuncs?: EvalFunctionReport[];
}

const CriteriaCard: React.FC<CriteriaCardProps> = function CriteriaCard({
  title,
  description,
  evalMethod,
  onTitleChange,
  onDescriptionChange,
  onEvalMethodChange,
  onRemove,
  reportMode,
  evalFuncReport,
  onCheck,
  otherFuncs,
}) {
  const [checked, setChecked] = useState(true);
  const [codeChecked, setCodeChecked] = useState(evalMethod === "code");
  const theme = useMantineTheme();

  // Report card specific
  const [openedCMatrix, { close: closeCMatrix, open: openCMatrix }] =
    useDisclosure(false);
  const [viewedCode, { close: closeViewedCode, open: openViewedCode }] =
    useDisclosure(false);
  const cMatrixPlot = useMemo(() => {
    if (!evalFuncReport) return undefined;
    const x = ["Pred.<br>fail", "Pred.<br>pass"];
    const y = ["Human<br>pass", "Human<br>fail"];
    const z = [
      [evalFuncReport.false_fail, evalFuncReport.true_pass],
      [evalFuncReport.true_fail, evalFuncReport.false_pass],
    ];
    return (
      <Plot
        data={[
          {
            z,
            x,
            y,
            xgap: 2,
            ygap: 2,
            type: "heatmap",
            colorscale: "Blues",
            showscale: false,
            showlegend: false,
          },
        ]}
        layout={{
          width: 160,
          height: 160,
          margin: { t: 10, b: 40, l: 50, r: 0 },
          annotations: cmatrixTextAnnotations(x, y, z),
        }}
      />
    );
  }, [evalFuncReport]);
  const reportAccuracyRing = useMemo(() => {
    if (!evalFuncReport) return undefined;
    return {
      percent: Math.floor((evalFuncReport.alignment ?? 0) * 100),
      color: accuracyToColor(evalFuncReport.alignment ?? 0),
    };
  }, [evalFuncReport]);

  const setCheckedAndRealign = (newChecked: boolean) => {
    setChecked(newChecked);

    // oncheck is a callback to the parent to update the selected eval functions
    // oncheck is an awaitable function
    if (onCheck && evalFuncReport) onCheck(newChecked);
  };

  const unselectedImplementations = useMemo(
    () =>
      otherFuncs !== undefined && otherFuncs.length > 0
        ? otherFuncs.map((item, idx) => (
            <div key={idx}>
              <Code style={{ whiteSpace: "pre-wrap" }}>
                {item.evalFunction.code}
              </Code>
              <Divider />
            </div>
          ))
        : null,
    [otherFuncs],
  );

  return (
    <Card
      shadow="sm"
      padding="sm"
      pl="md"
      pb="xl"
      radius="md"
      withBorder
      style={{ backgroundColor: checked ? "#f2f7fc" : "#fff" }}
    >
      <div
        // onClick={() => setChecked(!checked)}
        onKeyUp={(e) => e.preventDefault()}
        className="checkcard"
      >
        <Tooltip label={checked ? "Don't use this" : "Use this"} withArrow>
          <Checkbox
            checked={checked}
            onChange={() => setCheckedAndRealign(!checked)}
            tabIndex={-1}
            size="xs"
            mr="sm"
            mt="xs"
            styles={{ input: { cursor: "pointer" } }}
            aria-hidden
          />
        </Tooltip>

        <div style={{ width: "100%" }}>
          <TextInput
            value={title}
            onChange={(e) =>
              onTitleChange ? onTitleChange(e.currentTarget.value) : null
            }
            mb={7}
            lh={1}
            styles={{
              input: {
                border: "none",
                borderWidth: "0px",
                padding: "0px",
                background: "transparent",
                fontWeight: 500,
                fontSize: "12pt",
                margin: "0px",
                height: "auto",
                minHeight: "auto",
              },
            }}
          />

          <Textarea
            value={description}
            onChange={(e) =>
              onDescriptionChange
                ? onDescriptionChange(e.currentTarget.value)
                : null
            }
            onClickCapture={(e) => e.stopPropagation()}
            styles={{
              input: {
                border: "none",
                borderWidth: "0px",
                paddingTop: "0px !important",
                paddingLeft: "0px",
                margin: "0px",
                color: "#444",
                background: "transparent",
                lineHeight: 1.1,
              },
            }}
            autosize
            minRows={2}
            maxRows={5}
            fz="sm"
            mb="xs"
            c="dimmed"
          />

          {reportMode && (
            <Popover
              opened={viewedCode}
              // offset={{ crossAxis: -20 }}
              withinPortal
              position="bottom"
              shadow="lg"
              withArrow
              width={400}
            >
              <Popover.Target>
                <Text
                  size="sm"
                  color="gray"
                  onMouseEnter={openViewedCode}
                  onMouseLeave={closeViewedCode}
                >
                  {codeChecked ? "Python" : "LLM"}
                </Text>
              </Popover.Target>
              <Popover.Dropdown>
                <Code style={{ whiteSpace: "pre-wrap" }}>
                  {evalFuncReport?.evalFunction.code}
                </Code>
              </Popover.Dropdown>
            </Popover>
          )}
        </div>

        {!reportMode ? (
          <Button
            size="xs"
            variant="subtle"
            compact
            color="gray"
            onClick={onRemove}
            pos="absolute"
            right="8px"
            top="8px"
            style={{ padding: "0px" }}
          >
            <IconTrash size={"95%"} />
          </Button>
        ) : (
          <></>
        )}

        {reportMode && reportAccuracyRing ? (
          <Stack spacing={0}>
            <Popover
              position="right"
              opened={openedCMatrix}
              offset={{ crossAxis: -20 }}
              withinPortal
              shadow="lg"
              withArrow
            >
              <Popover.Target>
                <RingProgress
                  size={100}
                  sections={[
                    {
                      value: reportAccuracyRing.percent,
                      color: reportAccuracyRing.color,
                    },
                  ]}
                  label={
                    <Text
                      color={reportAccuracyRing.color}
                      weight={700}
                      align="center"
                      size="lg"
                    >
                      {`${reportAccuracyRing.percent}%`}
                    </Text>
                  }
                  onMouseEnter={openCMatrix}
                  onMouseLeave={closeCMatrix}
                />
              </Popover.Target>
              <Popover.Dropdown>{cMatrixPlot}</Popover.Dropdown>
            </Popover>
            <Text align="center" size="xs" color="gray" maw="90%" lh={1.1}>
              Alignment with your grades
            </Text>
          </Stack>
        ) : (
          <></>
        )}

        {!reportMode ? (
          <Switch
            size="lg"
            color="gray"
            onLabel="Code"
            offLabel="LLM"
            pos="absolute"
            right="8px"
            bottom="10px"
            checked={codeChecked}
            onChange={(e) => {
              setCodeChecked(e.currentTarget.checked);
              if (onEvalMethodChange)
                onEvalMethodChange(e.currentTarget.checked ? "code" : "expert");
            }}
            thumbIcon={
              codeChecked ? (
                <IconCode
                  size="0.8rem"
                  color={theme.colors.teal[theme.fn.primaryShade()]}
                  stroke={3}
                />
              ) : (
                <IconRobot
                  size="0.8rem"
                  color={theme.colors.blue[theme.fn.primaryShade()]}
                  stroke={3}
                />
              )
            }
          />
        ) : (
          <></>
        )}
      </div>

      <div>
        {reportMode && (
          <Accordion>
            <Accordion.Item
              key={"Show Bad Implementations"}
              value={"Show Bad Implementations"}
            >
              <Accordion.Control>
                <Text size="sm"> Show Bad Implementations </Text>
              </Accordion.Control>
              <Accordion.Panel>{unselectedImplementations}</Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
      </div>
    </Card>
  );
};

const CriteriaStep: React.FC<CriteriaStepProps> = ({
  onNext,
  onPrevious,
  criteria, 
  setCriteria,
  genCriteriaFromContext,
}) => {
  // State for criteria cards
  const [addCriteriaValue, setAddCriteriaValue] = useState("");
  const [isLoadingCriteria, setIsLoadingCriteria] = useState(0);

  // Global state
  const apiKeys = useStore((state) => state.apiKeys);

  // An estimate of many requests the implementation executor will require (upper bound).
  const estimatedLLMRequestsToImplement = useMemo(() => {
    return 0; // TODO
    // const num_llm_evals = criteria.reduce(
    //   (acc, crit) => acc + (crit.eval_method === "expert" ? 1 : 0),
    //   0,
    // );
    // // The executor sends off one query per criteria to generate 3-5 candidates each.
    // // Each candidate LLM eval prompt will be run over all candidates.
    // return criteria.length + num_llm_evals * 5 * samples.length;
  }, [criteria]);

  const addCriteria = () => {
    // Add a loading Skeleton
    setIsLoadingCriteria((num) => num + 1);
    // Make async LLM call to expand criteria
    generateLLMEvaluationCriteria(
      "",
      apiKeys,
      `I've described a criteria I want to use to evaluate text. I want you to take the criteria and output a JSON object in the format below. 

CRITERIA: 
\`\`\`
${addCriteriaValue}
\`\`\`

Your response should contain a short title for the criteria ("shortname"), a description of the criteria in 2 sentences ("criteria"), and whether it should be evaluated with "code", or by an "expert" if the criteria is difficult to evaluate ("eval_method"). Your answer should be JSON within a \`\`\`json \`\`\` marker, with the following three fields: "criteria", "shortname", and "eval_method" (code or expert). The "criteria" should expand upon the user's input, the "shortname" should be a very brief title for the criteria, and this list should contain as many evaluation criteria as you can think of. Each evaluation criteria should test a unit concept that should evaluate to "true" in the ideal case. Only output JSON, nothing else.`, // prompt
      null, // system_msg
    )
      .then((evalCrits) => {
        // Take only the first
        setCriteria((crit) =>
          crit.concat([
            {
              ...evalCrits[0],
              uid: uuid(),
            },
          ]),
        );
        // Remove a loading Skeleton
        setIsLoadingCriteria((num) => num - 1);
      })
      .catch((err) => {
        console.error(err);
        setIsLoadingCriteria((num) => num - 1);
      });
  };
  const updateCriteria = (
    newValue: string,
    critIdx: number,
    propName: "shortname" | "criteria" | "eval_method",
  ) => {
    setCriteria((crit) => {
      if (propName in crit[critIdx])
        // @ts-expect-error This is hard to type because it's a wrapper over an accessor.
        crit[critIdx][propName] = newValue;
      return [...crit];
    });
  };

  const handleSubmit = () => {
    // setCriteriaData(criteria);
    onNext();
  };

  return (
    <Stack spacing="lg">
      <Title order={3}>Define Evaluation Criteria</Title>

      <div>
        <Text size="sm" pl="sm" mb="lg">
          Select criteria that you would like to evaluate responses on. Based on
          your chosen criteria, LLM will generate implementations of assertions.
          Afterwards, an optional human scoring pass can better align these
          implementations with your expectations.
        </Text>

        <Text size="sm" pl="sm" mb="lg" style={{ fontStyle: "italic" }}>
          Note: Due to rate limits and/or cost, think carefully before selecting more than 5
          criteria to be evaluated by LLMs.
        </Text>

        <Flex align="center" gap="lg">
          <TextInput
            label="Type a new criteria to add, then press Enter:"
            value={addCriteriaValue}
            onChange={(evt) => setAddCriteriaValue(evt.currentTarget.value)}
            placeholder="the response is valid JSON"
            mb="lg"
            pl="sm"
            pr="sm"
            w="100%"
            onKeyDown={(evt) => {
              if (evt.key === "Enter") {
                evt.preventDefault();
                addCriteria();
                setAddCriteriaValue("");
              }
            }}
          />
          <Button
            variant="filled"
            onClick={() => {
              if (isLoadingCriteria > 0) return;
              setIsLoadingCriteria(3);
              genCriteriaFromContext()
                .then((crit) =>
                  setCriteria(crit ? criteria.concat(crit) : criteria),
                )
                .finally(() => setIsLoadingCriteria(0));
            }}
          >
            <IconRepeat />
            <IconSparkles />
            &nbsp;Suggest more
          </Button>
        </Flex>

        <ScrollArea mih={300} h={500} mah={500}>
          <SimpleGrid cols={3} spacing="sm" verticalSpacing="sm" mb="lg">
            {criteria.map((c, idx) => (
              <CriteriaCard
                title={c.shortname}
                description={c.criteria}
                evalMethod={c.eval_method}
                key={`cc-${c.uid ?? idx.toString() + c.shortname}`}
                onTitleChange={(title) =>
                  updateCriteria(title, idx, "shortname")
                }
                onDescriptionChange={(desc) =>
                  updateCriteria(desc, idx, "criteria")
                }
                onEvalMethodChange={(method) =>
                  updateCriteria(method, idx, "eval_method")
                }
                onRemove={() =>
                  setCriteria(criteria.filter((v, j) => j !== idx))
                }
              />
            ))}
            {isLoadingCriteria > 0 ? (
              Array.from({ length: isLoadingCriteria }, (x, i) => (
                <Skeleton key={`skele-card-${i}`}>
                  <CriteriaCard
                    title={"Loading"}
                    description={"Loading"}
                    evalMethod={"expert"}
                  />
                </Skeleton>
              ))
            ) : (
              <></>
            )}
          </SimpleGrid>
        </ScrollArea>
      </div>

      <Group position="apart" mt="xl">
        <Button variant="default" onClick={onPrevious}>
          Back
        </Button>
        <Tooltip
          label={`Will send off up to ${estimatedLLMRequestsToImplement} requests`}
          withArrow
        >
          <Button
            variant="gradient"
            gradient={{ from: "teal", to: "lime", deg: 105 }}
            disabled={!criteria || criteria.length === 0}
            onClick={handleSubmit}
          >
            Ready to Grade!
          </Button>
        </Tooltip>
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
  responses,
}) => {
  const [active, setActive] = useState(0);

  // Criteria across the steps
  const [criteria, setCriteria] = useState<EvalCriteria[]>([]);

  // Global state
  const apiKeys = useStore((state) => state.apiKeys);

  const handleNext = () => {
    setActive((current) => current + 1);
  };

  const handlePrevious = () => {
    setActive((current) => current - 1);
  };

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
          criteria={criteria}
          setCriteria={setCriteria}
          genCriteriaFromContext={() => genCriteriaFromContext(responses ?? [])}
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
