/**
 * EvalGen 2.0
 *
 * Ian Arawjo, Shreya Shankar, J.D. Zamf.
 *
 * This file concerns the front-end to evaluation generator, EvalGen.
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
import React, {
  ReactNode,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { v4 as uuid } from "uuid";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Collapse,
  Divider,
  Flex,
  Grid,
  Group,
  Menu,
  Modal,
  Radio,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  rem,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Dict, LLMResponse, PromptVarsDict, RatingDict } from "./backend/typing";
import { EvalCriteria } from "./backend/evalgen/typing";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconRobot,
  IconStarFilled,
  IconTerminal2,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from "@tabler/icons-react";
import {
  cleanMetavarsFilterFunc,
  deepcopy,
  sampleRandomElements,
  transformDict,
} from "./backend/utils";
import useStore from "./store";
import { getRatingKeyForResponse } from "./ResponseRatingToolbar";
import StorageCache from "./backend/cache";
import EvaluationFunctionExecutor from "./backend/evalgen/executor";
import { generateLLMEvaluationCriteria } from "./backend/evalgen/utils";

const INIT_CRITERIA: EvalCriteria[] = [
  {
    shortname: "Grammatical",
    criteria: "The text is grammatically correct.",
    eval_method: "expert",
    uid: uuid(),
    priority: 0,
  },
  {
    shortname: "Tweet-length",
    criteria: "The text is less than 144 characters.",
    eval_method: "code",
    uid: uuid(),
    priority: 0,
  },
  {
    shortname: "Bombastic",
    criteria: "The message will drive views because it's controversial.",
    eval_method: "expert",
    uid: uuid(),
    priority: 0,
  },
];

const ThumbUpDownButtons = ({
  grade,
  onChangeGrade,
}: {
  grade: boolean | undefined;
  onChangeGrade: (newGrade: boolean | undefined) => void;
}) => {
  return (
    <>
      {/* Thumbs up/down buttons */}
      <Button
        color={grade === true ? "green" : "gray"}
        m={0}
        p={0}
        variant="subtle"
        onClick={() => {
          // Toggle grade: if on (true), turn 'off' (undefined, for neutral).
          if (onChangeGrade) onChangeGrade(grade === true ? undefined : true);
        }}
      >
        <IconThumbUp size="14pt" fill={grade === true ? "#aea" : "white"} />
      </Button>
      <Button
        color={grade === false ? "red" : "gray"}
        m={0}
        p={0}
        variant="subtle"
        onClick={() => {
          // Toggle grade: if on (true), turn 'off' (undefined, for neutral).
          if (onChangeGrade) onChangeGrade(grade === false ? undefined : false);
        }}
      >
        <IconThumbDown size="14pt" fill={grade === false ? "pink" : "white"} />
      </Button>
    </>
  );
};

export interface CriteriaCardProps {
  criterion: EvalCriteria;
  onChange: (changedCriteria: EvalCriteria) => void;
  onDelete: () => void;
  initiallyOpen?: boolean;
  grade: boolean | undefined;
  onChangeGrade: (newGrade: boolean | undefined) => void;
}

