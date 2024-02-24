import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useMemo,
  useEffect,
} from "react";
import {
  SimpleGrid,
  Card,
  Modal,
  Text,
  Button,
  Checkbox,
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
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconRobot,
  IconSparkles,
  IconThumbDown,
  IconThumbUp,
} from "@tabler/icons-react";
import ConfettiExplosion from "react-confetti-explosion";
import { sampleRandomElements, transformDict } from "./backend/utils";

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
  onTitleChange,
  onDescriptionChange,
}) {
  const [checked, setChecked] = useState(true);
  const [codeChecked, setCodeChecked] = useState(false);
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
        onClick={() => setChecked(!checked)}
        onKeyUp={(e) => e.preventDefault()}
        className="checkcard"
      >
        <Checkbox
          checked={checked}
          onChange={() => setChecked(!checked)}
          tabIndex={-1}
          size="md"
          mr="xl"
          styles={{ input: { cursor: "pointer" } }}
          aria-hidden
        />

        <div>
          <Text fw={500} mb={7} lh={1} fz="md">
            {title}
          </Text>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.currentTarget.value)}
            onClickCapture={(e) => e.stopPropagation()}
            styles={{
              input: {
                border: "none",
                borderWidth: "0px",
                padding: "0px",
                color: "#444",
                background: "transparent",
              },
            }}
            autosize
            minRows={1}
            maxRows={5}
            fz="sm"
            mb="lg"
            c="dimmed"
          />
        </div>

        <Switch
          size="lg"
          color="gray"
          onLabel="Code"
          offLabel="LLM"
          pos="absolute"
          right="8px"
          bottom="10px"
          checked={codeChecked}
          onChange={(e) => setCodeChecked(e.currentTarget.checked)}
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

