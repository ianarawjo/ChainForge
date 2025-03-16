import React, { useState } from "react";
import { EvalCriteria } from "../backend/evalgen/typing";
import { LLMResponse } from "../backend/typing";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import GradingView from "./GradingView";

interface GradingResponsesStepProps {
  onNext: () => void;
  onPrevious: () => void;
  responses: LLMResponse[];
  criteria: EvalCriteria[];
  setCriteria: React.Dispatch<React.SetStateAction<EvalCriteria[]>>;
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const GradingResponsesStep: React.FC<GradingResponsesStepProps> = ({
  onNext,
  onPrevious,
}) => {
  // State for per-criteria grades
  const [grades, setGrades] = useState({});

  // TODO: Set up grading UI for each criteria

  const handleSubmit = () => {
    // setGradingData(grades);
    onNext();
  };

  return (
    <Stack spacing="lg">
      <Title order={3}>Grade LLM Responses By Criteria</Title>
      <Text>Please evaluate each response according to your criteria:</Text>

      {/* <GradingView /> */}

      <Group position="apart" mt="xl">
        <Button variant="default" onClick={onPrevious}>
          Back
        </Button>
        <Button onClick={handleSubmit}>I&apos;m tired, process results</Button>
      </Group>
    </Stack>
  );
};

export default GradingResponsesStep;
