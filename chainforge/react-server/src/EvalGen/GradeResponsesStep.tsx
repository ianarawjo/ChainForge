import React, { useCallback, useEffect, useState } from "react";
import { EvalCriteria } from "../backend/evalgen/typing";
import { Dict, LLMResponse } from "../backend/typing";
import {
  ActionIcon,
  Button,
  Center,
  Flex,
  Grid,
  Group,
  rem,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import GradingView from "./GradingView";
import { useDisclosure } from "@mantine/hooks";
import { v4 as uuid } from "uuid";
import {
  IconRobot,
  IconTerminal2,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from "@tabler/icons-react";
import {
  generateLLMEvaluationCriteria,
  getPromptForGenEvalCriteriaFromDesc,
} from "../backend/evalgen/utils";
import useStore from "../store";
import EvaluationFunctionExecutor from "../backend/evalgen/executor";

const ThumbUpDownButtons = ({
  grade,
  onChangeGrade,
  getGradeCount,
}: {
  grade: boolean | undefined;
  onChangeGrade: (newGrade: boolean | undefined) => void;
  getGradeCount: (grade: boolean | undefined) => number;
}) => {
  const true_count = getGradeCount(true);
  const false_count = getGradeCount(false);

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
        <div className="gradeContainer">
          <IconThumbUp size="20pt" fill={grade === true ? "#aea" : "white"} />
          {true_count > 0 && <div className="gradeUpCount">{true_count}</div>}
        </div>
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
        <div className="gradeContainer">
          <IconThumbDown
            size="20pt"
            fill={grade === false ? "pink" : "white"}
          />
          {false_count > 0 && (
            <div className="gradeDownCount">{false_count}</div>
          )}
        </div>
      </Button>
    </>
  );
};

interface CriteriaCardProps {
  criterion: EvalCriteria;
  onChange: (changedCriteria: EvalCriteria) => void;
  onDelete: () => void;
  initiallyOpen?: boolean;
  grade: boolean | undefined;
  onChangeGrade: (newGrade: boolean | undefined) => void;
  getGradeCount: (grade: boolean | undefined) => number;
  getStateValue: (stateId: number) => number;
}

const CriteriaCard: React.FC<CriteriaCardProps> = ({
  criterion,
  onChange,
  onDelete,
  initiallyOpen,
  grade,
  getGradeCount,
  onChangeGrade,
  getStateValue,
}) => {
  const [opened, { toggle }] = useDisclosure(initiallyOpen ?? false);
  const [title, setTitle] = useState(criterion.shortname ?? "New Criteria");

  return (
    <Stack spacing={0} ml={8}>
      <Flex align="center">
        <Group spacing="0px">
          {/* Thumbs up/down buttons */}
          <ThumbUpDownButtons
            grade={grade}
            onChangeGrade={onChangeGrade}
            getGradeCount={getGradeCount}
          />

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
            size="md"
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

          {/* <Contributor getStateValue={getStateValue} /> */}

          {/* Delete button (and any other criterion-specific changes in the future) */}
          <ActionIcon variant="subtle" color="red" onClick={onDelete}>
            <IconTrash style={{ width: rem(16), height: rem(16) }} />
          </ActionIcon>
        </Group>
      </Flex>

      <Textarea
        value={criterion.criteria}
        placeholder="Describe here. You must describe what the criteria means before EvalGen can implement it."
        size="xs"
        ml={38}
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
            paddingTop: "4px !important",
            paddingBottom: "4px !important",
          },
        }}
        autosize
        minRows={2}
        maxRows={5}
        fz="sm"
        mb="xs"
        c="dimmed"
      />
    </Stack>
  );
};

