import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Handle } from "reactflow";
import {
  TextInput,
  Text,
  Group,
  ActionIcon,
  Menu,
  Card,
  rem,
  Collapse,
  Button,
  Alert,
  Flex,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAbacus,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconInfoCircle,
  IconPlus,
  IconRobot,
  IconSearch,
  IconSparkles,
  IconTerminal,
  IconTrash,
} from "@tabler/icons-react";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorModal from "./LLMResponseInspectorModal";
import useStore from "./store";
import {
  APP_IS_RUNNING_LOCALLY,
  batchResponsesByUID,
  toStandardResponseFormat,
} from "./backend/utils";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";
import { CodeEvaluatorComponent } from "./CodeEvaluatorNode";
import { LLMEvaluatorComponent } from "./LLMEvalNode";
import { GatheringResponsesRingProgress } from "./LLMItemButtonGroup";
import { PickCriteriaModal } from "./GradeResponsesModal";

const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

// const TEST_EVAL_COMPS = [
//   {
//     name: "Formatting",
//     type: "javascript",
//     state: {
//       code: "function evaluate(r) {\n\ttry {\n\t\tJSON.parse(r.text);\n\t\treturn true;\n\t} catch (e) {\n\t\treturn false;\n\t} \n}",
//     },
//   },
//   {
//     name: "Grammaticality",
//     type: "llm",
//     state: { prompt: "Is this grammatical?", format: "bin" },
//   },
//   {
//     name: "Length",
//     type: "python",
//     state: { code: "def evaluate(r):\n\treturn len(r.text.split())" },
//   },
// ];
const EVAL_TYPE_PRETTY_NAME = {
  python: "Python",
  javascript: "JavaScript",
  llm: "LLM",
};

/** A wrapper for a single evaluator, that can be renamed */
const EvaluatorContainer = ({
  name,
  type: evalType,
  padding,
  onDelete,
  onChangeTitle,
  progress,
  children,
}) => {
  const [opened, { toggle }] = useDisclosure(false);
  const _padding = useMemo(() => padding ?? "0px", [padding]);
  const [title, setTitle] = useState(name ?? "Criteria");

  const handleChangeTitle = (newTitle) => {
    setTitle(newTitle);
    if (onChangeTitle) onChangeTitle(newTitle);
  };

  return (
    <Card
      withBorder
      shadow="sm"
      mb="xs"
      radius="md"
      style={{ cursor: "default" }}
    >
      <Card.Section withBorder pl="8px">
        <Group justify="space-between">
          <Group justify="flex-start" spacing="0px">
            <Button
              onClick={toggle}
              variant="subtle"
              color="gray"
              p="0px"
              m="0px"
            >
              {opened ? (
                <IconChevronDown size="14pt" />
              ) : (
                <IconChevronRight size="14pt" />
              )}
            </Button>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => handleChangeTitle(e.target.value)}
              placeholder="Criteria name"
              variant="unstyled"
              size="sm"
              classNames="nodrag nowheel"
              styles={{
                input: {
                  padding: "0px",
                  height: "14pt",
                  minHeight: "0pt",
                  fontWeight: "500",
                },
              }}
            />
          </Group>
          <Group spacing="4px" ml="auto">
            <Text color="#bbb" size="sm" mr="6px">
              {evalType}
            </Text>
            {progress ? (
              <GatheringResponsesRingProgress progress={progress} />
            ) : (
              <></>
            )}
            {/* <Progress
                radius="xl"
                w={32}
                size={14}
                sections={[
                  { value: 70, color: 'green', tooltip: '70% true' },
                  { value: 30, color: 'red', tooltip: '30% false' },
                ]} /> */}
            <Menu withinPortal position="right-start" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDots style={{ width: rem(16), height: rem(16) }} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item icon={<IconSearch size="14px" />}>
                  Inspect scores
                </Menu.Item>
                <Menu.Item icon={<IconInfoCircle size="14px" />}>
                  Help / info
                </Menu.Item>
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
        </Group>
      </Card.Section>

      <Card.Section p={opened ? _padding : "0px"}>
        <Collapse in={opened}>{children}</Collapse>
      </Card.Section>
    </Card>
  );
};

