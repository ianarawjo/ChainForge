import React from "react";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { EvalCriteria } from "../backend/evalgen/typing";

interface ReportCardStepProps {
  onPrevious: () => void;
  onComplete: () => void;
  criteria: EvalCriteria[];
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const ReportCardStep: React.FC<ReportCardStepProps> = ({
  onPrevious,
  onComplete,
}) => {
  // TODO: Calculate alignment scores based on criteria and grading data
  const alignmentScores = {};

  return (
    <Stack spacing="lg">
      <Title order={3}>Evaluation Results</Title>
      <Text>
        Here&apos;s how well each evaluation criteria aligns with your grades:
      </Text>

      {/* TODO: Display alignment scores */}
      <Text>TODO: Show alignment scores for each criteria</Text>

      <Group position="apart" mt="xl">
        <Button variant="default" onClick={onPrevious}>
          Back
        </Button>
        <Button onClick={onComplete} color="green">
          Done
        </Button>
      </Group>
    </Stack>
  );
};

export default ReportCardStep;
