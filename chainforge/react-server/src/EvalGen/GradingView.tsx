import React, { ReactNode, useMemo } from "react";
import { LLMResponse } from "../backend/typing";
import {
  cleanMetavarsFilterFunc,
  llmResponseDataToString,
  transformDict,
} from "../backend/utils";
import { Box, Button, Center, Flex, Stack, Text, Tooltip } from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react";
import { StringLookup } from "../backend/cache";

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
  gotoPrevResponse: () => void;
  gotoNextResponse: () => void;
}

const GradingView: React.FC<GradingViewProps> = ({
  shownResponse,
  shownResponseIdx,
  responseCount,
  gotoPrevResponse,
  gotoNextResponse,
}) => {
  // Calculate inner values only when shownResponse changes
  const responseText = useMemo(
    () =>
      shownResponse && shownResponse.responses?.length > 0
        ? llmResponseDataToString(shownResponse.responses[0])
        : "",
    [shownResponse],
  );

  const prompt = useMemo(() => shownResponse?.prompt ?? "", [shownResponse]);
  const varsDivs = useMemo(() => {
    const combined_vars_metavars = shownResponse
      ? {
          ...StringLookup.concretizeDict(shownResponse.vars),
          ...transformDict(
            StringLookup.concretizeDict(shownResponse.metavars),
            cleanMetavarsFilterFunc,
          ),
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
          <Tooltip label="To next response" withArrow>
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
      </Box>
    </Stack>
  );
};

export default GradingView;