/** A node that stores multiple evaluator functions (can be mix of LLM scorer prompts and arbitrary code.) */
const MultiEvalNode = ({ data, id }) => {
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pullInputData = useStore((state) => state.pullInputData);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);

  const flags = useStore((state) => state.flags);
  const AI_SUPPORT_ENABLED = useMemo(() => {
    return flags.aiSupport;
  }, [flags]);

  const [status, setStatus] = useState("none");
  const alertModal = useRef(null);
  const inspectModal = useRef(null);

  const pickCriteriaModalRef = useRef(null);
  const onClickPickCriteria = () => {
    const inputs = handlePullInputs();
    pickCriteriaModalRef?.current?.trigger(inputs, (implementations) => {
      // Returned if/when the Pick Criteria modal finishes generating implementations.
      console.warn(implementations);
      // Append the returned implementations to the end of the existing eval list
      setEvaluators((evs) => evs.concat(implementations));
    });
  };

  const [uninspectedResponses, setUninspectedResponses] = useState(false);
  const [lastResponses, setLastResponses] = useState([]);
  const [lastRunSuccess, setLastRunSuccess] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  /** Store evaluators as array of JSON serialized state:
   * {  name: <string>  // the user's nickname for the evaluator, which displays as the title of the banner
   *    type: 'python' | 'javascript' | 'llm'  // the type of evaluator
   *    state: <dict>  // the internal state necessary for that specific evaluator component (e.g., a prompt for llm eval, or code for code eval)
   * }
   */
  const [evaluators, setEvaluators] = useState(data.evaluators ?? []);

  // Add an evaluator to the end of the list
  const addEvaluator = useCallback(
    (name, type, state) => {
      setEvaluators(evaluators.concat({ name, type, state }));
    },
    [setEvaluators, evaluators],
  );

  // Sync evaluator state to stored state of this node
  useEffect(() => {
    setDataPropsForNode(id, { evaluators });
  }, [evaluators]);

  // Generate UI for the evaluator state
  const evaluatorComponentRefs = useRef([]);
  const evaluatorComponents = useMemo(() => {
    evaluatorComponentRefs.current = [];
    const updateEvalState = (idx, transformFunc) =>
      setEvaluators((es) =>
        es.map((e, i) => {
          if (idx === i) transformFunc(e);
          return e;
        }),
      );
    return evaluators.map((e, idx) => {
      let component;
      if (e.type === "python" || e.type === "javascript") {
        component = (
          <CodeEvaluatorComponent
            ref={(el) =>
              (evaluatorComponentRefs.current[idx] = {
                type: "code",
                name: e.name,
                ref: el,
              })
            }
            code={e.state?.code}
            progLang={e.type}
            type="evaluator"
            id={id}
            onCodeEdit={(code) =>
              updateEvalState(idx, (e) => (e.state.code = code))
            }
          />
        );
      } else if (e.type === "llm") {
        component = (
          <LLMEvaluatorComponent
            ref={(el) =>
              (evaluatorComponentRefs.current[idx] = {
                type: "llm",
                name: e.name,
                ref: el,
              })
            }
            prompt={e.state?.prompt}
            grader={e.state?.grader}
            format={e.state?.format}
            id={id}
            showUserInstruction={false}
            onPromptEdit={(prompt) =>
              updateEvalState(idx, (e) => (e.state.prompt = prompt))
            }
            onLLMGraderChange={(grader) =>
              updateEvalState(idx, (e) => (e.state.grader = grader))
            }
            onFormatChange={(format) =>
              updateEvalState(idx, (e) => (e.state.format = format))
            }
          />
        );
      } else {
        console.error(
          `Unknown evaluator type ${e.type} inside multi-evaluator node. Cannot display evaluator UI.`,
        );
        component = <Alert>Error: Unknown evaluator type {e.type}</Alert>;
      }
      return (
        <EvaluatorContainer
          name={e.name}
          key={`${e.name}-${idx}`}
          type={EVAL_TYPE_PRETTY_NAME[e.type]}
          progress={e.progress}
          onDelete={() => {
            delete evaluatorComponentRefs.current[idx];
            setEvaluators(evaluators.filter((_, i) => i !== idx));
          }}
          onChangeTitle={(newTitle) =>
            setEvaluators(
              evaluators.map((e, i) => {
                if (i === idx) e.name = newTitle;
                console.log(e);
                return e;
              }),
            )
          }
          padding={e.type === "llm" ? "8px" : undefined}
        >
          {component}
        </EvaluatorContainer>
      );
    });
  }, [evaluators, id]);

  const handleError = useCallback(
    (err) => {
      console.error(err);
      setStatus("error");
      alertModal.current?.trigger(err?.message ?? err);
    },
    [alertModal, setStatus],
  );

  const handlePullInputs = useCallback(() => {
    // Pull input data
    try {
      const pulled_inputs = pullInputData(["responseBatch"], id);
      if (!pulled_inputs || !pulled_inputs.responseBatch) {
        console.warn(`No inputs to the Multi-Evaluator node.`);
        return [];
      }
      // Convert to standard response format (StandardLLMResponseFormat)
      return pulled_inputs.responseBatch.map(toStandardResponseFormat);
    } catch (err) {
      handleError(err);
      return [];
    }
  }, [pullInputData, id, toStandardResponseFormat]);

  const handleRunClick = useCallback(() => {
    // Pull inputs to the node
    const pulled_inputs = handlePullInputs();
    if (!pulled_inputs || pulled_inputs.length === 0) return;

    // Get the ids from the connected input nodes:
    // TODO: Remove this dependency; have everything go through pull instead.
    const input_node_ids = inputEdgesForNode(id).map((e) => e.source);
    if (input_node_ids.length === 0) {
      console.warn("No inputs to multi-evaluator node.");
      return;
    }

    // Sanity check that there's evaluators in the multieval node
    if (
      !evaluatorComponentRefs.current ||
      evaluatorComponentRefs.current.length === 0
    ) {
      console.error("Cannot run multievals: No current evaluators found.");
      return;
    }

    // Set status and created rejection callback
    setStatus("loading");
    setLastResponses([]);

    // Helper function to update progress ring on a single evaluator component
    const updateProgressRing = (evaluator_idx, progress) => {
      setEvaluators((evs) => {
        if (evs.length >= evaluator_idx) return evs;
        evs[evaluator_idx].progress = progress;
        return [...evs];
      });
    };

    // Run all evaluators here!
    // TODO
    const runPromises = evaluatorComponentRefs.current.map(
      ({ type, name, ref }, idx) => {
        if (ref === null) return { type: "error", name, result: null };

        // Start loading spinner status on running evaluators
        updateProgressRing(idx, { success: 0, error: 0 });

        // Run each evaluator
        if (type === "code") {
          // Run code evaluator
          // TODO: Change runInSandbox to be user-controlled, for Python code evals (right now it is always sandboxed)
          return ref.run(pulled_inputs, true).then((ret) => {
            console.log("Code evaluator done!", ret);
            updateProgressRing(idx, undefined);
            return {
              type: "code",
              name,
              result: ret.responses,
            };
          });
        } else {
          // Run LLM-based evaluator
          // TODO: Add back live progress, e.g. (progress) => updateProgressRing(idx, progress)) but with appropriate mapping for progress.
          return ref
            .run(input_node_ids, () => {
              /** skip */
            })
            .then((ret) => {
              console.log("LLM evaluator done!", ret);
              updateProgressRing(idx, undefined);
              return {
                type: "llm",
                name,
                result: ret.responses,
              };
            });
        }
      },
    );

    // When all evaluators finish...
    Promise.allSettled(runPromises).then((settled) => {
      if (settled.some((s) => s.status === "rejected")) {
        setStatus("error");
        setLastRunSuccess(false);
        handleError(s.reason);
        return;
      }

      // Ignore null refs
      settled = settled.filter((s) => s.value.result !== null);

      // Success -- set the responses for the inspector
      // First we need to group up all response evals by UID, *within* each evaluator.
      const evalResults = settled.map((s) => {
        if (s.value.type === "llm") return s.value; // responses are already batched by uid
        // If code evaluator, for some reason, in this version of CF the code eval has de-batched responses.
        // We need to re-batch them by UID before returning, to correct this:
        return {
          type: s.value.type,
          name: s.value.name,
          result: batchResponsesByUID(s.value.result),
        };
      });

      // Now we have a duplicates of each response object, one per evaluator run,
      // with evaluation results per evaluator. They are not yet merged. We now need
      // to merge the evaluation results within response objects with the same UIDs.
      // It *should* be the case (invariant) that response objects with the same UID
      // have exactly the same number of evaluation results (e.g. n=3 for num resps per prompt=3).
      const merged_res_objs_by_uid = {};
      // For each set of evaluation results...
      evalResults.forEach(({ name, result }) => {
        // For each response obj in the results...
        result.forEach((res_obj) => {
          // If it's not already in the merged dict, add it:
          const uid = res_obj.uid;
          if (!(uid in merged_res_objs_by_uid)) {
            // Transform evaluation results into dict form, indexed by "name" of the evaluator:
            res_obj.eval_res.items = res_obj.eval_res.items.map((item) => ({
              [name]: item,
            }));
            res_obj.eval_res.dtype = 3; // "KeyValue_Mixed" enum;
            merged_res_objs_by_uid[uid] = res_obj; // we don't make a copy, to save time
          } else {
            // It is already in the merged dict, so add the new eval results
            // Sanity check that the lengths of eval result lists are equal across evaluators:
            if (
              merged_res_objs_by_uid[uid].eval_res.items.length !==
              res_obj.eval_res?.items?.length
            ) {
              console.error(
                `Critical error: Evaluation result lists for response ${uid} do not contain the same number of items per evaluator. Skipping...`,
              );
              return;
            }
            // Add the new evaluation result, keyed by evaluator name:
            merged_res_objs_by_uid[uid].eval_res.items.forEach((item, idx) => {
              item[name] = res_obj.eval_res.items[idx];
            });
          }
        });
      });

      // We now have a dict of the form { uid: LLMResponse }
      // We need return only the values of this dict:
      setLastResponses(Object.values(merged_res_objs_by_uid));
      setLastRunSuccess(true);

      setStatus("ready");
    });
  }, [
    handlePullInputs,
    pingOutputNodes,
    alertModal,
    status,
    showDrawer,
    evaluators,
    evaluatorComponents,
    evaluatorComponentRefs,
  ]);

  const showResponseInspector = useCallback(() => {
    if (inspectModal && inspectModal.current && lastResponses) {
      setUninspectedResponses(false);
      inspectModal.current.trigger();
    }
  }, [inspectModal, lastResponses]);

  // Something changed upstream
  useEffect(() => {
    if (data.refresh && data.refresh === true) {
      setDataPropsForNode(id, { refresh: false });
      setStatus("warning");
    }
  }, [data]);

  return (
    <BaseNode
      classNames="evaluator-node"
      nodeId={id}
      style={{ backgroundColor: "#eee" }}
    >
      <NodeLabel
        title={data.title || "Multi-Evaluator"}
        nodeId={id}
        icon={<IconAbacus size="16px" />}
        status={status}
        alertModal={alertModal}
        handleRunClick={handleRunClick}
        runButtonTooltip="Run all evaluators over inputs"
      />

      <LLMResponseInspectorModal
        ref={inspectModal}
        jsonResponses={lastResponses}
        updateResponses={setLastResponses}
      />
      <PickCriteriaModal ref={pickCriteriaModalRef} />
      <iframe style={{ display: "none" }} id={`${id}-iframe`}></iframe>

      {evaluatorComponents}

      <Handle
        type="target"
        position="left"
        id="responseBatch"
        className="grouped-handle"
        style={{ top: "50%" }}
      />
      <Handle
        type="source"
        position="right"
        id="output"
        className="grouped-handle"
        style={{ top: "50%" }}
      />

      <div className="add-text-field-btn">
        <Menu withinPortal position="right-start" shadow="sm">
          <Menu.Target>
            <Tooltip label="Add evaluator" position="left" withArrow>
              <ActionIcon variant="outline" color="gray" size="sm">
                <IconPlus size="12px" />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item
              icon={<IconTerminal size="14px" />}
              onClick={() =>
                addEvaluator(
                  `Criteria ${evaluators.length + 1}`,
                  "javascript",
                  {
                    code: "function evaluate(r) {\n\treturn r.text.length;\n}",
                  },
                )
              }
            >
              JavaScript
            </Menu.Item>
            {IS_RUNNING_LOCALLY ? (
              <Menu.Item
                icon={<IconTerminal size="14px" />}
                onClick={() =>
                  addEvaluator(`Criteria ${evaluators.length + 1}`, "python", {
                    code: "def evaluate(r):\n\treturn len(r.text)",
                  })
                }
              >
                Python
              </Menu.Item>
            ) : (
              <></>
            )}
            <Menu.Item
              icon={<IconRobot size="14px" />}
              onClick={() =>
                addEvaluator(`Criteria ${evaluators.length + 1}`, "llm", {
                  prompt: "",
                  format: "bin",
                })
              }
            >
              LLM
            </Menu.Item>
            {AI_SUPPORT_ENABLED ? <Menu.Divider /> : <></>}
            {AI_SUPPORT_ENABLED ? (
              <Menu.Item
                icon={<IconSparkles size="14px" />}
                onClick={onClickPickCriteria}
              >
                Let an AI decide!
              </Menu.Item>
            ) : (
              <></>
            )}
          </Menu.Dropdown>
        </Menu>
      </div>

      {evaluators && evaluators.length === 0 ? (
        <Flex justify="center" gap={12} mt="md">
          <Tooltip
            label="Let an AI help you generate criteria and implement evaluation functions."
            multiline
            position="bottom"
            withArrow
          >
            <Button onClick={onClickPickCriteria} variant="outline" size="xs">
              <IconSparkles size="11pt" />
              &nbsp;Generate criteria
            </Button>
          </Tooltip>
          {/* <Button disabled variant='gradient' gradient={{ from: 'teal', to: 'lime', deg: 105 }}><IconSparkles />&nbsp;Validate</Button> */}
        </Flex>
      ) : (
        <></>
      )}

      {lastRunSuccess && lastResponses && lastResponses.length > 0 ? (
        <InspectFooter
          label={
            <>
              Inspect scores&nbsp;
              <IconSearch size="12pt" />
            </>
          }
          onClick={showResponseInspector}
          showNotificationDot={uninspectedResponses}
          isDrawerOpen={showDrawer}
          showDrawerButton={true}
          onDrawerClick={() => {
            setShowDrawer(!showDrawer);
            setUninspectedResponses(false);
            bringNodeToFront(id);
          }}
        />
      ) : (
        <></>
      )}

      <LLMResponseInspectorDrawer
        jsonResponses={lastResponses}
        showDrawer={showDrawer}
        updateResponses={setLastResponses}
      />
    </BaseNode>
  );
};

export default MultiEvalNode;
