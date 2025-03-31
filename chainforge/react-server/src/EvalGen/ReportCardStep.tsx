import React, { useMemo } from "react";
import {
  Button,
  Card,
  Flex,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { EvalCriteria, EvalFunctionSetReport } from "../backend/evalgen/typing";
import { CriteriaCard } from "./PickCriteriaStep";

interface ReportCardStepProps {
  criteria: EvalCriteria[];
  report: EvalFunctionSetReport | null;
  onFinish: (reports: EvalFunctionSetReport) => void;
  onPrevious: () => void;
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const ReportCardStep: React.FC<ReportCardStepProps> = ({
  report,
  onFinish,
  onPrevious,
}) => {
  const cards = useMemo(() => {
    if (!report) return null;
    const cards = [];

    // Iterate through selected eval functions and create cards
    for (const selectedFunc of report.selectedEvalFunctions) {
      const c = selectedFunc.evalCriteria;
      // Find corresponding report in allEvalFunctionReports map from criteria to list
      const evalFuncReports = report.allEvalFunctionReports.get(c);
      const evalFuncReport = evalFuncReports?.find(
        (rep) => rep.evalFunction === selectedFunc,
      );
      // Get the functions that were not selected for this criteria
      const otherFuncs = evalFuncReports?.filter(
        (rep) => rep.evalFunction !== selectedFunc,
      );

      cards.push(
        <CriteriaCard
          reportMode
          title={c.shortname}
          description={c.criteria}
          evalMethod={c.eval_method}
          key={c.uid}
          evalFuncReport={evalFuncReport}
          otherFuncs={otherFuncs}
        />,
      );
    }
    return cards;
  }, [report]);

  return (
    <Stack spacing="lg">
      <Text align="center" size="lg" pl="sm" mb="lg">
        Chosen Functions and Alignment
      </Text>

      {/* Show coverage and false failure rate numbers */}
      <Flex justify="center" gap="md" mb="lg">
        <Group position="center" spacing="xl" style={{ textAlign: "center" }}>
          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{ backgroundColor: "#f0f0f0" }}
          >
            <Text weight={500} size="md">
              Coverage of Bad Responses
            </Text>
            <Text color="blue" weight={700} size="md">
              {report?.failureCoverage.toFixed(2)}%
            </Text>
          </Card>
          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{ backgroundColor: "#f0f0f0" }}
          >
            <Text weight={500} size="md">
              False Failure Rate
            </Text>
            <Text color="red" weight={700} size="md">
              {report?.falseFailureRate.toFixed(2)}%
            </Text>
          </Card>
        </Group>
      </Flex>

      <ScrollArea mih={300} h={500} mah={500}>
        <SimpleGrid cols={3} spacing="sm" verticalSpacing="sm" mb="lg">
          {cards}
        </SimpleGrid>
      </ScrollArea>

      <Flex justify="center" gap={12} mt="xs">
        <Button
          onClick={() => {
            if (!report) return;
            onFinish(report);
          }}
        >
          Finish with selected evaluators
        </Button>
      </Flex>
    </Stack>
  );
};

export default ReportCardStep;
