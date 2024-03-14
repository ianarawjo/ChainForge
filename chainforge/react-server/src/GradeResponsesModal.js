import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import { v4 as uuid } from "uuid";
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
  sampleRandomElements,
  transformDict,
} from "./backend/utils";
import { generateLLMEvaluationCriteria } from "./backend/evalgen/utils";
import { escapeBraces } from "./backend/template";
import EvaluationFunctionExecutor from "./backend/evalgen/executor";

const MANTINE_GREEN = "#40c057";

const HeaderText = ({ children }) => {
  return (
    <Text size="xl" fw={500} pl="sm" mb="lg">
      {children}
    </Text>
  );
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
}) {
  const [checked, setChecked] = useState(true);
  const [codeChecked, setCodeChecked] = useState(evalMethod === "code");
  const theme = useMantineTheme();

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ backgroundColor: checked ? "#f2f7fc" : "#fff" }}
    >
      <UnstyledButton
        // onClick={() => setChecked(!checked)}
        onKeyUp={(e) => e.preventDefault()}
        className="checkcard"
      >
        {/* <Checkbox
          checked={checked}
          onChange={() => setChecked(!checked)}
          tabIndex={-1}
          size="md"
          mr="lg"
          styles={{ input: { cursor: "pointer" } }}
          aria-hidden
        /> */}

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
              },
            }}
            autosize
            minRows={2}
            maxRows={5}
            fz="sm"
            mb="xs"
            c="dimmed"
          />
        </div>

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
      </UnstyledButton>
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

    // Which stage of picking + generating criteria we are in. Screens are:
    // pick, wait, grade
    const [screen, setScreen] = useState("grade_first");
    const modalTitle = useMemo(() => {
      if (screen === "pick") return "Pick Criteria";
      else if (screen === "auto_or_manual") return "Welcome";
      else if (screen === "wait") return "Collecting implementations...";
      else return "Grading Responses";
    }, [screen]);

    const [criteria, setCriteria] = useState([
      {
        shortname: "Grammaticality",
        criteria: "The text is grammatically correct.",
        eval_method: "expert",
      },
      {
        shortname: "Length",
        criteria: "The text is 144 characters or less.",
        eval_method: "code",
      },
      {
        shortname: "Clickbait potential",
        criteria: "How likely the text is to drive attention as a Tweet.",
        eval_method: "expert",
      },
      {
        shortname: "Informality",
        criteria:
          "Whether the response sounds informal, like a real human tweeted it.",
        eval_method: "expert",
      },
      {
        shortname: "Toxicity",
        criteria: "Whether the response sounds overly harmful or toxic.",
        eval_method: "expert",
      },
    ]);
    const [addCriteriaValue, setAddCriteriaValue] = useState("");
    const [isLoadingCriteria, setIsLoadingCriteria] = useState(false);

    // An object responsible for generating, implementing, and filtering candidate implementations
    const [executor, setExecutor] = useState(null);

    // The samples to pass the executor / grading responses features. This will be bounded
    // by maxNumSamplesForExecutor, instead of the whole dataset.
    const samples = useMemo(() => {
      // The max number of samples (responses) to pass the executor. This controls how many requests will
      // need to be sent off and how many evaluation function executions are performed.
      // TODO: Give the user some control over this.
      const maxNumSamplesForExecutor = 16;

      // Sample from the full set of responses, if needed:
      if (responses.length > maxNumSamplesForExecutor)
        return sampleRandomElements(responses, maxNumSamplesForExecutor);
      else return responses.slice();
    }, [responses]);

    const addCriteria = () => {
      // TODO: Make async LLM call to expand criteria. For now, just dummy func:
      setCriteria(
        criteria.concat([
          {
            shortname: "New Criteria",
            criteria: addCriteriaValue,
            eval_method: "expert",
            uid: uuid(),
          },
        ]),
      );
    };
    const setCriteriaTitle = (title, idx) => {
      criteria[idx].shortname = title;
      setCriteria([...criteria]);
    };
    const setCriteriaDesc = (desc, idx) => {
      criteria[idx].criteria = desc;
      setCriteria([...criteria]);
    };
    const setCriteriaMethod = (m, idx) => {
      criteria[idx].eval_method = m;
      setCriteria([...criteria]);
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
      return await generateLLMEvaluationCriteria(inputPromptTemplate);
    }, [responses]);

    // Starts generating implementations for the chosen criteria
    const beginGenCriteriaImplementations = useCallback(async () => {
      // Check that an executor isn't already running:
      if (executor) {
        console.error(
          "Executor already running. Avoiding running duplicate executors.",
        );
        return;
      }

      // Initialize an object responsible for generating, executing and ranking candidate implementations:
      const new_executor = new EvaluationFunctionExecutor(
        getLikelyPromptTemplateAsContext(samples),
        samples,
      );

      // Set the criteria to be used for generating implementations
      new_executor.setEvalCriteria(criteria);

      // Save executor, passing it to the GradeResponses window
      setExecutor(new_executor);

      // Start it in the background
      new_executor.start();
    }, [criteria, samples, executor]);

    // This gives the parent access to triggering the modal alert
    const trigger = (inputs) => {
      setResponses(inputs);
      setScreen("grade_first");
      setExecutor(null);
      open();
    };
    useImperativeHandle(ref, () => ({
      trigger,
    }));

    const handleInitialGradingDone = () => {
      setScreen("pick");

      // Generate criteria
      setCriteria([]);
      setIsLoadingCriteria(true);
      genCriteriaFromContext()
        .then((crits) => setCriteria(crits.map((c) => ({ ...c, uid: uuid() }))))
        .finally(() => setIsLoadingCriteria(false));
    };

    const gradeResponsesWindow = useMemo(
      () => (
        <GradeResponsesWindow
          resps={samples}
          executor={executor}
          onClickDone={handleInitialGradingDone}
        />
      ),
      [samples, executor],
    );

    return (
      <Modal
        size="900px"
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
        {/* {screen === "auto_or_manual" ? (
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
                    if (isLoadingCriteria) return;
                    setScreen("pick");
                    setCriteria([]);
                    setIsLoadingCriteria(true);
                    genCriteriaFromContext()
                      .then((crits) =>
                        setCriteria(crits.map((c) => ({ ...c, uid: uuid() }))),
                      )
                      .finally(() => setIsLoadingCriteria(false));
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
                {/* TODO <ChooseCard title="Chat with an AI to infer criteria" description="Chat with an AI assistant that will ask questions about your task and situation. The AI will infer some criteria and provide them as starting points." icon={<IconMessage2Bolt />} bg="#34c9eb" /> */}
        {/* </Flex>
            </Center>
          </div>
        ) : (
          <></>
        )} } */}

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
                  }
                }}
              />
              <Button
                variant="filled"
                onClick={() => {
                  if (isLoadingCriteria) return;
                  setIsLoadingCriteria(true);
                  genCriteriaFromContext()
                    .then((crit) => setCriteria(criteria.concat(crit)))
                    .finally(() => setIsLoadingCriteria(false));
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
                    key={`cc-${c.uid ?? idx}`}
                    onTitleChange={(title) => setCriteriaTitle(title, idx)}
                    onDescriptionChange={(desc) => setCriteriaDesc(desc, idx)}
                    onEvalMethodChange={(method) =>
                      setCriteriaMethod(method, idx)
                    }
                    onRemove={() =>
                      setCriteria(criteria.filter((v, j) => j !== idx))
                    }
                  />
                ))}
                {isLoadingCriteria ? (
                  Array.from({ length: 3 }, (x, i) => (
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
                    setScreen("wait");
                    beginGenCriteriaImplementations();

                    // generateLLMEvaluationCriteria(
                    //   escapeBraces(`Delete 10 words or phrases from the following paragraph that don't contribute much to its meaning, but keep readability:
                    // "{paragraph}"

                    // Please do not add any new words or change words, only delete words.`),
                    // ).then(setCriteria);
                  }}
                  variant="gradient"
                  gradient={{ from: "teal", to: "lime", deg: 105 }}
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

        {screen === "grade" ? gradeResponsesWindow : <></>}
        {screen === "grade_first" ? (
          <div>
            <Center>
              <Text size="md" pl="sm" mt="lg" mb="sm" maw="80%">
                Welcome to EvalGen. We&apos;ve learned that grading responses
                helps you decide your criteria. So, before AI can help you
                generate evaluators,{" "}
                <span style={{ fontWeight: 800 }}>
                  we ask you to grade at least 5 responses
                </span>
                . The EvalGen wizard will then generate evaluation criteria and
                implementations for grading responses that align with your
                expectations.
              </Text>
            </Center>
            <hr />
            {gradeResponsesWindow}
          </div>
        ) : (
          <></>
        )}
      </Modal>
    );
  },
);

