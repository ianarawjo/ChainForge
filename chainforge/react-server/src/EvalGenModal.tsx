/**
 * EvalGen 2.0
 *
 * Ian Arawjo, Shreya Shankar, J.D. Zamf., Helen Weixu Chen
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
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { v4 as uuid } from "uuid";
import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Code,
  Collapse,
  Divider,
  Flex,
  Grid,
  Group,
  Menu,
  Modal,
  Radio,
  RingProgress,
  ScrollArea,
  SimpleGrid,
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
import {
  // CriteriaGradeCount,
  Dict,
  LLMResponse,
  PromptVarsDict,
  RatingDict,
  ResponseUID,
} from "./backend/typing";
import { EvalCriteria, EvalGenReport } from "./backend/evalgen/typing";
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
  IconFlagFilled,
  IconPencil,
  IconSparkles,
} from "@tabler/icons-react";
import {
  cleanMetavarsFilterFunc,
  deepcopy,
  sampleRandomElements,
  transformDict,
} from "./backend/utils";
import {
  extractUIDFromRatingKey,
  getRatingKeyForResponse,
} from "./ResponseRatingToolbar";
import useStore from "./store";
import StorageCache from "./backend/cache";
import EvaluationFunctionExecutor from "./backend/evalgen/executor";
import { generateLLMEvaluationCriteria } from "./backend/evalgen/utils";
import { escapeBraces } from "./backend/template";
import { update } from "lodash";
// import "./EvalGenModel.css";

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

const Contributor = ({
  getStateValue,
  style = { size: 22, thickness: 4 },
}: {
  getStateValue: (id: number) => number;
  style: { size: number; thickness: number };
}) => {
  return (
    <RingProgress
      size={style.size}
      thickness={style.thickness}
      // label=""
      sections={[
        {
          value: getStateValue(1),
          color: "cyan",
          tooltip: "You have successfully contributed 7 responses.",
        },
        {
          value: getStateValue(2),
          color: "orange",
          tooltip: "You have successfully contributed 20 responses.",
        },
        {
          value: getStateValue(3),
          color: "green",
          tooltip: "You have gone to buffet 100 times.",
        },
        {
          value: getStateValue(4),
          color: "grape",
          tooltip: "You have made 21 nightmare",
        },
      ]}
    />
  );
};

const ThumbUpDownButtons = ({
  grade,
  onChangeGrade,
  getGradeCount,
}: {
  grade: boolean | undefined;
  onChangeGrade: (newGrade: boolean | undefined) => void;
  getGradeCount: (grade: boolean | undefined) => number;
}) => {
  // console.log(
  //   "getGradeCount",
  //   getGradeCount(true),
  //   getGradeCount(false),
  //   getGradeCount(undefined),
  // );
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
          <IconThumbUp size="14pt" fill={grade === true ? "#aea" : "white"} />
          <div className="gradeUpCount">{getGradeCount(true)}</div>
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
            size="14pt"
            fill={grade === false ? "pink" : "white"}
          />
          <div className="gradeDownCount">{getGradeCount(false)}</div>
        </div>
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
            <ThumbUpDownButtons
              grade={grade}
              onChangeGrade={onChangeGrade}
              getGradeCount={getGradeCount}
            />
            <Contributor getStateValue={getStateValue} />

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
                color={criterion.priority <= 0 ? "gray" : "red"}
                m={0}
                p={0}
                variant="subtle"
                onClick={() => {
                  criterion.priority = criterion.priority <= 0 ? 1 : 0;
                  if (onChange) onChange(criterion);
                }}
              >
                {/* <IconStarFilled size="14pt" /> */}
                <IconFlagFilled size="14pt" />
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
  trigger: (
    resps: LLMResponse[],
    setFinalReports: (reports: EvalGenReport) => void,
  ) => void;
}