// Pop-up to ask user to pick criterias for evaluation
export const PickCriteriaModal = forwardRef(
  function PickCriteriaModal(props, ref) {
    const [opened, { open, close }] = useDisclosure(false);
    const [responses, setResponses] = useState([]);

    // Which stage of picking + generating criteria we are in. Screens are:
    // pick, wait, grade
    const [screen, setScreen] = useState("pick");
    const modalTitle = useMemo(() => {
      if (screen === "pick") return "Pick Criteria";
      else if (screen === "wait") return "Collecting implementations...";
      else return "Grading Responses";
    }, [screen]);

    const [criteria, setCriteria] = useState([
      {
        title: "Grammaticality",
        description: "The text is grammatically correct.",
      },
      { title: "Length", description: "The text is 144 characters or less." },
      {
        title: "Clickbait potential",
        description: "How likely the text is to drive attention as a Tweet.",
      },
      {
        title: "Informality",
        description:
          "Whether the response sounds informal, like a real human tweeted it.",
      },
      {
        title: "Toxicity",
        description: "Whether the response sounds overly harmful or toxic.",
      },
    ]);
    const [addCriteriaValue, setAddCriteriaValue] = useState("");

    const addCriteria = () => {
      // TODO: Make async LLM call to expand criteria. For now, just dummy func:
      setCriteria(
        criteria.concat([
          { title: "New Criteria", description: addCriteriaValue },
        ]),
      );
    };
    const setCriteriaTitle = (title, idx) => {
      criteria[idx].title = title;
      setCriteria([...criteria]);
    };
    const setCriteriaDesc = (desc, idx) => {
      criteria[idx].description = desc;
      setCriteria([...criteria]);
    };

    // This gives the parent access to triggering the modal alert
    const trigger = (inputs) => {
      setResponses(inputs);
      setScreen("pick");
      open();
    };
    useImperativeHandle(ref, () => ({
      trigger,
    }));

    const gradeResponsesWindow = useMemo(
      () => <GradeResponsesWindow responses={responses} />,
      [responses],
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
        {screen === "pick" ? (
          <div>
            <Text size="sm" pl="sm" mb="lg">
              Select criteria that you would like to evaluate responses on.
              Based on your chosen criteria, LLM will generate implementations
              of assertions. Afterwards, an optional human scoring pass can
              better align these implementations with your expectations.
            </Text>
            <ScrollArea mih={300} h={500} mah={500}>
              <SimpleGrid cols={3} spacing="sm" verticalSpacing="sm" mb="lg">
                {criteria.map((c, idx) => (
                  <CriteriaCard
                    title={c.title}
                    description={c.description}
                    key={`cc-${idx}`}
                    onTitleChange={(title) => setCriteriaTitle(title, idx)}
                    onDescriptionChange={(desc) => setCriteriaDesc(desc, idx)}
                  />
                ))}
              </SimpleGrid>
            </ScrollArea>

            <TextInput
              label="Suggest a criteria to add, then press Enter:"
              value={addCriteriaValue}
              onChange={(evt) => setAddCriteriaValue(evt.currentTarget.value)}
              placeholder="the response is valid JSON"
              mb="lg"
              onKeyDown={(evt) => {
                if (evt.key === "Enter") {
                  evt.preventDefault();
                  addCriteria();
                }
              }}
            />
            <Flex justify="center" gap={12}>
              <Button
                onClick={() => {
                  setScreen("wait");
                  // setTimeout(() => {
                  //   setScreen('grade');
                  // }, 1000000);
                }}
                variant="gradient"
              >
                <IconSparkles />
                &nbsp;Generate!
              </Button>
              {/* <Button disabled variant='gradient' gradient={{ from: 'teal', to: 'lime', deg: 105 }}><IconSparkles />&nbsp;Validate</Button> */}
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
      </Modal>
    );
  },
);

// Pop-up where user grades responses.
export const GradeResponsesWindow = forwardRef(
  function GradeResponsesWindow(props, ref) {
    // Confetti effects
    const [isGreenExploding, setIsGreenExploding] = React.useState(false);
    const [isRedExploding, setIsRedExploding] = React.useState(false);

    const [responses, setResponses] = useState([]);
    const [shownResponse, setShownResponse] = useState(undefined);
    const [pastShownResponses, setPastShownResponses] = useState([]);
    const [shownResponseIdx, setShownResponseIdx] = useState(0);
    const [grades, setGrades] = useState({});
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
            ...transformDict(
              shownResponse.metavars,
              (key) => !key.startsWith("LLM_"),
            ),
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

      if (shownResponseIdx < pastShownResponses.length - 1) {
        // If we are not at the end of the history of shown responses, then show the next response:
        setShownResponse(pastShownResponses[shownResponseIdx + 1]);
        setShownResponseIdx(shownResponseIdx + 1); // increment the shown resp idx
      } else {
        // We are at the end of the history; pick the next response at random:
        // TODO: Make this unique (maybe by removing picked responses from the list!)
        const random_resp = sampleRandomElements(responses, 1)[0];
        setShownResponse(random_resp);
        setPastShownResponses(pastShownResponses.concat(random_resp));
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

    // Update responses whenever upstream changes
    useEffect(() => {
      updateResponsePool(props.responses);
    }, [props?.responses]);

    return (
      <Stack justify="space-between" mih={500}>
        <Box>
          <Flex justify="center">
            {shownResponseIdx in grades ? (
              grades[shownResponseIdx] ? (
                <HeaderText>
                  You chose&nbsp;
                  <IconThumbUp color="green" style={{ marginBottom: "-3px" }} />
                  !
                </HeaderText>
              ) : (
                <HeaderText>
                  You chose&nbsp;
                  <IconThumbDown color="red" style={{ marginBottom: "-6px" }} />
                  !
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

          <Flex justify="center" gap="50px" mb="xl">
            <Button
              color="red"
              variant="filled"
              onClick={() => {
                grades[shownResponseIdx] = false;
                setGrades({ ...grades });
                setIsRedExploding(true);
                setTimeout(nextResponse, 800);
                setTimeout(() => setIsRedExploding(false), 1200);
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
                grades[shownResponseIdx] = true;
                setGrades({ ...grades });
                setIsGreenExploding(true);
                setTimeout(nextResponse, 800);
                setTimeout(() => setIsGreenExploding(false), 1200);
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
        </Box>

        <Flex justify="left" align="center" gap="md">
          {/* <Progress size={18} w='100%' sections={[{ value: 30, color: 'blue', label: '3/10 graded', tooltip: 'Samples graded' }]} /> */}
          {/* <Loader size='sm' /> */}
          <Stack w="100%" spacing={4}>
            <Text color="#aaa" size="sm">
              Generating candidate implementations...
            </Text>
            <Progress w="100%" value={30} animate mb="0px" />
          </Stack>

          <Button variant="outline">I&apos;m tired 😴</Button>
        </Flex>
      </Stack>
    );
  },
);
