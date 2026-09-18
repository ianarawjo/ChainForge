/**
 * The Inspector's "Judges" tab for an LLM Scorer: how often each judge agrees
 * with the ground-truth label and with each other judge, and which answers
 * didn't fit the scorer's format.
 */
import React from "react";
import { Stack, Table, Text, Title } from "@mantine/core";
import {
  AgreementRow,
  AgreementSummary,
  Disagreement,
} from "./backend/scorerFormat";
import { EvaluationScore } from "./backend/typing";
import { InvalidScores } from "./backend/backend";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A row's agreement rate, or mean absolute difference for numeric scores. */
const agreementValue = (row: AgreementRow) =>
  row.n === 0
    ? "–"
    : row.agreement !== undefined
      ? pct(row.agreement)
      : row.meanAbsDiff?.toFixed(2) ?? "–";

const AgreementTable: React.FC<{
  title: string;
  rows: AgreementRow[];
  numeric: boolean;
}> = ({ title, rows, numeric }) => (
  <div>
    <Title order={5} mb={4}>
      {title}
    </Title>
    <Table fontSize="sm" verticalSpacing={4} maw={560}>
      <thead>
        <tr>
          <th></th>
          <th>{numeric ? "Mean abs. difference" : "Agreement"}</th>
          <th>n</th>
          <th>Left out</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td>{agreementValue(r)}</td>
            <td>{r.n}</td>
            <td>{r.excluded > 0 ? r.excluded : ""}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
);

/** How many disagreements to list before cutting off. */
const MAX_DISAGREEMENTS = 200;

const show = (v: EvaluationScore | undefined) =>
  v === undefined ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v);

/** Each scored response where judges disagree, with the odd answers highlighted. */
const DisagreementsTable: React.FC<{
  disagreements: Disagreement[];
  judges: string[];
  labelName?: string;
}> = ({ disagreements, judges, labelName }) => {
  const shown = disagreements.slice(0, MAX_DISAGREEMENTS);
  const hasLabel = labelName !== undefined;
  return (
    <div>
      <Title order={5} mb={4}>
        Disagreements ({disagreements.length})
      </Title>
      <Text size="sm" color="dimmed" mb={4}>
        {hasLabel
          ? "Responses where a judge's answer differs from the label. Highlighted answers differ."
          : "Responses where the judges don't all agree. Highlighted answers differ from the most common one."}
      </Text>
      <div style={{ overflowX: "auto" }}>
        <Table fontSize="sm" verticalSpacing={4} striped>
          <thead>
            <tr>
              <th>Response</th>
              {hasLabel && <th>{labelName}</th>}
              {judges.map((j) => (
                <th key={j}>{j}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={`${d.uid}-${d.index}`}>
                <td style={{ maxWidth: "480px" }}>
                  <Text size="sm" lineClamp={3} title={d.response}>
                    {d.response}
                  </Text>
                </td>
                {hasLabel && <td>{show(d.label)}</td>}
                {judges.map((j) => (
                  <td key={j}>
                    {d.outliers.includes(j) ? (
                      <Text span color="orange" fw={500}>
                        {show(d.answers[j])}
                      </Text>
                    ) : (
                      show(d.answers[j])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {disagreements.length > shown.length && (
        <Text size="xs" color="dimmed" mt={4}>
          Showing the first {shown.length}.
        </Text>
      )}
    </div>
  );
};

export interface JudgeAgreementViewProps {
  summary?: AgreementSummary;
  numeric: boolean;
  labelVar?: string;
  invalid: InvalidScores[];
  disagreements: Disagreement[];
  judges: string[];
}

const JudgeAgreementView: React.FC<JudgeAgreementViewProps> = ({
  summary,
  numeric,
  labelVar,
  invalid,
  disagreements,
  judges,
}) => {
  const labelName = labelVar?.replace(/^__meta_/, "");
  const hasTables =
    summary &&
    (summary.withLabel.length > 0 || summary.betweenJudges.length > 0);
  return (
    <Stack spacing="lg" p="sm">
      {!hasTables && (
        <Text size="sm" color="dimmed">
          Add a second judge, or pick a column to compare to, to see how often
          judges agree.
        </Text>
      )}
      {summary && summary.withLabel.length > 0 && (
        <AgreementTable
          title={`Agreement with ${labelName ?? "the label"}`}
          rows={summary.withLabel}
          numeric={numeric}
        />
      )}
      {summary && summary.betweenJudges.length > 0 && (
        <AgreementTable
          title="Agreement between judges"
          rows={summary.betweenJudges}
          numeric={numeric}
        />
      )}
      {hasTables && (
        <Text size="xs" color="dimmed">
          Left out: scores with a missing label, or an answer that doesn&apos;t
          fit the format.
        </Text>
      )}
      {disagreements.length > 0 && (
        <DisagreementsTable
          disagreements={disagreements}
          judges={judges}
          labelName={labelName}
        />
      )}
      {invalid.length > 0 && (
        <div>
          <Title order={5} mb={4}>
            Answers that didn&apos;t fit the format
          </Title>
          <Text size="sm" color="dimmed" mb={4}>
            They&apos;re kept as the judge wrote them, and left out of
            agreement.
          </Text>
          <Table fontSize="sm" verticalSpacing={4} maw={560}>
            <tbody>
              {invalid.map((inv) => (
                <tr key={inv.judge}>
                  <td>{inv.judge}</td>
                  <td>
                    {inv.count} of {inv.total}
                  </td>
                  <td>
                    {inv.examples
                      .map(
                        (e) => `“${e.length > 40 ? e.slice(0, 40) + "…" : e}”`,
                      )
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Stack>
  );
};

export default JudgeAgreementView;
