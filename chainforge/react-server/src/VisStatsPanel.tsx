import React from "react";
import { Loader } from "@mantine/core";
import { EvalStatsEntity, EvalStatsResult } from "./backend/evalStats";

/**
 * The statistics shown under a Vis Node plot, from evalstats: an executive
 * summary of which groups are tied for highest and which are significantly lower, a collapsible
 * table of pairwise differences, which items had to be left out, and what
 * evalstats ran.
 */
export interface VisStatsPanelProps {
  result?: EvalStatsResult;
  loading: boolean;
  error?: string;
  /** Why statistics can't be shown for the current plot, if they can't. */
  unsupported?: string;
  /** When there are too few inputs, explains what's counted as one. */
  hint?: string;
  /** Show means as percentages (for true/false scores). */
  asPercent: boolean;
  nameOf: (entity: EvalStatsEntity) => string;
  colorOf?: (entity: EvalStatsEntity) => string | undefined;
  colorScheme: "light" | "dark";
}

const formatValue = (x: number | null, asPercent: boolean, signed = false) => {
  if (x === null) return "–";
  const sign = signed && x > 0 ? "+" : "";
  if (asPercent) return `${sign}${(x * 100).toFixed(1)}%`;
  const digits = Math.abs(x) >= 100 ? 1 : Math.abs(x) >= 10 ? 2 : 3;
  return sign + x.toFixed(digits);
};

// Direction-neutral, since a higher score isn't always better (a bias rate, say).
const VERDICTS: Record<string, string> = {
  likely_best: "Highest",
  tied_for_best: "Tied for highest",
  significant_drop_off: "Significantly lower",
};

const formatP = (p: number | null) =>
  p === null ? "–" : p < 0.001 ? "<0.001" : p.toFixed(3);

