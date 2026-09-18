/**
 * The Inspector's "Judges" tab for an LLM Scorer: how often each judge agrees
 * with the ground-truth label and with each other judge, and which answers
 * didn't fit the scorer's format.
 */
import React, { useEffect, useState } from "react";
import { Stack, Table, Text, Title } from "@mantine/core";
import useStore from "./store";
import {
  AgreementRow,
  AgreementSummary,
  Disagreement,
  ReliabilityRow,
} from "./backend/scorerFormat";
import { InvalidScores, JudgeStats } from "./backend/backend";
import { formatCost } from "./backend/responseStats";
import { EvaluationScore } from "./backend/typing";

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

const show = (v: EvaluationScore | undefined, p?: number) =>
  (v === undefined
    ? "–"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v)) + (p !== undefined ? ` (${pct(p)})` : "");

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
                        {show(d.answers[j], d.probs[j])}
                      </Text>
                    ) : (
                      show(d.answers[j], d.probs[j])
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

const formatLatency = (ms: number) =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;

/** Longest bar in a table cell, in pixels. */
const MAX_BAR_PX = 90;

/**
 * A table cell with a value and a bar for it, in the judge's model color,
 * scaled to the column's largest value, so judges compare at a glance.
 */
const BarCell: React.FC<{
  value?: number;
  max: number;
  color?: string;
  label: string;
}> = ({ value, max, color, label }) => (
  <td>
    {value === undefined ? (
      "–"
    ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            flex: "none",
            width: max > 0 ? Math.max(2, (value / max) * MAX_BAR_PX) : 2,
            height: 12,
            borderRadius: "0 4px 4px 0",
            backgroundColor: color ?? "#888",
          }}
        />
        <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      </div>
    )}
  </td>
);

/** Each judge's cost, time per answer and tokens over the last run. */
const JudgeStatsTable: React.FC<{ stats: JudgeStats[] }> = ({ stats }) => {
  // Each judge in its model's color, the same as elsewhere in ChainForge
  const getColor = useStore((st) => st.getColorForLLMAndSetIfNotFound);
  const [colors, setColors] = useState<Record<string, string>>({});
  useEffect(() => {
    setColors(
      Object.fromEntries(stats.map((s) => [s.judge, getColor(s.judge)])),
    );
  }, [stats, getColor]);
  const maxCost = Math.max(0, ...stats.map((s) => s.cost_usd ?? 0));
  const maxLatency = Math.max(0, ...stats.map((s) => s.median_latency_ms ?? 0));

  return (
    <div>
      <Title order={5} mb={4}>
        Cost and speed
      </Title>
      <div style={{ overflowX: "auto" }}>
        <Table fontSize="sm" verticalSpacing={4} maw={760}>
          <thead>
            <tr>
              <th></th>
              <th>Answers</th>
              <th>Cost</th>
              <th>Median time per answer</th>
              <th>Input tokens</th>
              <th>Output tokens</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.judge}>
                <td style={{ whiteSpace: "nowrap" }}>{s.judge}</td>
                <td>{s.answers}</td>
                <BarCell
                  value={s.cost_usd}
                  max={maxCost}
                  color={colors[s.judge]}
                  label={
                    s.cost_usd === undefined
                      ? ""
                      : formatCost(s.cost_usd) +
                        (s.priced < s.answers
                          ? ` (${s.priced} of ${s.answers} priced)`
                          : "")
                  }
                />
                <BarCell
                  value={s.median_latency_ms}
                  max={maxLatency}
                  color={colors[s.judge]}
                  label={
                    s.median_latency_ms === undefined
                      ? ""
                      : formatLatency(s.median_latency_ms)
                  }
                />
                <td>{s.input_tokens?.toLocaleString() ?? "–"}</td>
                <td>{s.output_tokens?.toLocaleString() ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Text size="xs" color="dimmed" mt={4}>
        Includes answers loaded from the cache, at what they cost when first
        fetched. Cost is shown where the provider reports it (e.g. OpenRouter).
      </Text>
    </div>
  );
};

/** How often a judge is right at each probability it states, against the label. */
const ReliabilityTable: React.FC<{
  judge: string;
  rows: ReliabilityRow[];
  labelName?: string;
}> = ({ judge, rows, labelName }) => (
  <div>
    <Title order={5} mb={4}>
      {judge}&apos;s confidence vs. {labelName ?? "the label"}
    </Title>
    <Text size="sm" color="dimmed" mb={4}>
      {judge} says how likely each answer is to be right. If it&apos;s well
      calibrated, answers it gives 90% are right about 90% of the time.
    </Text>
    <Table fontSize="sm" verticalSpacing={4} maw={560}>
      <thead>
        <tr>
          <th>Stated probability</th>
          <th>Answers</th>
          <th>Mean stated</th>
          <th>Right</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.range}>
            <td>{r.range}</td>
            <td>{r.n}</td>
            <td>{pct(r.mean_p)}</td>
            <td>
              {pct(r.correct / r.n)} ({r.correct} of {r.n})
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
);

export interface JudgeAgreementViewProps {
  summary?: AgreementSummary;
  numeric: boolean;
  labelVar?: string;
  invalid: InvalidScores[];
  disagreements: Disagreement[];
  judges: string[];
  judgeStats?: JudgeStats[];
  /** Reliability tables, by judge, for judges that state probabilities. */
  reliabilityByJudge?: Record<string, ReliabilityRow[]>;
}

const JudgeAgreementView: React.FC<JudgeAgreementViewProps> = ({
  summary,
  numeric,
  labelVar,
  invalid,
  disagreements,
  judges,
  judgeStats,
  reliabilityByJudge,
}) => {
  const labelName = labelVar?.replace(/^__meta_/, "");
  const hasTables =
    summary &&
    (summary.withLabel.length > 0 || summary.betweenJudges.length > 0);
  return (
    <Stack spacing="lg" p="sm">
      {!hasTables && !(judgeStats && judgeStats.length > 0) && (
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
      {judgeStats && judgeStats.length > 0 && (
        <JudgeStatsTable stats={judgeStats} />
      )}
      {Object.entries(reliabilityByJudge ?? {}).map(
        ([judge, rows]) =>
          rows.length > 0 && (
            <ReliabilityTable
              key={judge}
              judge={judge}
              rows={rows}
              labelName={labelName}
            />
          ),
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
