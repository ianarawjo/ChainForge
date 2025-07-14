import React, { useMemo, useState } from "react";
import { EvalCriteria, EvalFunctionReport } from "../backend/evalgen/typing";
import {
  Accordion,
  Button,
  Card,
  Checkbox,
  Code,
  Divider,
  Flex,
  Group,
  Popover,
  RingProgress,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconCode,
  IconRepeat,
  IconRobot,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import useStore from "../store";
import { accuracyToColor, cmatrixTextAnnotations } from "../backend/utils";
import {
  generateLLMEvaluationCriteria,
  getPromptForGenEvalCriteriaFromDesc,
} from "../backend/evalgen/utils";
import { v4 as uuid } from "uuid";
import Plot from "react-plotly.js";

interface PickCriteriaStepProps {
  onNext: () => void;
  onPrevious: () => void;
  criteria: EvalCriteria[];
  setCriteria: React.Dispatch<React.SetStateAction<EvalCriteria[]>>;
  genCriteriaFromContext: () => Promise<EvalCriteria[] | undefined>;
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
  genAIModelNames: { large: string; small: string };
}

export interface CriteriaCardProps {
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

export const CriteriaCard: React.FC<CriteriaCardProps> = function CriteriaCard({
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
      percent: Math.floor((evalFuncReport.f1 ?? 0) * 100),
      color: accuracyToColor(evalFuncReport.f1 ?? 0),
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

const PickCriteriaStep: React.FC<PickCriteriaStepProps> = ({
  onNext,
  onPrevious,
  criteria,
  setCriteria,
  genCriteriaFromContext,
  genAIModelNames,
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
      genAIModelNames.large,
      apiKeys,
      getPromptForGenEvalCriteriaFromDesc(addCriteriaValue), // prompt
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
    <Stack spacing="lg" p="xl">
      <Title order={3}>Define Evaluation Criteria</Title>

      <div>
        <Text size="sm" pl="sm" mb="lg">
          Select criteria that you would like to evaluate responses on. Based on
          your chosen criteria, LLM will generate implementations of assertions.
          Afterwards, an optional human scoring pass can better align these
          implementations with your expectations.
        </Text>

        <Text size="sm" pl="sm" mb="lg" style={{ fontStyle: "italic" }}>
          Note: Due to rate limits and/or cost, think carefully before selecting
          more than 5 criteria to be evaluated by LLMs.
        </Text>

        <Flex align="center" gap="lg">
          <TextInput
            label="Describe a new criterion to add, then press Enter:"
            value={addCriteriaValue}
            onChange={(evt) => setAddCriteriaValue(evt.currentTarget.value)}
            placeholder="e.g., the response is valid JSON"
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
            disabled={addCriteriaValue?.trim().length === 0}
            onClick={() => {
              addCriteria();
              setAddCriteriaValue("");
            }}
          >
            Generate
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (isLoadingCriteria > 0) return;
              setIsLoadingCriteria(3);
              genCriteriaFromContext()
                .then((crit) =>
                  setCriteria(crit ? criteria.concat(crit) : criteria),
                )
                .catch((err) => {
                  console.error(err);
                  setIsLoadingCriteria(0);
                })
                .finally(() => setIsLoadingCriteria(0));
            }}
          >
            <IconRepeat />
            <IconSparkles />
            &nbsp;Suggest criteria
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

      {/* <Group position="apart" mt="xl">
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
      </Group> */}
    </Stack>
  );
};

export default PickCriteriaStep;
