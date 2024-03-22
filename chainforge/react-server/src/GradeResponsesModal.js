import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { v4 as uuid } from "uuid";
import Plot from "react-plotly.js";
import {
  SimpleGrid,
  Card,
  Modal,
  Text,
  Button,
  UnstyledButton,
  Textarea,
  TextInput,
  Flex,
  Progress,
  ScrollArea,
  useMantineTheme,
  Loader,
  Switch,
  Stack,
  Box,
  Space,
  Center,
  Tooltip,
  Skeleton,
  RingProgress,
  Checkbox,
  Popover,
  Group,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconPencil,
  IconRepeat,
  IconRobot,
  IconSparkles,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from "@tabler/icons-react";
import ConfettiExplosion from "react-confetti-explosion";
import {
  cleanMetavarsFilterFunc,
  deepcopy,
  sampleRandomElements,
  transformDict,
} from "./backend/utils";
import { generateLLMEvaluationCriteria } from "./backend/evalgen/utils";
import { escapeBraces } from "./backend/template";
import EvaluationFunctionExecutor from "./backend/evalgen/executor";
import {
  extractUIDFromRatingKey,
  getRatingKeyForResponse,
} from "./ResponseRatingToolbar";
import useStore from "./store";
import { DEFAULT_LLM_EVAL_MODEL } from "./LLMEvalNode";
import StorageCache from "./backend/cache";

const MANTINE_GREEN = "#40c057";
const SELECT_EVAL_FUNC_THRESHOLD = 0.4;

const HeaderText = ({ children }) => {
  return (
    <Text size="xl" fw={500} pl="sm" mb="lg">
      {children}
    </Text>
  );
};

const evalgenReportToImplementations = (report) => {
  // Convert to expected format by MultiEval node
  return report.selectedEvalFunctions.map((evalFuncSpec) => {
    if (evalFuncSpec.evalCriteria.eval_method === "code")
      return {
        name: evalFuncSpec.evalCriteria.shortname,
        type: "python", // for now, only generates Python
        state: {
          code: evalFuncSpec.code,
        },
      };
    else
      return {
        name: evalFuncSpec.evalCriteria.shortname,
        type: "llm",
        state: {
          prompt: evalFuncSpec.code,
          grader: deepcopy(DEFAULT_LLM_EVAL_MODEL),
          format: "bin", // for now, only boolean assertions
        },
      };
  });
};

const accuracyToColor = (acc) => {
  if (acc > 0.9) return "green";
  else if (acc > 0.7) return "yellow";
  else if (acc > 0.5) return "orange";
  else return "red";
};

const cmatrixTextAnnotations = (x, y, z) => {
  const annotations = [];
  const midVal = Math.max(...z.flat());
  for (let i = 0; i < y.length; i++) {
    for (let j = 0; j < x.length; j++) {
      annotations.push({
        xref: "x1",
        yref: "y1",
        x: x[j],
        y: y[i],
        text: z[i][j],
        font: {
          // family: "monospace",
          // size: 12,
          color: z[i][j] < midVal ? "white" : "black",
        },
        showarrow: false,
      });
    }
  }
  return annotations;
};

/** Example flows to help users get started and see what CF can do */
const CriteriaCard = function CriteriaCard({
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
}) {
  const [checked, setChecked] = useState(true);
  const [codeChecked, setCodeChecked] = useState(evalMethod === "code");
  const theme = useMantineTheme();

  // Report card specific
  const [openedCMatrix, { close: closeCMatrix, open: openCMatrix }] =
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
            hoverongaps: false,
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
      percent: Math.floor(evalFuncReport.accuracy * 100),
      color: accuracyToColor(evalFuncReport.accuracy),
    };
  }, [evalFuncReport]);

  // Update the checkbox whenever the evalFuncReport changes,
  // ticking it if the accuracy is over the threshold.
  // useEffect(() => {
  //   if (!evalFuncReport) return;
  //   setChecked(evalFuncReport.accuracy >= SELECT_EVAL_FUNC_THRESHOLD);
  // }, [evalFuncReport]);

  const setCheckedAndRealign = (newChecked) => {
    setChecked(newChecked);

    // oncheck is a callback to the parent to update the selected eval functions
    // oncheck is an awaitable function that returns the updated evalFuncReport
    if (onCheck && evalFuncReport) onCheck();
  };

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
            onChange={(e) => onTitleChange(e.currentTarget.value)}
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
            onChange={(e) => onDescriptionChange(e.currentTarget.value)}
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
            <Text size="sm" color="gray">
              {codeChecked ? "Python" : "LLM"}
            </Text>
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
    </Card>
  );
};