const ellipsis: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const VisStatsPanel: React.FC<VisStatsPanelProps> = ({
  result,
  loading,
  error,
  unsupported,
  hint,
  asPercent,
  nameOf,
  colorOf,
  colorScheme,
}) => {
  const dark = colorScheme === "dark";
  const muted = dark ? "#aaa" : "#666";
  const best = dark ? "#69db7c" : "#2b8a3e";
  const rule = `1px solid ${dark ? "#444" : "#ddd"}`;
  const note: React.CSSProperties = { color: muted, margin: "4px 0" };
  const cell: React.CSSProperties = { padding: "1px 4px", ...ellipsis };
  const list: React.CSSProperties = { margin: "2px 0", paddingLeft: 16 };

  let body: React.ReactNode;
  if (unsupported) body = <p style={note}>{unsupported}</p>;
  else if (error)
    body = (
      <p style={{ ...note, color: dark ? "#ff8787" : "#c92a2a" }}>{error}</p>
    );
  else if (!result)
    body = loading ? (
      <div style={{ ...note, display: "flex", gap: 6, alignItems: "center" }}>
        <Loader size="xs" /> Computing statistics...
      </div>
    ) : null;
  else {
    const ciPct = Math.round((1 - result.alpha) * 100);
    const one = result.n_excluded === 1;
    const excluded = result.n_excluded > 0 && (
      <details
        style={{
          margin: "4px 0",
          padding: "3px 6px",
          borderRadius: 4,
          background: dark ? "#4a3f10" : "#fff4c2",
        }}
      >
        <summary style={{ cursor: "pointer" }}>
          {result.n_excluded} {one ? "item was" : "items were"} left out of the
          statistics because {one ? "it didn't" : "they didn't"} have results
          for every group (the plot still includes {one ? "it" : "them"}). Rerun
          the upstream queries to fill them in.
        </summary>
        <ul style={list}>
          {result.excluded_items.map((label, i) => (
            <li key={i} style={ellipsis} title={label}>
              {label}
            </li>
          ))}
          {result.n_excluded > result.excluded_items.length && (
            <li>and {result.n_excluded - result.excluded_items.length} more</li>
          )}
        </ul>
      </details>
    );

    if (!result.ok)
      body = (
        <>
          {excluded}
          <p style={note}>{result.message}</p>
          {result.reason === "too_few_items" && hint && (
            <p style={note}>{hint}</p>
          )}
        </>
      );
    else {
      const { entities, pairwise } = result;
      const verdictOf = (e: EvalStatsEntity) =>
        e.verdict === null ? "" : VERDICTS[e.verdict] ?? e.verdict;
      const sortedPairs = [...pairwise].sort(
        (x, y) => (x.p_value ?? 2) - (y.p_value ?? 2),
      );

      body = (
        <>
          {excluded}
          <table
            style={{
              width: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",
            }}
          >
            <thead style={{ color: muted, textAlign: "left" }}>
              <tr style={{ borderBottom: rule }}>
                <th style={{ ...cell, width: "22px" }} title="Rank band">
                  #
                </th>
                <th style={cell}>Summary</th>
                <th style={{ ...cell, width: "40%" }}>Mean [{ciPct}% CI]</th>
                <th style={{ ...cell, width: "26%" }}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e, i) => {
                const name = nameOf(e);
                const color = colorOf?.(e);
                const isBest = e.band === 1;
                return (
                  <tr key={i} style={{ fontWeight: isBest ? 600 : undefined }}>
                    <td style={{ ...cell, color: isBest ? best : muted }}>
                      {e.band ?? ""}
                    </td>
                    <td style={cell} title={name}>
                      {color && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            marginRight: 4,
                            background: color,
                          }}
                        />
                      )}
                      {name}
                    </td>
                    <td style={cell}>
                      {formatValue(e.mean, asPercent)}{" "}
                      <span style={{ color: muted, fontWeight: 400 }}>
                        [{formatValue(e.ci_low, asPercent)},{" "}
                        {formatValue(e.ci_high, asPercent)}]
                      </span>
                    </td>
                    <td style={{ ...cell, color: isBest ? best : undefined }}>
                      {verdictOf(e)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: "pointer", color: muted }}>
              Pairwise differences ({pairwise.length})
            </summary>
            <div style={{ maxHeight: 118, overflowY: "auto" }}>
              <table
                style={{
                  width: "100%",
                  tableLayout: "fixed",
                  borderCollapse: "collapse",
                }}
              >
                <thead style={{ color: muted, textAlign: "left" }}>
                  <tr
                    style={{ borderBottom: rule }}
                    title="Bold: a significant difference, by the test the rank bands use"
                  >
                    <th style={cell}>Comparison</th>
                    <th style={{ ...cell, width: "18%" }}>Diff.</th>
                    <th style={{ ...cell, width: "30%" }}>{ciPct}% CI</th>
                    <th style={{ ...cell, width: "16%" }}>p</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPairs.map((pair, i) => {
                    const label = `${nameOf(entities[pair.a])} − ${nameOf(entities[pair.b])}`;
                    const significant = pair.significant;
                    return (
                      <tr
                        key={i}
                        style={{ fontWeight: significant ? 600 : undefined }}
                      >
                        <td style={cell} title={label}>
                          {label}
                        </td>
                        <td style={cell}>
                          {formatValue(pair.diff, asPercent, true)}
                        </td>
                        <td style={cell}>
                          [{formatValue(pair.ci_low, asPercent, true)},{" "}
                          {formatValue(pair.ci_high, asPercent, true)}]
                        </td>
                        <td style={cell}>{formatP(pair.p_value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>

          <div style={{ ...note, fontSize: "7.5pt" }}>
            {result.n_items} items
            {result.n_runs > 1 ? ` × ${result.n_runs} runs` : ""} · paired ·
            evalstats
            {loading ? " · updating..." : ""}
            <details>
              <summary style={{ cursor: "pointer" }}>
                Methods and notes from evalstats
              </summary>
              <ul style={list}>
                {result.methods.map((m, i) => (
                  <li key={i}>
                    <b>{m.label}:</b> {m.value}
                  </li>
                ))}
              </ul>
              {result.notes.length > 0 && (
                <>
                  <b>Notes</b>
                  <ul style={list}>
                    {result.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
            </details>
          </div>
        </>
      );
    }
  }

  return (
    <div
      className="vis-stats-panel nodrag nowheel"
      // Take the plot's width without widening the node.
      style={{
        width: 0,
        minWidth: "100%",
        fontSize: "8pt",
        marginTop: 4,
        borderTop: rule,
        paddingTop: 2,
      }}
    >
      {body}
    </div>
  );
};

export default VisStatsPanel;