const EvalGenModal = forwardRef<EvalGenModalRef, NonNullable<unknown>>(
  function EvalGenModal(props, ref) {
    const [opened, { open, close }] = useDisclosure(false);
    const apiKeys = useStore((state) => state.apiKeys);
    const globalState = useStore((store) => store.state);
    const [criteria, setCriteria] = useState<EvalCriteria[]>([]);
    const [criteriaForDisplay, setCriteriaForDisplay] = useState<
      EvalCriteria[]
    >([]);

    const [responses, setResponses] = useState<LLMResponse[]>([]);
    const [shownResponse, setShownResponse] = useState<LLMResponse | undefined>(
      undefined,
    );
    const [pastShownResponses, setPastShownResponses] = useState<LLMResponse[]>(
      [],
    );
    const [shownResponseIdx, setShownResponseIdx] = useState(0);
    // const [shownResponseUniqueIdx, setShownResponseUniqueIdx] = useState(0);

    const [annotation, setAnnotation] = useState<string | undefined>(undefined);
    const [holisticGrade, setHolisticGrade] = useState<
      "good" | "bad" | undefined
    >(undefined);

    // Per-criteria grades (indexed by uid of response, then uid of criteria)
    const [grades, setGrades] = useState<Dict<Dict<boolean | undefined>>>({});
    const setPerCriteriaGrade = (
      responseUID: string,
      criteriaUID: string,
      newGrade: boolean | undefined,
    ) => {
      setGrades((grades) => {
        if (!grades[responseUID]) grades[responseUID] = {};
        grades[responseUID][criteriaUID] = newGrade;
        // grades[responseUID] = { ...grades[responseUID] };
        // console.error("grades-2", grades);
        return { ...grades };
      });
      updateGlobalRating(responseUID, "perCriteriaGrades", grades[responseUID]);
    };
    const getStateValue = (stateId: number) => {
      return Math.floor(Math.random() * 30 + 6);
    };
    const getGradeCount = (
      // responseUID: string,
      criteriaUID: string,
      grade: boolean | undefined,
    ) => {
      // console.log("getGradeCount", responseUID, criteriaUID, grade);
      // console.log("getGradeCount", grades);

      let count = 0;
      for (const respUid in grades) {
        count += grade === grades[respUid][criteriaUID] ? 1 : 0;
      }
      return count;

      // if (grades[responseUID]) {
      //   let count = 0;
      //   for (const critUid in grades[responseUID]) {
      //     count += grades[responseUID][critUid] ? 1 : 0;
      //   }
      //   // return grade === grades[responseUID][criteriaUID] ? 1 : 0; // this needs to be changed after the grading feature is fully implemented on server side.
      //   return count;
      //   // return 10;
      // }

      // if (grades[responseUID]) {
      //   return grade === grades[responseUID][criteriaUID] ? 1 : 0; // this needs to be changed after the grading feature is fully implemented on server side.
      // }
      // return 0;
    };

    // The EvalGen object responsible for generating, implementing, and filtering candidate implementations
    const [executor, setExecutor] = useState<EvaluationFunctionExecutor | null>(
      null,
    );

    const [execProgress, setExecProgress] = useState(0);

    // State variables to keep track of GPT call counts
    const [numGPT4Calls, setNumGPT4Calls] = useState(0);
    const [numGPT35Calls, setNumGPT35Calls] = useState(0);
    const [logs, setLogs] = useState<{ date: Date; message: string }[]>([]);

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

    // console.error("criteria", criteria);

    // Update executor whenever resps, grades, or criteria change
    React.useEffect(() => {
      if (criteria.length > 0 && !executor) {
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

        const addLog = (message: string) => {
          setLogs((prevLogs) => [...prevLogs, { date: new Date(), message }]);
        };

        const ex = new EvaluationFunctionExecutor(
          getLikelyPromptTemplateAsContext(responses),
          responses,
          criteria,
          (gpt4Calls, gpt35Calls) => {
            // Callback to update GPT call counts
            setNumGPT4Calls((num) => num + gpt4Calls);
            setNumGPT35Calls((num) => num + gpt35Calls);
          },
          addLog,
          existingGrades,
          grades,
        );
        setExecutor(ex);

        setExecProgress(0);
        ex.start((progress) => {
          setExecProgress(progress?.success ?? 0);
        });
      } else if (executor) {
        // Update criteria in executor
        executor.addCriteria(criteria);
      }

      updateCriteriaForDisplay();
    }, [criteria]);

    const generateCriteria = (resps) => {
      // Create criteria
      // setIsLoadingCriteria((num) => num + 3);
      genCriteriaFromContext(resps)
        .then((crits) => {
          console.log("crits #1", crits);
          crits = [...criteria, ...crits];
          console.log("crits #2", crits);
          setCriteria(crits.map((c) => ({ ...c, uid: uuid() })));
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          setIsLoadingCriteria((num) => num - 3);
          setNumGPT4Calls((num) => num + 1);
        });
    };

    // const defaultOnFinish = (reports: string) => {};
    const [onFinish, setOnFinish] = useState({
      setFinalRpts: (reports: EvalGenReport) => {
        // console.log("");
      },
    });

    // Open the EvalGen wizard
    const trigger = (
      resps: LLMResponse[],
      setFinalReports: (reports: EvalGenReport) => void,
    ) => {
      // We pass the responses here manually to ensure they remain the same
      // for the duration of one EvalGen operation.
      setResponses(resps);
      gotoNextScreen("response");
      // setFinalReports("A plenty response");
      setOnFinish({
        setFinalRpts: (reports: EvalGenReport) => {
          close();
          setFinalReports(reports);
        },
      });

      const firstGrades = resps.reduce(
        (acc: Dict<Dict<boolean | undefined>>, curr) => {
          if (!(curr.uid in acc)) acc[curr.uid] = {};
          return acc;
        },
        grades,
      );
      setGrades(firstGrades);

      console.log("*****************************resps", resps);
      if (criteria && criteria.length === 0) {
        generateCriteria(resps);
      }

      setShownResponseIdx(0);
      if (resps.length > 0) {
        const first_resp = sampleRandomElements(resps, 1)[0];
        // setShownResponse(first_resp);
        setPastShownResponses([first_resp]);
      } else {
        // setShownResponse(undefined);
        setPastShownResponses([]);
      }
      setShownResponse(resps[shownResponseIdx]);
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

    const getLikelyPromptTemplateAsContext = (resps) => {
      // Attempt to infer the prompt template used to generate the responses:
      const prompts = new Set();
      for (const resp_obj of resps) {
        if (resp_obj?.metavars?.__pt !== undefined) {
          prompts.add(resp_obj.metavars.__pt);
        }
      }

      if (prompts.size === 0) return null;

      // Pick a prompt template at random to serve as context....
      return escapeBraces(prompts.values().next().value);
    };

    async function genCriteriaFromContext(responses) {
      // Get the context from the input responses
      const inputPromptTemplate = getLikelyPromptTemplateAsContext(responses);

      if (inputPromptTemplate === null) {
        console.error("No context found. Cannot proceed.");
        return;
      }

      // Attempt to generate criteria using an LLM
      return await generateLLMEvaluationCriteria(inputPromptTemplate, apiKeys);
    }

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

          setNumGPT4Calls((num) => num + 1);
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
        grades[shownResponse.uid] ||
        holisticGrade ||
        (annotation && annotation.trim())
      ) {
        executor?.setGradeForExample(
          shownResponse.uid,
          grades[shownResponse.uid],
          holisticGrade,
          annotation ? annotation.trim() : null,
        );
      }

      if (
        shownResponse &&
        annotation &&
        typeof annotation === "string" &&
        annotation.trim().length > 0
      ) {
        console.log(
          "setting annotation for resp",
          shownResponse.uid,
          annotation,
        );
        updateGlobalRating(shownResponse.uid, "note", { 0: annotation });
        setAnnotation("");
      }

      if (shownResponse && holisticGrade) {
        updateGlobalRating(shownResponse.uid, "grade", {
          0: holisticGrade === "good",
        });
      }

      if (shownResponse && grades[shownResponse.uid]) {
        updateGlobalRating(
          shownResponse.uid,
          "perCriteriaGrades",
          grades[shownResponse.uid],
        );
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
      updateShownResponseUniqueIndex();
    };

    // Go back to previously shown response
    const prevResponse = () => {
      if (pastShownResponses.length === 0 || shownResponseIdx === 0) return;
      setShownResponse(pastShownResponses[shownResponseIdx - 1]);
      setShownResponseIdx(shownResponseIdx - 1); // decrement shown resp idx
      updateShownResponseUniqueIndex();
    };

    const updateShownResponseUniqueIndex = () => {
      let idx = 0;
      for (const resp of responses) {
        if (resp === shownResponse) {
          setShownResponseUniqueIdx(idx);
          break;
        }
        idx++;
      }
    };

    const nextResponse2 = () => {
      if (responses.length === 0) return;
      if (shownResponseIdx < responses.length - 1) {
        // setShownResponse(responses[shownResponseIdx + 1]);
        setShownResponseIdx(shownResponseIdx + 1);
      }
    };

    const prevResponse2 = () => {
      if (shownResponseIdx > 0) {
        // setShownResponse(responses[shownResponseIdx - 1]);
        setShownResponseIdx(shownResponseIdx - 1); // decrement shown resp idx
      }
    };

    React.useEffect(() => {
      setShownResponse(responses[shownResponseIdx]);
    }, [shownResponseIdx]);

    const estimateGPTCalls = () => {
      return executor
        ? `This will trigger around ${executor.estimateNumGPTCalls(grades[shownResponse?.uid]).numGPT4Calls} GPT-4o and ${executor.estimateNumGPTCalls(grades[shownResponse?.uid]).numGPT35Calls} GPT-3.5-turbo-16k calls.`
        : "# estimated GPT calls not available.";
    };

    const updateCriteriaForDisplay = () => {
      const highCriteria = criteria.filter((c) => c.priority === 1);
      const lowCriteria = criteria.filter((c) => c.priority === 0);
      setCriteriaForDisplay(highCriteria.concat(lowCriteria));
    };
    useEffect(() => {
      const highCriteria = criteria.filter((c) => c.priority === 1);
      const lowCriteria = criteria.filter((c) => c.priority === 0);
      setCriteriaForDisplay(highCriteria.concat(lowCriteria));
    }, [criteria]);

    const [screen, setScreen] = useState("");
    const gotoNextScreen = (screenName: string) => {
      setScreen(screenName);
    };

    // const [onFinish, setOnFinish] = useState(null);

    return (
      <Modal
        size="90%"
        keepMounted
        opened={opened}
        onClose={close}
        closeOnClickOutside={true}
        style={{ position: "relative", left: "-5%" }}
      >
        {screen === "response" && (
          <Grid h={window?.innerHeight * 0.8}>
            <Grid.Col span={8}>
              <Stack justify="space-between">
                {/* View showing the response the user is currently grading */}
                <GradingView
                  shownResponse={shownResponse}
                  shownResponseIdx={shownResponseIdx}
                  // shownResponseIdx={shownResponseUniqueIdx}
                  responseCount={responses.length}
                  numGPT4Calls={numGPT4Calls}
                  numGPT35Calls={numGPT35Calls}
                  logs={logs}
                  gotoNextResponse={nextResponse2}
                  gotoPrevResponse={prevResponse2}
                  estimateGPTCalls={estimateGPTCalls}
                  gotoNextScreen={gotoNextScreen}
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
                  {criteriaForDisplay.map((e) => (
                    <CriteriaCard
                      criterion={e}
                      key={e.uid}
                      onChange={(newCrit) =>
                        handleChangeCriteria(newCrit, e.uid)
                      }
                      onDelete={() => handleDeleteCriteria(e.uid)}
                      grade={
                        shownResponse
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
                          setPerCriteriaGrade(
                            shownResponse.uid,
                            e.uid,
                            newGrade,
                          );
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
                  {/* <Center> */}
                  <div className="criteriaButtons">
                    {/* <button
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
                  </button> */}
                    <Button
                      leftIcon={<IconPencil size={14} />}
                      variant="filled"
                      // gradient={{ from: "blue", to: "green", deg: 90 }}
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
                      New Criteria
                    </Button>
                    {/* </Center>
                <Center> */}
                    <Button
                      leftIcon={<IconSparkles size={14} />}
                      variant="filled"
                      // gradient={{ from: "blue", to: "green", deg: 90 }}
                      onClick={() => {
                        generateCriteria(responses);
                      }}
                    >
                      Suggest Criteria
                    </Button>
                    {/* </Center> */}
                  </div>
                </div>

                <Stack spacing="0px" pl="xs" pr="lg" style={{ flex: 1 }}>
                  <Divider mt="lg" />
                  <Title mb="0px" order={4}>
                    Suggest New Criteria Based on the Feedback
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
                  </Radio.Group>
                </Stack>
              </div>
            </Grid.Col>
          </Grid>
        )}
        {screen === "report" && (
          <Grid>
            <ReportCardView
              report={{
                criteria: criteria,
                failureCoverage: 99.2,
                falseFailureRate: 66.7,
              }}
              onFinish={(reports: EvalGenReport) => {
                onFinish.setFinalRpts(reports);
              }}
              getGradeCount={(crit: EvalCriteria, grade: boolean) => {
                return shownResponse
                  ? getGradeCount(
                      // shownResponse.uid,
                      crit.uid,
                      grade,
                    )
                  : 0;
              }}
              getStateValue={(stateId) => getStateValue(stateId)}
            />
          </Grid>
        )}
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
  shownResponseIdx: number;
  responseCount: number;
  numGPT4Calls: number;
  numGPT35Calls: number;
  logs: { date: Date; message: string }[];
  gotoPrevResponse: () => void;
  gotoNextResponse: () => void;
  estimateGPTCalls: () => string;
  gotoNextScreen: (screenName: string) => void;
}

const GradingView: React.FC<GradingViewProps> = ({
  shownResponse,
  shownResponseIdx,
  responseCount,
  numGPT4Calls,
  numGPT35Calls,
  logs,
  gotoPrevResponse,
  gotoNextResponse,
  estimateGPTCalls,
  gotoNextScreen,
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

    // console.log("**************shownResponse", shownResponse);
    return Object.entries(combined_vars_metavars).map(([varname, val]) => (
      <div key={varname} className="grade-resp-var-container">
        <span className="response-var-name">{varname}&nbsp;=&nbsp;</span>
        <span className="response-var-value linebreaks">{val}</span>
      </div>
    ));
  }, [shownResponse]);

  // const [shownResponseIdx, setShownResponseIdx] = useState(0);
  // const [shownResponses, setShownResponses] = useState<LLMResponse[]>([]);
  // React.useEffect(() => {
  //   console.error("current response", shownResponse);
  //   if (shownResponse && !shownResponses.includes(shownResponse)) {
  //     shownResponses.push(shownResponse);
  //     setShownResponses(shownResponses);
  //     setShownResponseIdx(shownResponses.length - 1);
  //     console.error("current response is saved.", shownResponses.length);
  //   } else {
  //     console.error("current response already saved.");
  //     for (const [idx, resp] of shownResponses.entries()) {
  //       if (shownResponse === resp) {
  //         setShownResponseIdx(idx);
  //         break;
  //       }
  //     }
  //   }
  // }, [shownResponse]);

  return (
    <Stack justify="space-between" mih={500}>
      <Box>
        {/* Top header */}
        <Flex justify="center">
          <HeaderText>
            {/* What do you think of this response? */}
            What do you think of response #{shownResponseIdx + 1} of{" "}
            {responseCount}?
          </HeaderText>
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
          <Tooltip label={estimateGPTCalls()} withArrow>
            <Button variant="white" color="dark" onClick={gotoNextResponse}>
              <IconChevronRight />
            </Button>
          </Tooltip>
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
        <Flex direction="column">
          <Flex justify="space-between" align="center">
            <Text size="lg" weight={500} mb="sm">
              LLM Activity
            </Text>
            {/* GPT Call Tally */}
            <Text size="sm" color="dark" style={{ fontStyle: "italic" }}>
              Executed {numGPT4Calls} GPT-4o calls and {numGPT35Calls}{" "}
              GPT-3.5-Turbo-16k calls.
            </Text>
          </Flex>
          <div
            style={{
              backgroundColor: "#f0f0f0",
              color: "#333",
              fontFamily: "monospace",
              padding: "12px",
              width: "calc(100% - 30px)",
              height: "200px",
              overflowY: "auto",
              borderRadius: "8px",
              border: "1px solid #ddd",
              marginRight: "20px", // Space on the right
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
      </Box>
      <div>
        <Center>
          <Button
            leftIcon={<IconSparkles size={14} />}
            variant="gradient"
            gradient={{ from: "blue", to: "green", deg: 45 }}
            onClick={() => {
              // console.log("(3) gotoNextScreen", gotoNextScreen);
              gotoNextScreen("report");
            }}
          >
            I&apos;m done. Access EvalGen Report!
          </Button>
        </Center>
      </div>
    </Stack>
  );
};

interface ReportCardViewProps {
  report: EvalGenReport;
  // recomputeAlignment,
  onFinish: (reports: EvalGenReport) => void;
  getGradeCount: (crit: EvalCriteria, grade: boolean) => number;
  getStateValue: (stateId: number) => number;
}

// const ReportCardScreen = () => {
const ReportCardView: React.FC<ReportCardViewProps> = ({
  report,
  // recomputeAlignment,
  onFinish,
  getGradeCount,
  getStateValue,
}) => {
  // The criteria cards, now with report information

  const [finalReport, setFinalReport] = useState(report);

  const onSelect = (criterion: EvalCriteria, isSelected: boolean) => {
    if (isSelected) {
      finalReport.criteria.push(criterion);
    } else {
      finalReport.criteria = finalReport.criteria.filter(
        (c) => c !== criterion,
      );
    }
    setFinalReport(finalReport);
  };
  const cards = useMemo(() => {
    const res = [];

    // Iterate through selected eval functions and create cards
    // for (const selectedFunc of report.selectedEvalFunctions) {
    //   const crit = selectedFunc.evalCriteria;
    //   // Find corresponding report in allEvalFunctionReports map from criteria to list
    //   const critEvalFuncReports = report.allEvalFunctionReports.get(crit);
    //   const evalFuncReport = critEvalFuncReports.find(
    //     (rep) => rep.evalFunction === selectedFunc,
    //   );

    //   // Get the functions that were not selected for this criteria
    //   const otherFuncs = critEvalFuncReports.filter(
    //     (rep) => rep.evalFunction !== selectedFunc,
    //   );
    for (const crit of report.criteria) {
      res.push(
        <ReportCriteriaCard
          criterion={crit}
          key={crit.uid}
          // onCheck={(checked) => {
          //   crit.selected = checked;
          //   recomputeAlignment();
          // }}
          getGradeCount={getGradeCount}
          getStateValue={getStateValue}
          onSelect={onSelect}
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
                Coverage of Bad Responses
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
          <Button
            onClick={() => {
              // console.log("finalReport", finalReport);
              onFinish(finalReport);
            }}
          >
            Finish with selected evaluators
          </Button>
        </Flex>
      </div>
    )
  );
};

interface ReportCriteriaCardProps {
  criterion: EvalCriteria;
  // onChange: (changedCriteria: EvalCriteria) => void;
  // onDelete: () => void;
  // initiallyOpen?: boolean;
  // grade: boolean | undefined;
  // onChangeGrade: (newGrade: boolean | undefined) => void;
  getGradeCount: (crit: EvalCriteria, grade: boolean) => number;
  getStateValue: (stateId: number) => number;
  onSelect: (criterion: EvalCriteria, isChecked: boolean) => void;
}

const ReportCriteriaCard: React.FC<ReportCriteriaCardProps> = ({
  criterion,
  // onChange,
  // onDelete,
  // initiallyOpen,
  // grade,
  getGradeCount,
  // onChangeGrade,
  getStateValue,
  onSelect,
}) => {
  // const [opened, { toggle }] = useDisclosure(true);
  // const [title, setTitle] = useState(criterion.shortname);
  const [checked, setChecked] = useState(true);

  // Simulates eval functions that are expected to be passed in later on (TODO)
  const evalFuncs = [
    { evalFunction: { code: "To be provided (1) ..." } },
    { evalFunction: { code: "To be provided (2) ..." } },
    { evalFunction: { code: "To be provided (3) ..." } },
  ];
  const unselectedImplementations = evalFuncs.map((item) => (
    <div key={uuid()}>
      <Code style={{ whiteSpace: "pre-wrap" }} key={uuid()}>
        {item.evalFunction.code}
      </Code>
      <Divider />
    </div>
  ));

  return (
    // <Card withBorder mb={4} radius="md" style={{ cursor: "default" }}>
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
        {/* <Card.Section withBorder pl="8px">
          <Flex align="center">
            <Group spacing="0px"> */}
        {/* The arrow chevron user can click to collapse/expand */}
        {/* <Button
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
              </Button> */}

        <Tooltip label={checked ? "Don't use this" : "Use this"} withArrow>
          <Checkbox
            checked={checked}
            onChange={() => {
              setChecked(!checked);
              if (onSelect) onSelect(criterion, !checked);
            }}
            tabIndex={-1}
            size="xs"
            mr="sm"
            mt="xs"
            styles={{ input: { cursor: "pointer" } }}
            aria-hidden
          />
        </Tooltip>

        {/* Thumbs up/down buttons - disable for now */}
        {/* <ReadOnlyThumbUpDownButtons
                  upCount={getGradeCount(criterion, true)}
                  downCount={getGradeCount(criterion, false)}
                /> */}

        <div style={{ width: "100%" }}>
          {/* Title of the criteria */}
          <TextInput
            value={criterion.shortname}
            // placeholder="Criteria name"
            readOnly
            variant="unstyled"
            size="sm"
            ml="xs"
            className="nodrag nowheel"
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
          {/* </Group> */}

          {/* <Group spacing="4px" ml="auto"> */}

          {/* <Button
                  color={criterion.priority <= 0 ? "gray" : "red"}
                  m={0}
                  p={0}
                  variant="subtle"
                >
                  <IconFlagFilled size="14pt" />
                </Button> */}
          {/* </Group>
            </Flex>
          </Card.Section> */}

          {/* Description of the criteria */}
          {/* <Card.Section p="0px"> */}
          {/* <Collapse in={opened}> */}
          <Textarea
            value={criterion.criteria}
            // placeholder="Describe here."
            readOnly
            // onClickCapture={(e) => e.stopPropagation()}
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

          {/* Whether this criteria should be implemented with code (function) or an LLM evaluator */}
          <Text color="#999" size="sm" mr="6px">
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
        </div>
        <Stack spacing={0}>
          <Contributor
            getStateValue={getStateValue}
            style={{ size: 90, thickness: 12 }}
          />
          <Text align="center" size="xs" color="gray" maw="90%" lh={1.1}>
            Alignment with your grades
          </Text>
        </Stack>
      </div>
      {/* </Collapse> */}
      {/* </Card.Section> */}
      <div>
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
      </div>
    </Card>
  );
};

const ReadOnlyThumbUpDownButtons = ({
  upCount,
  downCount,
}: {
  upCount: number;
  downCount: number;
  // grade: boolean | undefined;
  // onChangeGrade: (newGrade: boolean | undefined) => void;
  // getGradeCount: (grade: boolean | undefined) => number;
}) => {
  return (
    <>
      {/* Thumbs up/down buttons */}
      <Button color={"green"} m={0} p={0} variant="subtle">
        <div className="gradeContainer">
          <IconThumbUp size="14pt" fill={"#aea"} />
          <div className="gradeUpCount">{upCount}</div>
        </div>
      </Button>
      <Button color={"red"} m={0} p={0} variant="subtle">
        <div className="gradeContainer">
          <IconThumbDown size="14pt" fill={"pink"} />
          <div className="gradeDownCount">{downCount}</div>
        </div>
      </Button>
    </>
  );
};

// export default { EvalGenModal, ReportCardScreen };
export default EvalGenModal;