const ChooseCard = function ChooseCard({
  title,
  description,
  icon,
  bg,
  onClick,
}) {
  const [hovering, setHovering] = useState(false);

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ backgroundColor: bg + (hovering ? "44" : "77") }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={onClick}
    >
      <UnstyledButton className="checkcard">
        <Tooltip
          label={description}
          maw="200px"
          position="bottom"
          withinPortal
          withArrow
          multiline
        >
          <Flex justify="center" gap="md">
            <Box>{icon}</Box>
            <Text fw={500} lh={1.2} fz="md">
              {title}
            </Text>
          </Flex>
        </Tooltip>
      </UnstyledButton>
    </Card>
  );
};

// Pop-up to ask user to pick criterias for evaluation
export const PickCriteriaModal = forwardRef(
  function PickCriteriaModal(props, ref) {
    const [opened, { open, close }] = useDisclosure(false);
    const [responses, setResponses] = useState([]);
    const apiKeys = useStore((state) => state.apiKeys);
    const globalState = useStore((store) => store.state);

    // Callback to caller when criteria implementations return
    const [onFinish, setOnFinish] = useState(null);

    // Which stage of picking + generating criteria we are in. Screens are:
    // pick, wait, grade
    const [screen, setScreen] = useState("welcome");
    const modalTitle = useMemo(() => {
      if (screen === "pick") return "Pick Criteria";
      else if (screen === "welcome") return "Welcome";
      else if (screen === "wait") return "Collecting implementations...";
      else if (screen === "report") return "EvalGen Report";
      else return "Grading Responses";
    }, [screen]);

    const [criteria, setCriteria] = useState([]);
    const [addCriteriaValue, setAddCriteriaValue] = useState("");
    const [isLoadingCriteria, setIsLoadingCriteria] = useState(0);

    // The EvalGen object responsible for generating, implementing, and filtering candidate implementations
    const [executor, setExecutor] = useState(null);
    const [execProgress, setExecProgress] = useState(0);

    // Stores report generated when executor is done
    const [report, setReport] = useState(null);

    // The samples to pass the executor / grading responses features. This will be bounded
    // by maxNumSamplesForExecutor, instead of the whole dataset.
    const samples = useMemo(() => {
      // The max number of samples (responses) to pass the executor. This controls how many requests will
      // need to be sent off and how many evaluation function executions are performed.
      // TODO: Give the user some control over this.
      const maxNumSamplesForExecutor = 25;

      // Sample from the full set of responses, if needed:
      if (responses.length > maxNumSamplesForExecutor)
        return sampleRandomElements(responses, maxNumSamplesForExecutor);
      else return responses.slice();
    }, [responses]);

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
        "gpt-3.5-turbo", // llm
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
    const updateCriteria = (newValue, critIdx, propName) => {
      setCriteria((crit) => {
        crit[critIdx][propName] = newValue;
        return [...crit];
      });
    };

    // An estimate of many requests the implementation executor will require (upper bound).
    const estimatedLLMRequestsToImplement = useMemo(() => {
      const num_llm_evals = criteria.reduce(
        (acc, crit) => acc + (crit.eval_method === "expert" ? 1 : 0),
        0,
      );
      // The executor sends off one query per criteria to generate 3-5 candidates each.
      // Each candidate LLM eval prompt will be run over all candidates.
      return criteria.length + num_llm_evals * 5 * samples.length;
    }, [criteria, samples]);

    const getLikelyPromptTemplateAsContext = useCallback(() => {
      // Attempt to infer the prompt template used to generate the responses:
      const prompts = new Set();
      for (const resp_obj of responses) {
        if (resp_obj?.metavars?.__pt !== undefined) {
          prompts.add(resp_obj.metavars.__pt);
        }
      }

      if (prompts.size === 0) return null;

      // Pick a prompt template at random to serve as context....
      return escapeBraces(prompts.values().next().value);
    }, [responses]);

    // Given the context from "inputs", tries to generate an array of natural language criteria.
    const genCriteriaFromContext = useCallback(async () => {
      // Get the context from the input responses
      const inputPromptTemplate = getLikelyPromptTemplateAsContext();

      if (inputPromptTemplate === null) {
        console.error("No context found. Cannot proceed.");
        return;
      }

      // Attempt to generate criteria using an LLM
      return await generateLLMEvaluationCriteria(inputPromptTemplate, apiKeys);
    }, [responses]);

    // Update the executor whenever samples or eval criteria changes,
    // as long as the executor is not already running.
    useEffect(() => {
      let ex = executor;
      if (!ex) {
        // Instantiate executor.
        // Get the grades from the global state, and transform the dict such that it's in {uid: grade} format.
        const existingGrades = transformDict(
          globalState,
          (key) => key.startsWith("r.") && key.endsWith(".grade"),
          extractUIDFromRatingKey,
          (_, val) => {
            // The grades are in { idx: grade } format. Take only the first,
            // as we only take the first response in this iteration of EvalGen:
            if (typeof val !== "object") return undefined;
            const gs = Object.values(val);
            if (gs.length === 0) return undefined;
            return gs[0];
          },
        );

        // Create a new EvalGen executor, passing in the samples and existing grades
        ex = new EvaluationFunctionExecutor(
          getLikelyPromptTemplateAsContext(samples),
          samples,
          undefined,
          existingGrades,
        );
        setExecutor(ex);
      } else if (ex.isRunning()) {
        console.error(
          "Executor already running. Avoiding updating it with new samples or criteria.",
        );
        return;
      }
      ex.setExamples(samples);
      ex.setEvalCriteria(criteria);
    }, [samples, criteria]);

    // Starts generating implementations for the chosen criteria
    const beginGenCriteriaImplementations = useCallback(async () => {
      // Check that an executor exists (this should never be triggered)
      if (!executor) {
        console.error("Executor does not exist.");
        return;
      } else if (executor.isRunning()) {
        console.error("Executor is already running.");
        return;
      }

      // Start the executor in the background
      setExecProgress(0);
      executor.start((progress) => {
        setExecProgress(progress?.success ?? 0);
      });
    }, [executor]);

    // This gives the parent access to triggering the modal alert
    const trigger = (inputs, _onFinish) => {
      setResponses(inputs);
      setScreen("welcome");
      setAddCriteriaValue("");
      setExecutor(null);
      setOnFinish(() => (report) => {
        close();
        if (_onFinish) _onFinish(evalgenReportToImplementations(report));
      });
      open();
    };
    useImperativeHandle(ref, () => ({
      trigger,
    }));

    const handleInitialGradingDone = () => {
      setScreen("pick");

      // Generate criteria
      setCriteria([]);
      setIsLoadingCriteria(3);
      genCriteriaFromContext()
        .then((crits) => setCriteria(crits.map((c) => ({ ...c, uid: uuid() }))))
        .finally(() => setIsLoadingCriteria(0));
    };

    const transitionToReport = (report) => {
      setReport(report);
      setScreen("report");
    };

    const recomputeAlignment = async () => {
      // Get selected criteria
      // TODO: fix this somehow
      console.log("criteria", criteria);
      const selectedCriteria = criteria.filter((c) => c.selected);

      // Pass this into executor to recompute alignment
      const newReport = await executor?.recomputeAlignment(
        selectedCriteria,
        report,
      );

      // Update the report
      setReport(newReport);
    };

    const gradeResponsesScreen = useMemo(
      () => (
        <GradeResponsesScreen
          resps={samples}
          executor={executor}
          onClickDone={handleInitialGradingDone}
          askForAnnotations={screen === "grade_first"}
          onFinish={transitionToReport}
          execProgress={execProgress}
        />
      ),
      [samples, executor, screen, onFinish, execProgress],
    );

    return (
      <Modal
        size="80%"
        opened={opened}
        onClose={close}
        title={
          <div>
            <span style={{ fontSize: "14pt" }}>{modalTitle}</span>
          </div>
        }
        closeOnClickOutside={true}
        style={{ position: "relative", left: "-5%" }}
      >
        {screen === "welcome" ? (
          <div>
            <Center>
              <Text size="sm" pl="sm" mt="lg" mb="sm" maw="560px">
                Welcome to EvalGen. The EvalGen wizard will generate evaluation
                criteria and implementations for grading responses that align
                with your expectations.
              </Text>
            </Center>
            <Center>
              <Text size="sm" pl="sm" mb="lg" maw="560px">
                To get started, we need to specify some criteria in natural
                language that will be used to evaluate model responses. How
                would you like to generate criteria?
              </Text>
            </Center>
            <Center>
              <Flex justify="center" gap="lg" mt="sm" mb="lg" maw="560px">
                <ChooseCard
                  onClick={() => {
                    if (isLoadingCriteria > 0) return;
                    setScreen("pick");
                    setCriteria([]);
                    setIsLoadingCriteria(3);
                    genCriteriaFromContext()
                      .then((crits) =>
                        setCriteria(crits.map((c) => ({ ...c, uid: uuid() }))),
                      )
                      .finally(() => setIsLoadingCriteria(0));
                  }}
                  title="Infer criteria from my context"
                  description="An AI will look at your input prompt and context and try to infer criteria. You will still be able to review, revise, and add criteria."
                  icon={<IconSparkles />}
                  bg="#a834eb"
                />
                <ChooseCard
                  onClick={() => {
                    setScreen("pick");
                    // setCriteria([]);
                  }}
                  title="Let me specify criteria manually"
                  description="Enter criteria manually. An AI will generate longer descriptions for your criteria, which you can review and revise."
                  icon={<IconPencil />}
                  bg="#34eb74"
                />
                <ChooseCard
                  onClick={() => {
                    setScreen("grade_first");
                    // setCriteria([]);
                  }}
                  title="Grade some responses first"
                  description="Grade some responses first, to help yourself identify criteria. The AI will incorporate your grades in its criteria suggestions."
                  icon={<IconThumbUp />}
                  bg="#eba834"
                />
                {/* TODO <ChooseCard title="Chat with an AI to infer criteria" description="Chat with an AI assistant that will ask questions about your task and situation. The AI will infer some criteria and provide them as starting points." icon={<IconMessage2Bolt />} bg="#34c9eb" /> */}
              </Flex>
            </Center>
          </div>
        ) : (
          <></>
        )}

        {screen === "pick" ? (
          <div>
            <Text size="sm" pl="sm" mb="lg">
              Select criteria that you would like to evaluate responses on.
              Based on your chosen criteria, LLM will generate implementations
              of assertions. Afterwards, an optional human scoring pass can
              better align these implementations with your expectations.
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
                    .then((crit) => setCriteria(criteria.concat(crit)))
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

            <Flex justify="center" gap={12} mt="xs">
              <Tooltip
                label={`Will send off up to ${estimatedLLMRequestsToImplement} requests`}
                withArrow
              >
                <Button
                  onClick={() => {
                    // Start generating implementations + transition to next screen
                    // setScreen("wait");
                    // For study just go right to grading
                    setScreen("grade");
                    beginGenCriteriaImplementations();

                    // generateLLMEvaluationCriteria(
                    //   escapeBraces(`Delete 10 words or phrases from the following paragraph that don't contribute much to its meaning, but keep readability:
                    // "{paragraph}"

                    // Please do not add any new words or change words, only delete words.`),
                    // ).then(setCriteria);
                  }}
                  variant="gradient"
                  gradient={{ from: "teal", to: "lime", deg: 105 }}
                  disabled={!criteria || criteria.length === 0}
                >
                  <IconSparkles />
                  &nbsp;I&apos;m done. Implement it!
                </Button>
              </Tooltip>
            </Flex>
          </div>
        ) : (
          <></>
        )}

        {screen === "wait" ? (
          <div>
            <Stack justify="center" align="center" h={500}>
              <Text mb={0}>Collecting...</Text>
              <Loader size="lg" />
              <Text color="gray" size="sm">
                This may take a while.
              </Text>

              <Space h="lg" />
              <Button
                onClick={() => setScreen("grade")}
                size="lg"
                variant="gradient"
                gradient={{ from: "teal", to: "lime", deg: 105 }}
              >
                <IconSparkles />
                &nbsp;Grade Responses While You Wait
              </Button>
              <Text ml="lg" lh={1.2} w={380} color="gray">
                Grading helps us choose implementations that better align with
                your expectations. 📈
              </Text>
            </Stack>
          </div>
        ) : (
          <></>
        )}

        {screen === "grade" ? gradeResponsesScreen : <></>}
        {screen === "grade_first" ? (
          <div>
            <Center>
              <Text size="md" pl="sm" mt="lg" mb="sm" maw="80%">
                Grade at least 5 responses. You can use the arrows to skip
                responses. Try to get a good sample of good (thumbs up) and bad
                (thumbs down) examples.
                {/* Welcome to EvalGen. We&apos;ve learned that grading responses
                helps you decide your criteria. So, before AI can help you
                generate evaluators,{" "}
                <span style={{ fontWeight: 800 }}>
                  we ask you to grade at least 5 responses
                </span>
                . The EvalGen wizard will then generate evaluation criteria and
                implementations for grading responses that align with your
                expectations. */}
              </Text>
            </Center>
            <hr />
            {gradeResponsesScreen}
          </div>
        ) : (
          <></>
        )}

        {screen === "report" ? (
          <ReportCardScreen
            report={report}
            recomputeAlignment={recomputeAlignment}
            onClickFinish={(report) => onFinish(report)}
          />
        ) : (
          <></>
        )}
      </Modal>
    );
  },
);