interface GradingResponsesStepProps {
  onNext: () => void;
  onPrevious: () => void;
  executor: EvaluationFunctionExecutor | null;
  logs: { date: Date; message: string }[];
  genAIModelNames: { large: string; small: string };
  numCallsMade: { strong: number; weak: number };
  responses: LLMResponse[];
  criteria: EvalCriteria[];
  setCriteria: React.Dispatch<React.SetStateAction<EvalCriteria[]>>;
  grades: Dict<Dict<boolean | undefined>>; // per-criteria grades
  setPerCriteriaGrade: (
    responseUID: string,
    criteriaUID: string,
    newGrade: boolean | undefined,
  ) => void;
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const GradingResponsesStep: React.FC<GradingResponsesStepProps> = ({
  onNext,
  onPrevious,
  executor,
  logs,
  genAIModelNames,
  numCallsMade,
  responses,
  criteria,
  setCriteria,
  grades,
  setPerCriteriaGrade,
  setOnNextCallback,
}) => {
  const apiKeys = useStore((state) => state.apiKeys);
  const [shownResponse, setShownResponse] = useState<LLMResponse | undefined>(
    undefined,
  );
  const [pastShownResponses, setPastShownResponses] = useState<LLMResponse[]>(
    [],
  );
  const [shownResponseIdx, setShownResponseIdx] = useState(0);

  const [newCriteriaDesc, setNewCriteriaDesc] = useState("");

  const getStateValue = (stateId: number) => {
    return Math.floor(Math.random() * 30 + 6);
  };
  const getGradeCount = (criteriaUID: string, grade: boolean | undefined) => {
    let count = 0;
    for (const respUid in grades) {
      count += grade === grades[respUid][criteriaUID] ? 1 : 0;
    }
    return count;
  };

  useEffect(() => {
    if (!responses || responses.length === 0) return;
    setShownResponse(responses[0]);
    setShownResponseIdx(0);
  }, [responses]);

  const nextResponse = useCallback(() => {
    if (responses.length === 0) return;
    if (shownResponseIdx < responses.length - 1) {
      setShownResponseIdx(shownResponseIdx + 1);
      setShownResponse(responses[shownResponseIdx + 1]);
    }
  }, [shownResponseIdx, responses]);

  const prevResponse = useCallback(() => {
    if (shownResponseIdx > 0) {
      setShownResponseIdx(shownResponseIdx - 1);
      setShownResponse(responses[shownResponseIdx - 1]);
    }
  }, [shownResponseIdx, responses]);

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
  const synthNewCriteriaWithLLM = (
    response: string,
    feedback: string,
    grade: "good" | "bad" | "unknown",
  ) => {
    // Add a loading Skeleton
    setIsLoadingCriteria((num) => num + 1);
    // Make async LLM call to expand criteria only if the feedback contains some idea of a constraint on the output and isn't covered by existing criteria
    const prettyCriteria = criteria
      .map((crit) => {
        return `${crit.shortname}: ${crit.criteria}`;
      })
      .join("\n");

    generateLLMEvaluationCriteria(
      "",
      genAIModelNames.large,
      apiKeys,
      `I've given some feedback on some text output. Use this feedback to decide on a single new evaluation criteria with a yes/no answer, only if the feedback isn't encompassed by existing criteria. I want you to take the criteria and output a JSON object in the format below. 
  
  TEXT OUTPUT: 
  \`\`\`
  ${response}
  \`\`\`
  
  EXISTING CRITERIA:
  \`\`\`
  ${prettyCriteria}
  \`\`\`
  
  GRADE (whether text was good or bad):
  \`\`\`
  ${grade}
  \`\`\`
  
  FEEDBACK: 
  \`\`\`
  ${feedback}
  \`\`\`
  
  If you determine the feedback corresponds to a new criteria, your response should contain a short title for the criteria ("shortname"), a description of the criteria in 2 sentences ("criteria"), and whether it should be evaluated with "code", or by an "expert" if the criteria is difficult to evaluate ("eval_method"). Your answer should be JSON within a \`\`\`json \`\`\` marker, with the following three fields: "criteria", "shortname", and "eval_method" (code or expert). The "criteria" should expand upon the user's input, the "shortname" should be a very brief title for the criteria, and this list should contain as many evaluation criteria as you can think of. Each evaluation criteria should test a unit concept that should evaluate to "true" in the ideal case. Only output JSON, nothing else. Output an empty list if there is no new evaluation criteria`, // prompt
      "gpt-4o", // llm
    )
      .then((evalCrits) => {
        // Take only the first if evalCrits has a nonempty list
        if (evalCrits[0]) {
          setCriteria((crit) =>
            crit.concat([
              {
                ...evalCrits[0],
                uid: uuid(),
              },
            ]),
          );
        }
        // Remove a loading Skeleton
        setIsLoadingCriteria((num) => num - 1);
        // setNumGPT4Calls((num) => num + 1);
      })
      .catch((err) => {
        console.error(err);
        setIsLoadingCriteria((num) => num - 1);
      });
  };

  const addCriteria = (desc: string) => {
    // Add a loading Skeleton
    setIsLoadingCriteria((num) => num + 1);
    // Make async LLM call to expand criteria
    generateLLMEvaluationCriteria(
      "",
      genAIModelNames.large,
      apiKeys,
      getPromptForGenEvalCriteriaFromDesc(desc), // prompt
      null, // system_msg
    )
      .then((evalCrits) => {
        // Take only the first suggested by the model, if any
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

  return (
    <Grid h="100%">
      <Grid.Col span={8}>
        <Stack justify="space-between">
          {/* View showing the response the user is currently grading */}
          <GradingView
            shownResponse={shownResponse}
            shownResponseIdx={shownResponseIdx}
            responseCount={responses.length}
            gotoNextResponse={nextResponse}
            gotoPrevResponse={prevResponse}
          />

          <Flex direction="column">
            <Flex justify="space-between" align="center">
              <Text size="lg" weight={500} mb="sm">
                LLM Activity
              </Text>
              {/* GPT Call Tally */}
              <Text size="sm" color="dark" style={{ fontStyle: "italic" }}>
                Executed {numCallsMade.strong} {genAIModelNames.large} calls and{" "}
                {numCallsMade.weak} {genAIModelNames.small} calls.
              </Text>
            </Flex>
            <div
              style={{
                backgroundColor: "#f0f0f0",
                color: "#333",
                fontFamily: "monospace",
                fontSize: "8pt",
                padding: "12px",
                lineHeight: "1.2",
                width: "calc(100% - 10px)",
                height: "200px",
                overflowY: "auto",
                borderRadius: "8px",
                border: "1px solid #ddd",
                marginRight: "10px", // Space on the right
              }}
              ref={(el) => {
                if (el) {
                  el.scrollTop = el.scrollHeight;
                }
              }}
            >
              {logs.map((log, index) => (
                <div key={index}>
                  <span style={{ color: "#4A90E2" }}>
                    {log.date.toLocaleString()} -{" "}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </Flex>

          {/* Progress bar */}
          {/* <Flex justify="left" align="center" gap="md">
                    <Stack w="100%" spacing={4}>
                      <Text color="#aaa" size="sm">
                        {bottomBar.progressLabel}
                      </Text>
                      <Progress w="100%" value={bottomBar.progressPerc} mb="0px" />
                    </Stack>
                  </Flex> */}
        </Stack>
      </Grid.Col>
      <Grid.Col
        span={4}
        bg="#eee"
        pt="16px"
        h="100%"
        style={{ boxShadow: "-10px 0px 20px #aaa" }}
      >
        <Center>
          <Title order={3} ml={8} mt="sm" mb="md">
            Per-criteria grading
          </Title>
        </Center>

        <ScrollArea
          h="75%"
          offsetScrollbars
          style={{ border: "1px solid #ccc" }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: "40px",
            }}
          >
            <div style={{ flex: 2, overflowY: "auto" }}>
              {criteria.map((e) => (
                <CriteriaCard
                  criterion={e}
                  key={e.uid}
                  onChange={(newCrit) => handleChangeCriteria(newCrit, e.uid)}
                  onDelete={() => handleDeleteCriteria(e.uid)}
                  grade={
                    shownResponse && grades[shownResponse.uid]
                      ? grades[shownResponse.uid][e.uid]
                      : undefined
                  }
                  getGradeCount={(grade) => {
                    return shownResponse
                      ? getGradeCount(
                          // shownResponse.uid,
                          e.uid,
                          grade,
                        )
                      : 0;
                  }}
                  onChangeGrade={(newGrade) => {
                    if (shownResponse)
                      setPerCriteriaGrade(shownResponse.uid, e.uid, newGrade);
                  }}
                  initiallyOpen={true}
                  getStateValue={(stateId) => getStateValue(stateId)}
                />
              ))}
              {isLoadingCriteria > 0 ? (
                Array.from(
                  { length: isLoadingCriteria },
                  (v: unknown, idx: number) => (
                    <Skeleton key={idx} h={80} mb={4} />
                  ),
                )
              ) : (
                <></>
              )}
            </div>

            <div className="criteriaButtons">
              {/* <Popover withArrow>
              <Popover.Target>
              <Button
                leftIcon={<IconPencil size={14} />}
                variant="subtle"
                color="gray"
                // gradient={{ from: "blue", to: "green", deg: 90 }}
                // onClick={() => {
                //   handleAddCriteria({
                //     shortname: "New Criteria",
                //     criteria: "",
                //     eval_method: "code",
                //     priority: 0,
                //     uid: uuid(),
                //   });
                // }}
              >
                Add a new criteria
              </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Flex justify="space-around" align="center" gap="md">
                  <Textarea label="Describe the critera:">Hello</Textarea>
                  <Button>Submit</Button>
                </Flex>
                
              </Popover.Dropdown>
            </Popover> */}

              {/* <Button
                leftIcon={<IconSparkles size={14} />}
                variant="subtle"
                color="gray"
                // gradient={{ from: "blue", to: "green", deg: 90 }}
                onClick={() => {
                  generateCriteria(responses);
                }}
              >
                Suggest Criteria
              </Button> */}
            </div>

            {/* <Stack spacing="0px" pl="xs" pr="lg" style={{ flex: 1 }}>
            <Divider mt="lg" />
            <Title mb="0px" order={4}>
              Suggest New Criteria
            </Title>
            <Textarea
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              description="How good is this response? Explain anything not captured under your existing criteria. Your feedback will be used to generate new criteria."
              mb="sm"
            /> */}
            {/* <Radio.Group
              name="favoriteFramework"
              label="Rate the response holistically:"
              value={holisticGrade}
              onChange={(v) => setHolisticGrade(v as "good" | "bad")}
              withAsterisk
              mb="md"
            >
              <Group mt="xs">
                <Radio value="good" label="Good" />
                <Radio value="bad" label="Bad" />
                <span>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </span>
                <Button
                  color="green"
                  variant="filled"
                  disabled={
                    !holisticGrade ||
                    annotation === undefined ||
                    annotation.length === 0
                  }
                  onClick={() => {
                    synthNewCriteriaWithLLM(
                      shownResponse?.responses[0].toString() ?? "",
                      annotation ?? "",
                      holisticGrade ?? "unknown",
                    );

                    nextResponse();
                  }}
                >
                  + Submit Feedback
                </Button>
              </Group>
            </Radio.Group> */}
            {/* </Stack> */}
          </div>

          <Textarea
            value={newCriteriaDesc}
            onChange={(e) => setNewCriteriaDesc(e.currentTarget.value)}
            label="Add new criteria:"
            placeholder="Describe the criteria to add."
            ml="md"
            mr="md"
          ></Textarea>
          <Group position="right" mr="md" mt="sm">
            <Button
              color="green"
              variant="filled"
              disabled={
                newCriteriaDesc?.trim().length === 0 || isLoadingCriteria > 0
              }
              onClick={() => {
                addCriteria(newCriteriaDesc);
                setNewCriteriaDesc("");
              }}
            >
              + Add criteria
            </Button>
          </Group>
        </ScrollArea>
      </Grid.Col>
    </Grid>
  );
};

export default GradingResponsesStep;
