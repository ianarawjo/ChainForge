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
import React, { ReactNode, forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Collapse,
  Flex,
  Grid,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
  rem,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { LLMResponse, PromptVarsDict } from "./backend/typing";
import { EvalCriteria } from "./backend/evalgen/typing";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconRobot,
  IconStarFilled,
  IconTerminal2,
  IconThumbUp,
  IconTrash,
} from "@tabler/icons-react";
import { cleanMetavarsFilterFunc, transformDict } from "./backend/utils";

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
  }
];

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
        <Group>
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
              <IconThumbUp
                size="14pt"
              />
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
              <IconThumbUp
                size="14pt"
              />
            </Button>

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
                {criterion.eval_method === "code" ? <Flex style={{userSelect: "none"}}><IconTerminal2 size="14pt" />&nbsp;Python</Flex> : <Flex style={{userSelect: "none"}}><IconRobot size="14pt" />&nbsp;LLM</Flex>}
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
                <IconStarFilled
                  size="14pt"
                />
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
        </Group>
      </Card.Section>

      {/* Description of the criteria */}
      <Card.Section p="0px">
        <Collapse in={opened}>
        <Textarea
            value={criterion.criteria}
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

export interface EvalGenModalProps {
}

const EvalGenModal = forwardRef<EvalGenModalRef, EvalGenModalProps>(
  function EvalGenModal({ }, ref) {
    const [opened, { open, close }] = useDisclosure(false);
    const [criteria, setCriteria] = useState<EvalCriteria[]>(INIT_CRITERIA);
    const [responses, setResponses] = useState<LLMResponse[]>([]);

    // Open the EvalGen wizard
    const trigger = (resps: LLMResponse[]) => {
      // We pass the responses here manually to ensure they remain the same 
      // for the duration of one EvalGen operation. 
      setResponses(resps);
      open();
    };
    useImperativeHandle(ref, () => ({
      trigger,
    }));

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
              <GradingView />

              {/* Progress bar */}
              <Flex justify="left" align="center" gap="md">
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
          </Grid.Col>
          <Grid.Col span={4} bg="gray" pt="16px">
            {criteria.map((e) => (
              <CriteriaCard
                criterion={e}
                key={e.uid}
                onChange={(newCrit) => handleChangeCriteria(newCrit, e.uid)}
                onDelete={() => handleDeleteCriteria(e.uid)}
                initiallyOpen={true}
              />
            ))}
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
  shownResponse: LLMResponse;
  gotoPrevResponse: () => void;
  gotoNextResponse: () => void;
}

const GradingView: React.FC<GradingViewProps> = ({ shownResponse, gotoPrevResponse, gotoNextResponse }) => {

  // Calculate inner values only when shownResponse changes
  const responseText = useMemo(() =>
    shownResponse && shownResponse.responses?.length > 0
      ? shownResponse.responses[0].toString()
      : ""
  , [shownResponse]);
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
          <HeaderText>
            What do you think of this response?
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