// Pop-up where user grades responses.
export const GradeResponsesWindow = forwardRef(function GradeResponsesWindow(
  { resps, executor, onClickDone },
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

  const bottomBar = useMemo(() => {
    const bar = {};
    if (showProgressType === "num_graded") {
      bar.progressPerc = Math.min((numGraded / minNumGrade) * 100, 100);
      bar.progressLabel = `${numGraded} / ${minNumGrade} graded`;
      bar.buttonLabel = bar.progressPerc < 100 ? "Keep grading!" : "Next Step";
      bar.buttonDisabled = bar.progressPerc < 100;
      bar.buttonStyle = "filled";
    } else {
      bar.progressPerc = Math.min((numGraded / minNumGrade) * 100, 100);
      bar.progressLabel = `${numGraded} / ${minNumGrade} graded`;
      bar.buttonLabel = "I'm tired 😴";
      bar.buttonDisabled = false;
      bar.buttonStyle = "outline";
    }
    return bar;
  }, [showProgressType, numGraded, minNumGrade]);

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
        <span className="response-var-value">{val}</span>
      </div>
    ));
  }, [shownResponse]);

  // Goto next response in the queue (skipping grading the current one)
  const nextResponse = () => {
    if (responses.length === 0) return;

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
    console.warn(inputs);

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
      const filteredFunctions = await executor?.filterEvaluationFunctions(0.2);
      console.log("Filtered Functions: ", filteredFunctions);
    }
  }, [executor, showProgressType]);

  const handleClickGradeButton = (isGoodResponse) => {
    grades[shownResponseIdx] = isGoodResponse;
    setGrades({ ...grades });
    executor?.setGradeForExample(shownResponse.uid, isGoodResponse);
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
        setPromptReasoning(true);
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
              maxHeight: "300px",
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
            <div style={{ maxHeight: "300px", overflowY: "scroll" }}>
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
              className="monofont"
              style={{
                maxHeight: "300px",
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
                <Textarea autoFocus />
                <Button onClick={nextResponse}>Continue</Button>
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