const CriteriaCard: React.FC<CriteriaCardProps> = ({
  criterion,
  onChange,
  onDelete,
  initiallyOpen,
  grade,
  onChangeGrade,
}) => {
  const [opened, { toggle }] = useDisclosure(initiallyOpen ?? false);
  const [title, setTitle] = useState(criterion.shortname ?? "New Criteria");

  return (
    <Card withBorder mb={4} radius="md" style={{ cursor: "default" }}>
      <Card.Section withBorder pl="8px">
        <Flex align="center">
          <Group spacing="0px">
            {/* The arrow chevron user can click to collapse/expand */}
            <Button
              color="gray"
              p={0}
              m={0}
              variant="subtle"
              mr="4px"
              onClick={toggle}
            >
              {opened ? (
                <IconChevronDown size="14pt" />
              ) : (
                <IconChevronRight size="14pt" />
              )}
            </Button>

            {/* Thumbs up/down buttons */}
            <ThumbUpDownButtons grade={grade} onChangeGrade={onChangeGrade} />

            {/* Title of the criteria */}
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => {
                criterion.shortname = e.target.value;
                if (onChange) onChange(criterion);
              }}
              placeholder="Criteria name"
              variant="unstyled"
              size="sm"
              ml="xs"
              className="nodrag nowheel"
              styles={{
                input: {
                  padding: "0px",
                  height: "14pt",
                  minHeight: "0pt",
                  fontWeight: 500,
                },
              }}
            />
          </Group>

          <Group spacing="4px" ml="auto">
            {/* Whether this criteria should be implemented with code (function) or an LLM evaluator */}
            <Tooltip
              label={
                criterion.eval_method === "code"
                  ? "Change to an LLM evaluator"
                  : "Change to a code evaluator"
              }
              withinPortal
              withArrow
            >
              <Text
                color="#999"
                size="sm"
                mr="6px"
                onClick={() => {
                  criterion.eval_method =
                    criterion.eval_method === "code" ? "expert" : "code";
                  if (onChange) onChange(criterion);
                }}
              >
                {criterion.eval_method === "code" ? (
                  <Flex style={{ userSelect: "none" }}>
                    <IconTerminal2 size="14pt" />
                    &nbsp;Python
                  </Flex>
                ) : (
                  <Flex style={{ userSelect: "none" }}>
                    <IconRobot size="14pt" />
                    &nbsp;LLM
                  </Flex>
                )}
              </Text>
            </Tooltip>

            {/* Favorite star toggle */}
            <Tooltip
              label={
                criterion.priority <= 0
                  ? "Make this a deal-breaker"
                  : "It's a deal-breaker"
              }
              withinPortal
              withArrow
            >
              <Button
                color={criterion.priority <= 0 ? "gray" : "yellow"}
                m={0}
                p={0}
                variant="subtle"
                onClick={() => {
                  criterion.priority = criterion.priority <= 0 ? 1 : 0;
                  if (onChange) onChange(criterion);
                }}
              >
                <IconStarFilled size="14pt" />
              </Button>
            </Tooltip>

            {/* Delete button (and any other criterion-specific changes in the future) */}
            <Menu withinPortal position="right-start" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDots style={{ width: rem(16), height: rem(16) }} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  icon={<IconTrash size="14px" />}
                  color="red"
                  onClick={onDelete}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Flex>
      </Card.Section>

      {/* Description of the criteria */}
      <Card.Section p="0px">
        <Collapse in={opened}>
          <Textarea
            value={criterion.criteria}
            placeholder="Describe here."
            onChange={(e) => {
              criterion.criteria = e.target.value;
              if (onChange) onChange(criterion);
            }}
            onClickCapture={(e) => e.stopPropagation()}
            styles={{
              input: {
                border: "none",
                borderWidth: "0px",
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
        </Collapse>
      </Card.Section>
    </Card>
  );
};

export interface EvalGenModalRef {
  trigger: (resps: LLMResponse[]) => void;
}

const EvalGenModal = forwardRef<EvalGenModalRef, NonNullable<unknown>>(
  function EvalGenModal(props, ref) {
    const [opened, { open, close }] = useDisclosure(false);
    const apiKeys = useStore((state) => state.apiKeys);
    const [criteria, setCriteria] = useState<EvalCriteria[]>(INIT_CRITERIA);

    const [responses, setResponses] = useState<LLMResponse[]>([]);
    const [shownResponse, setShownResponse] = useState<LLMResponse | undefined>(
      undefined,
    );
    const [pastShownResponses, setPastShownResponses] = useState<LLMResponse[]>(
      [],
    );
    const [shownResponseIdx, setShownResponseIdx] = useState(0);

    const [annotation, setAnnotation] = useState<string | undefined>(undefined);
    const [holisticGrade, setHolisticGrade] = useState<"good" | "bad" | undefined>(undefined);

    // Per-criteria grades (indexed by uid of response, then uid of criteria)
    const [grades, setGrades] = useState<Dict<Dict<boolean | undefined>>>({});
    const setPerCriteriaGrade = (responseUID: string, criteriaUID: string, newGrade: boolean | undefined) => {
      setGrades((grades) => {
        if (!grades[responseUID]) grades[responseUID] = {};
        grades[responseUID][criteriaUID] = newGrade;
        grades[responseUID] = {...grades[responseUID]};
        return {...grades};
      });
    };

    // The EvalGen object responsible for generating, implementing, and filtering candidate implementations
    const [executor, setExecutor] = useState<EvaluationFunctionExecutor | null>(
      null,
    );
    const [execProgress, setExecProgress] = useState(0);

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

    // Open the EvalGen wizard
    const trigger = (resps: LLMResponse[]) => {
      // We pass the responses here manually to ensure they remain the same
      // for the duration of one EvalGen operation.
      setResponses(resps);
      setGrades(resps.reduce((acc: Dict<Dict<boolean | undefined>>, curr) => {
        acc[curr.uid] = {};
        return acc;
      }, {}));
      setShownResponseIdx(0);
      if (resps.length > 0) {
        const first_resp = sampleRandomElements(resps, 1)[0];
        setShownResponse(first_resp);
        setPastShownResponses([first_resp]);
      } else {
        setShownResponse(undefined);
        setPastShownResponses([]);
      }
      open();
    };
    useImperativeHandle(ref, () => ({
      trigger,
    }));

    // Add a criterion
    const handleAddCriteria = (newCrit: EvalCriteria) => {
      setCriteria((cs) => {
        if (!newCrit.uid) newCrit.uid = uuid();
        return [...cs, newCrit];
      });
    };

    // Modify an existing criterion
    const handleChangeCriteria = (newCrit: EvalCriteria, uid: string) => {
      setCriteria((cs) => {
        const idx = cs.findIndex((c) => c.uid === uid);
        if (idx === -1) {
          console.error("Could not find criteria with uid", uid);
          return cs;
        }
        cs[idx] = newCrit;
        return [...cs];
      });
    };

    // Delete a criterion
    const handleDeleteCriteria = (uid: string) => {
      setCriteria((cs) => {
        return cs.filter((c) => c.uid !== uid);
      });
    };

    // Synthesize a new criteria according to the feedback given for the shown response
    const [isLoadingCriteria, setIsLoadingCriteria] = useState(0);
    const synthNewCriteriaWithLLM = (response: string, feedback: string, grade: "good" | "bad" | "unknown") => {
      // Add a loading Skeleton
      setIsLoadingCriteria((num) => num + 1);
      // Make async LLM call to expand criteria
      generateLLMEvaluationCriteria(
        "",
        apiKeys,
        `I've given some feedback on some text output. Use this feedback to decide on a single evaluation criteria with a yes/no answer. I want you to take the criteria and output a JSON object in the format below. 

TEXT OUTPUT: 
\`\`\`
${response}
\`\`\`

GRADE (whether text was good or bad):
\`\`\`
${grade}
\`\`\`

FEEDBACK: 
\`\`\`
${feedback}
\`\`\`

Your response should contain a short title for the criteria ("shortname"), a description of the criteria in 2 sentences ("criteria"), and whether it should be evaluated with "code", or by an "expert" if the criteria is difficult to evaluate ("eval_method"). Your answer should be JSON within a \`\`\`json \`\`\` marker, with the following three fields: "criteria", "shortname", and "eval_method" (code or expert). The "criteria" should expand upon the user's input, the "shortname" should be a very brief title for the criteria, and this list should contain as many evaluation criteria as you can think of. Each evaluation criteria should test a unit concept that should evaluate to "true" in the ideal case. Only output JSON, nothing else.`, // prompt
        "gpt-4-turbo", // llm
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
        console.log("setting annotation for resp", shownResponse.uid, annotation);
        updateGlobalRating(shownResponse.uid, "note", { 0: annotation });
        setAnnotation("");
      }
      // @ts-expect-error The only way to deselect the Radio.Group is to set it to null. Undefined doesn't work.
      setHolisticGrade(null);

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
          (!next_resp ||
            pastShownResponses.some((r) => r.uid === next_resp?.uid))
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
        setShownResponse(next_resp ?? undefined);
        if (next_resp)
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

    return (
      <Modal
        size="90%"
        keepMounted
        opened={opened}
        onClose={close}
        closeOnClickOutside={true}
        style={{ position: "relative", left: "-5%" }}
      >
        <Grid h={window?.innerHeight * 0.8}>
          <Grid.Col span={8}>
            <Stack justify="space-between">
              {/* View showing the response the user is currently grading */}
              <GradingView
                shownResponse={shownResponse}
                gotoNextResponse={nextResponse}
                gotoPrevResponse={prevResponse}
              />

              {/* Progress bar */}
              {/* <Flex justify="left" align="center" gap="md">
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
              </Flex> */}
            </Stack>
          </Grid.Col>
          <Grid.Col span={4} bg="#eee" pt="16px" h="100%">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <div style={{ flex: 2, overflowY: "auto" }}>
                {criteria.map((e) => (
                  <CriteriaCard
                    criterion={e}
                    key={e.uid}
                    onChange={(newCrit) => handleChangeCriteria(newCrit, e.uid)}
                    onDelete={() => handleDeleteCriteria(e.uid)}
                    grade={shownResponse ? grades[shownResponse.uid][e.uid] : undefined}
                    onChangeGrade={(newGrade) => {
                      if (shownResponse)
                        setPerCriteriaGrade(shownResponse.uid, e.uid, newGrade);
                    }}
                    initiallyOpen={true}
                  />
                ))}
                { isLoadingCriteria > 0 ? Array.from({length: isLoadingCriteria}, () => <Skeleton h={80} mb={4} />) : <></>}
                <Center>
                  <button
                    onClick={() => {
                      handleAddCriteria({
                        shortname: "New Criteria",
                        criteria: "",
                        eval_method: "code",
                        priority: 0,
                        uid: uuid(),
                      });
                    }}
                  >
                    +
                  </button>
                </Center>
              </div>

              <Stack spacing="0px" pl="xs" pr="lg" style={{ flex: 1 }}>
                <Divider mt="lg" />
                <Title mb="0px" order={4}>
                  Provide Additional Feedback
                </Title>
                <Textarea
                  value={annotation}
                  onChange={(e) => setAnnotation(e.target.value)}
                  description="How good is this response? Explain anything not captured under your existing criteria. Your feedback will be used to generate new criteria."
                  mb="sm"
                />
                <Radio.Group
                  name="favoriteFramework"
                  label="Rate the response holistically:"
                  value={holisticGrade}
                  onChange={(v) => setHolisticGrade(v as ("good" | "bad"))}
                  withAsterisk
                  mb="md"
                >
                  <Group mt="xs">
                    <Radio value="good" label="Good" />
                    <Radio value="bad" label="Bad" />
                  </Group>
                </Radio.Group>

                <Button
                  color="green"
                  variant="filled"
                  disabled={!holisticGrade || (annotation === undefined || annotation.length === 0)}
                  onClick={() => {
                    synthNewCriteriaWithLLM(shownResponse?.responses[0].toString() ?? "", annotation ?? "", holisticGrade ?? "unknown")
                    nextResponse();
                  }}
                >
                  + Submit Feedback
                </Button>
              </Stack>
            </div>
          </Grid.Col>
        </Grid>
      </Modal>
    );
  },
);

const HeaderText = ({ children }: { children: ReactNode }) => {
  return (
    <Text size="xl" fw={500} pl="sm" mb="lg">
      {children}
    </Text>
  );
};

interface GradingViewProps {
  shownResponse: LLMResponse | undefined;
  gotoPrevResponse: () => void;
  gotoNextResponse: () => void;
}

const GradingView: React.FC<GradingViewProps> = ({
  shownResponse,
  gotoPrevResponse,
  gotoNextResponse,
}) => {
  // Calculate inner values only when shownResponse changes
  const responseText = useMemo(
    () =>
      shownResponse && shownResponse.responses?.length > 0
        ? shownResponse.responses[0].toString()
        : "",
    [shownResponse],
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

  return (
    <Stack justify="space-between" mih={500}>
      <Box>
        {/* Top header */}
        <Flex justify="center">
          <HeaderText>What do you think of this response?</HeaderText>
        </Flex>

        {/* Middle response box with chevron buttons < and > for going back and forward a response */}
        <Flex justify="center" align="center" mb="sm">
          {/* Go back to previous response */}
          <Button variant="white" color="dark" onClick={gotoPrevResponse}>
            <IconChevronLeft />
          </Button>

          {/* The response one is currently grading */}
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

          {/* Go forward to the next response */}
          <Button variant="white" color="dark" onClick={gotoNextResponse}>
            <IconChevronRight />
          </Button>
        </Flex>

        {/* Views for the vars (inputs) that generated this response, and the concrete prompt */}
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
      </Box>
    </Stack>
  );
};

export default EvalGenModal;
