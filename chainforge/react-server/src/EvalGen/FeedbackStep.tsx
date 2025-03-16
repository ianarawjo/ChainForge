import React, { useState } from "react";
import { LLMResponse } from "../backend/typing";
import { Button, Group, Stack, Text, Title } from "@mantine/core";

interface FeedbackStepProps {
  onNext: () => void;
  onPrevious: () => void;
  responses: LLMResponse[];
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const FeedbackStep: React.FC<FeedbackStepProps> = ({ onNext, onPrevious }) => {
  // State for thumbs up/down feedback and written comments
  const [feedback, setFeedback] = useState([]);

  const handleSubmit = () => {
    // setFeedbackData(feedback);
    onNext();
  };

  return (
    <Stack spacing="lg">
      <Title order={3}>Provide Feedback on Some Model Outputs</Title>

      {/* TODO: Implement thumbs up/down feedback UI with written comments */}
      <Text>
        TODO: Display LLM responses with thumbs up/down controls and comment
        field
      </Text>
    </Stack>
  );
};

export default FeedbackStep;
