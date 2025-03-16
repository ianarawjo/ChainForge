import React, { ReactNode, useMemo } from "react";
import { LLMResponse } from "../backend/typing";
import { cleanMetavarsFilterFunc, transformDict } from "../backend/utils";
import { Box, Button, Center, Flex, Stack, Text, Tooltip } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react";

const HeaderText = ({ children }: { children: ReactNode }) => {
  return (
    <Text size="xl" fw={500} pl="sm" mb="lg">
      {children}
    </Text>
  );
};

export interface GradingViewProps {
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

export default GradingView;
