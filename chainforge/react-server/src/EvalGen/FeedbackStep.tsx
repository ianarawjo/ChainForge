import React, { useCallback, useEffect, useState } from "react";
import { LLMResponse } from "../backend/typing";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import GradingView from "./GradingView";

interface FeedbackStepProps {
  onNext: () => void;
  onPrevious: () => void;
  responses: LLMResponse[];
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const FeedbackStep: React.FC<FeedbackStepProps> = ({
  onNext,
  onPrevious,
  responses,
  setOnNextCallback,
}) => {
  const [shownResponse, setShownResponse] = useState<LLMResponse | undefined>(
    undefined,
  );
  const [pastShownResponses, setPastShownResponses] = useState<LLMResponse[]>(
    [],
  );
  const [shownResponseIdx, setShownResponseIdx] = useState(0);

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

  return (
    <Stack spacing="lg">
      <Title order={3}>Provide Feedback on Some Model Outputs</Title>

      <GradingView
        shownResponse={shownResponse}
        shownResponseIdx={shownResponseIdx}
        // shownResponseIdx={shownResponseUniqueIdx}
        responseCount={responses.length}
        gotoNextResponse={nextResponse}
        gotoPrevResponse={prevResponse}
      />

      {/* TODO: Implement thumbs up/down feedback UI with written comments */}
      <Text>
        TODO: Display LLM responses with thumbs up/down controls and comment
        field
      </Text>
    </Stack>
  );
};

export default FeedbackStep;