// Screen where the user grades responses.
export const GradeResponsesScreen = forwardRef(function GradeResponsesScreen(
  { resps, executor, onClickDone, askForAnnotations, onFinish, execProgress },
  ref,
) {
  // Confetti effects
  const [isGreenExploding, setIsGreenExploding] = React.useState(false);
  const [isRedExploding, setIsRedExploding] = React.useState(false);

  const [responses, setResponses] = useState([]);
  const [shownResponse, setShownResponse] = useState(undefined);
  const [pastShownResponses, setPastShownResponses] = useState([]);
  const [shownResponseIdx, setShownResponseIdx] = useState(0);
  const [grades, setGrades] = useState({});

  const showProgressType = useMemo(
    () => (executor ? "grade" : "num_graded"),
    [executor],
  );
  const [minNumGrade, setMinNumGrade] = useState(5);
  const numGraded = useMemo(() => Object.keys(grades).length, [grades]);

  const [promptReasoning, setPromptReasoning] = useState(null);
  const [annotation, setAnnotation] = useState(undefined);

  // For updating the global human ratings state
  const setState = useStore((store) => store.setState);
  const updateGlobalRating = useCallback(
    (uid, label, payload) => {
      const key = getRatingKeyForResponse(uid, label);
      const safe_payload = deepcopy(payload);
      setState(key, safe_payload);
      StorageCache.store(key, safe_payload);
    },
    [setState],
  );

  const bottomBar = useMemo(() => {
    const bar = {};
    if (showProgressType === "num_graded") {
      bar.progressPerc = Math.min((numGraded / minNumGrade) * 100, 100);
      bar.progressLabel = `${numGraded} / ${minNumGrade} graded`;
      bar.buttonLabel = bar.progressPerc < 100 ? "Keep grading!" : "Next Step";
      bar.buttonDisabled = bar.progressPerc < 100;
      bar.buttonStyle = "filled";
    } else {
      bar.progressPerc = Math.min(execProgress, 100);
      bar.progressLabel = "Generating and selecting implementations...";
      bar.buttonLabel = bar.progressPerc < 99.5 ? "I'm tired 😴" : "Done";
      bar.buttonDisabled = false;
      bar.buttonStyle = bar.progressPerc < 99.5 ? "outline" : "filled";
    }
    return bar;
  }, [showProgressType, numGraded, minNumGrade, execProgress]);

  const responseText = useMemo(() =>
    shownResponse && shownResponse.responses?.length > 0
      ? shownResponse.responses[0]
      : "",
  );
  const prompt = useMemo(() => shownResponse?.prompt ?? "", [shownResponse]);
  const varsDivs = useMemo(() => {
    const combined_vars_metavars = shownResponse
      ? {
          ...shownResponse.vars,
          ...transformDict(shownResponse.metavars, cleanMetavarsFilterFunc),
        }
      : {};
    return Object.entries(combined_vars_metavars).map(([varname, val]) => (
      <div key={varname} className="grade-resp-var-container">
        <span className="response-var-name">{varname}&nbsp;=&nbsp;</span>
        <span className="response-var-value linebreaks">{val}</span>
      </div>
    ));
  }, [shownResponse]);

  // Goto next response in the queue (skipping grading the current one)
  const nextResponse = () => {
    if (responses.length === 0) return;

    // Update annotation for current response (if any)
    // TODO: Fix this for generate case when num resp per prompt > 1
    if (
      shownResponse &&
      annotation &&
      typeof annotation === "string" &&
      annotation.trim().length > 0
    ) {
      // console.log("setting annotation for resp", shownResponse.uid, annotation);
      updateGlobalRating(shownResponse.uid, "note", { 0: annotation });
      setAnnotation(null);
    }
    setPromptReasoning(null);

    if (shownResponseIdx < pastShownResponses.length - 1) {
      // If we are not at the end of the history of shown responses, then show the next response:
      setShownResponse(pastShownResponses[shownResponseIdx + 1]);
      setShownResponseIdx(shownResponseIdx + 1); // increment the shown resp idx
    } else {
      // We are at the end of the history; pick the next response off the stack:
      // TODO: Make this unique (maybe by removing picked responses from the list!)
      let num_tries = 3;
      let next_resp = executor?.getNextExampleToGrade();
      while (
        num_tries > 0 &&
        (!next_resp || pastShownResponses.some((r) => r.uid === next_resp.uid))
      ) {
        // We're presenting a response that's already been shown. Try again.
        // NOTE: If we're trying again the first time, executor will flip and get the response on the other side of the grading stack, so we try once more:
        if (next_resp && num_tries === 3)
          next_resp =
            executor?.getNextExampleToGrade() ??
            sampleRandomElements(responses, 1)[0];
        // Otherwise we just choose a response at random:
        else next_resp = sampleRandomElements(responses, 1)[0];
        num_tries -= 1;
      }
      // Note that this doesn't guarantee uniqueness here ---it is possible to see a response again.
      // However, the internal "grades" dict will help us in remembering what grade the user gave the response.
      setShownResponse(next_resp);
      setPastShownResponses(pastShownResponses.concat(next_resp));
      setShownResponseIdx(pastShownResponses.length);
    }
  };

  // Go back to previously shown response
  const prevResponse = () => {
    if (pastShownResponses.length === 0 || shownResponseIdx === 0) return;
    setShownResponse(pastShownResponses[shownResponseIdx - 1]);
    setShownResponseIdx(shownResponseIdx - 1); // decrement shown resp idx
  };

  // Update responses to draw from, when passed by external source
  const updateResponsePool = (inputs) => {
    if (!inputs) return;

    setResponses(inputs);

    // Choose the first response to display to the user
    if (inputs?.length > 0) {
      const random_resp = sampleRandomElements(inputs, 1)[0];
      setShownResponse(random_resp);
      setPastShownResponses([random_resp]);
      setShownResponseIdx(0);
      setGrades({});
    }
  };

  const handleDone = useCallback(async () => {
    if (showProgressType === "num_graded") {
      if (onClickDone) onClickDone();
    } else {
      // Await completion of all gen + execution of eval funcs
      await executor?.waitForCompletion();

      // Filtering eval funcs by grades and present results
      const filteredFunctions = await executor?.filterEvaluationFunctions(0.25);
      console.log("Filtered Functions: ", filteredFunctions);

      // Return selected implementations to caller
      if (onFinish) onFinish(filteredFunctions);
    }
  }, [executor, showProgressType]);

  const updateGrade = (idx, uid, grade) => {
    grades[idx] = grade;
    setGrades({ ...grades });
    executor?.setGradeForExample(uid, grade);
    updateGlobalRating(uid, "grade", { 0: grade });
  };

  const handleClickGradeButton = (isGoodResponse) => {
    updateGrade(shownResponseIdx, shownResponse.uid, isGoodResponse);
    const explodeFunc = isGoodResponse
      ? setIsGreenExploding
      : setIsRedExploding;
    explodeFunc(true);
    if (isGoodResponse) {
      // Don't ask for clarification if it's a good grade
      setTimeout(() => explodeFunc(false), 1200);
      setTimeout(nextResponse, 800);
    } else {
      // If they gave a bad grade, ask them why
      setTimeout(() => explodeFunc(false), 1200);
      setTimeout(() => {
        if (askForAnnotations) setPromptReasoning(true);
        else nextResponse();
      }, 800);
    }
  };

  // Update responses whenever upstream changes
  useEffect(() => {
    updateResponsePool(resps);
  }, [resps]);

  return (
    <Stack justify="space-between" mih={500}>
      <Box>
        <Flex justify="center">
          {shownResponseIdx in grades ? (
            grades[shownResponseIdx] ? (
              <HeaderText>
                You chose&nbsp;
                <IconThumbUp color="green" style={{ marginBottom: "-3px" }} />!
              </HeaderText>
            ) : (
              <HeaderText>
                You chose&nbsp;
                <IconThumbDown color="red" style={{ marginBottom: "-6px" }} />!
              </HeaderText>
            )
          ) : (
            <HeaderText>
              Is this response&nbsp;
              <IconThumbUp style={{ marginBottom: "-3px" }} />
              &nbsp;or&nbsp;
              <IconThumbDown style={{ marginBottom: "-6px" }} />
              &nbsp;?
            </HeaderText>
          )}
        </Flex>

        <Flex justify="center" align="center" mb="sm">
          <Button variant="white" color="dark" onClick={prevResponse}>
            <IconChevronLeft />
          </Button>
          <div
            className="response-box"
            style={{
              backgroundColor: "#eee",
              width: "80%",
              maxHeight: "340px",
              overflowY: "scroll",
              borderColor: "black",
              borderStyle: "solid",
            }}
          >
            <div className="response-item-llm-name-wrapper">
              <div
                className="small-response"
                style={{ fontSize: "11pt", padding: "12pt" }}
              >
                {responseText}
              </div>
            </div>
          </div>
          <Button variant="white" color="dark" onClick={nextResponse}>
            <IconChevronRight />
          </Button>
        </Flex>

        <Flex justify="center" mb="xl" gap="lg">
          <div
            style={{
              backgroundColor: "#fff",
              padding: "12px",
              width: "31%",
              borderRadius: "12px",
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            Vars
            <hr />
            <div style={{ maxHeight: "160px", overflowY: "scroll" }}>
              {varsDivs}
            </div>
          </div>
          <div
            style={{
              backgroundColor: "#fff",
              padding: "12px",
              width: "41%",
              borderRadius: "2px",
            }}
          >
            Prompt
            <hr />
            <div
              className="monofont linebreaks"
              style={{
                maxHeight: "160px",
                overflowY: "scroll",
                fontSize: "10pt",
                lineHeight: "1.2",
              }}
            >
              {prompt}
            </div>
          </div>
        </Flex>

        {promptReasoning === null ? (
          <Flex justify="center" gap="50px" mb="xl">
            <Button
              color="red"
              variant="filled"
              onClick={() => {
                handleClickGradeButton(false);
              }}
            >
              <IconThumbDown />
              &nbsp;Bad!
              <>
                {isRedExploding && (
                  <ConfettiExplosion
                    zIndex={1000}
                    colors={["#f00"]}
                    force={0.1}
                    height={300}
                    width={200}
                    particleCount={5}
                    duration={2200}
                    onComplete={() => setIsRedExploding(false)}
                    style={{ position: "absolute", left: "50%", top: "20%" }}
                  />
                )}
              </>
            </Button>
            <Button
              color="green"
              variant="filled"
              onClick={() => {
                handleClickGradeButton(true);
              }}
            >
              <IconThumbUp />
              &nbsp;Good!
              <>
                {isGreenExploding && (
                  <ConfettiExplosion
                    zIndex={1000}
                    colors={[MANTINE_GREEN]}
                    force={0.9}
                    height={300}
                    width={300}
                    particleCount={10}
                    duration={2200}
                    onComplete={() => setIsGreenExploding(false)}
                    style={{ position: "absolute", left: "50%", top: "20%" }}
                  />
                )}
              </>
            </Button>
          </Flex>
        ) : (
          <Center>
            <Stack spacing="xs">
              <Text>What&apos;s the reason for your score?</Text>
              <Flex align="center" gap="lg">
                <Textarea
                  value={annotation}
                  onChange={(e) => setAnnotation(e.currentTarget.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      nextResponse();
                    }
                  }}
                />
                <Button onClick={nextResponse} w={100}>
                  {!annotation ? "Skip" : "Continue"}
                </Button>
              </Flex>
            </Stack>
          </Center>
        )}
      </Box>

      <Flex justify="left" align="center" gap="md">
        {/* <Progress size={18} w='100%' sections={[{ value: 30, color: 'blue', label: '3/10 graded', tooltip: 'Samples graded' }]} /> */}
        {/* <Loader size='sm' /> */}
        <Stack w="100%" spacing={4}>
          <Text color="#aaa" size="sm">
            {bottomBar.progressLabel}
          </Text>
          <Progress w="100%" value={bottomBar.progressPerc} mb="0px" />
        </Stack>

        <Button
          onClick={handleDone}
          variant={bottomBar.buttonStyle}
          disabled={bottomBar.buttonDisabled}
        >
          {bottomBar.buttonLabel}
        </Button>
      </Flex>
    </Stack>
  );
});

// Screen after EvalGen finishes, to show a report to the user
// about the chosen functions and the alignment with their ratings.
const ReportCardScreen = ({ report, recomputeAlignment, onClickFinish }) => {
  // The criteria cards, now with report information
  const cards = useMemo(() => {
    const res = [];

    console.log("Report: ", report);

    // Iterate through selected eval functions and create cards
    for (const selectedFunc of report.selectedEvalFunctions) {
      const crit = selectedFunc.evalCriteria;
      // Find corresponding report in allEvalFunctionReports map from criteria to list
      const critEvalFuncReports = report.allEvalFunctionReports.get(crit);
      const evalFuncReport = critEvalFuncReports.find(
        (rep) => rep.evalFunction === selectedFunc,
      );

      res.push(
        <CriteriaCard
          title={crit.shortname}
          description={crit.criteria}
          evalMethod={crit.eval_method}
          key={`cc-${crit.uid ?? res.length.toString() + crit.shortname}`}
          reportMode={true}
          evalFuncReport={evalFuncReport} // undefined if none was chosen
          onCheck={(checked) => {
            crit.selected = checked;
            recomputeAlignment();
          }}
        />,
      );
    }

    return res;
  }, [report]);

  return (
    report && (
      <div>
        <Text align="center" size="lg" pl="sm" mb="lg">
          Chosen Functions and Alignment
        </Text>

        {/* Show coverage and false failure rate numbers */}
        <Flex justify="center" gap="md" mb="lg">
          <Group position="center" spacing="xl" style={{ textAlign: "center" }}>
            <Card
              shadow="sm"
              padding="md"
              radius="md"
              style={{ backgroundColor: "#f0f0f0" }}
            >
              <Text weight={500} size="md">
                Coverage
              </Text>
              <Text color="blue" weight={700} size="md">
                {report.failureCoverage.toFixed(2)}%
              </Text>
            </Card>
            <Card
              shadow="sm"
              padding="md"
              radius="md"
              style={{ backgroundColor: "#f0f0f0" }}
            >
              <Text weight={500} size="md">
                False Failure Rate
              </Text>
              <Text color="red" weight={700} size="md">
                {report.falseFailureRate.toFixed(2)}%
              </Text>
            </Card>
          </Group>
        </Flex>

        <ScrollArea mih={300} h={500} mah={500}>
          <SimpleGrid cols={3} spacing="sm" verticalSpacing="sm" mb="lg">
            {cards}
          </SimpleGrid>
        </ScrollArea>

        <Flex justify="center" gap={12} mt="xs">
          <Button onClick={() => onClickFinish(report)}>
            Finish with selected evaluators
          </Button>
        </Flex>
      </div>
    )
  );
};
