import { describe, expect, test } from "@jest/globals";
import {
  formatInstruction,
  findDisagreements,
  judgeAgreement,
  parseCategories,
  parseScore,
  scoreSpecFrom,
} from "../scorerFormat";
import { EvaluationScore, LLMResponse } from "../typing";

const CATS = scoreSpecFrom(
  "cat",
  "billing: charges, invoices\ntechnical: bugs\n\nBilling: duplicate",
);
const SCALE = scoreSpecFrom("num", undefined, "Rude\nNeutral\nWarm");

describe("parsing a scorer's options", () => {
  test("reads categories with optional descriptions, skipping blanks and duplicates", () => {
    expect(
      parseCategories("billing: charges, invoices\ntechnical\n\n"),
    ).toEqual([
      { label: "billing", description: "charges, invoices" },
      { label: "technical" },
    ]);
    expect(CATS.categories?.map((c) => c.label)).toEqual([
      "billing",
      "technical",
    ]);
  });

  test("ignores categories and scale for other formats", () => {
    expect(scoreSpecFrom("bin", "a\nb", "x\ny")).toEqual({ format: "bin" });
    expect(scoreSpecFrom("cat", "", undefined)).toEqual({ format: "cat" });
  });
});

describe("telling judges how to answer", () => {
  test("lists the categories, with descriptions", () => {
    const instr = formatInstruction(CATS, false);
    expect(instr).toContain("exactly one of these categories");
    expect(instr).toContain("- billing: charges, invoices");
    expect(instr).toContain("- technical: bugs");
  });

  test("numbers the scale's levels", () => {
    const instr = formatInstruction(SCALE, true);
    expect(instr).toContain("SCORE: number");
    expect(instr).toContain("1: Rude\n2: Neutral\n3: Warm");
  });

  test("keeps the old instructions when nothing is spelled out", () => {
    expect(formatInstruction({ format: "bin" }, false)).toBe(
      "Only reply with boolean values true or false, nothing else.",
    );
  });
});

describe("reading judges' answers", () => {
  test("matches categories loosely, returning the label as written", () => {
    expect(parseScore("Billing.", CATS)).toEqual({
      value: "billing",
      valid: true,
    });
    expect(parseScore('"technical"', CATS)).toEqual({
      value: "technical",
      valid: true,
    });
    expect(parseScore("**billing**", CATS).value).toBe("billing");
  });

  test("keeps an answer outside the categories as written, marked invalid", () => {
    expect(parseScore("Sales ", CATS)).toEqual({
      value: "Sales",
      valid: false,
    });
  });

  test("reads the final SCORE line after reasoning", () => {
    expect(
      parseScore(
        "The customer mentions a double charge.\nSCORE: Billing",
        CATS,
      ),
    ).toEqual({ value: "billing", valid: true });
    expect(
      parseScore("Seems fine.\n**Score:** yes", { format: "bin" }),
    ).toEqual({ value: true, valid: true });
  });

  test("bounds numbers to the scale", () => {
    expect(parseScore("2", SCALE)).toEqual({ value: 2, valid: true });
    expect(parseScore("4", SCALE).valid).toBe(false);
    expect(parseScore("two", SCALE).valid).toBe(false);
    // Without a scale, any number goes
    expect(parseScore("42.5", { format: "num" })).toEqual({
      value: 42.5,
      valid: true,
    });
  });

  test("marks a binary answer that isn't true/false invalid", () => {
    expect(parseScore("maybe", { format: "bin" }).valid).toBe(false);
  });
});

const resp = (
  uid: string,
  items: EvaluationScore[],
  label?: string,
): LLMResponse => ({
  uid,
  prompt: "p",
  vars: {},
  metavars: label !== undefined ? { team: label } : {},
  llm: "M",
  responses: items.map(() => "r"),
  eval_res: { items, dtype: "KeyValue_Categorical" },
});

describe("agreement between judges and with a label", () => {
  const responses = [
    resp("1", [{ A: "billing", B: "billing" }], "billing"),
    resp("2", [{ A: "technical", B: "billing" }], "technical"),
    resp("3", [{ A: "billing", B: "Sales" }], "technical"), // B invalid
    resp("4", [{ A: "billing", B: "billing" }]), // no label
  ];

  test("exact-match rates, leaving out missing labels and invalid answers", () => {
    const { withLabel, betweenJudges } = judgeAgreement(
      responses,
      ["A", "B"],
      true,
      CATS,
      "__meta_team",
    );
    expect(withLabel).toEqual([
      { name: "A", n: 3, excluded: 1, agreement: 2 / 3 },
      { name: "B", n: 2, excluded: 2, agreement: 1 / 2 },
    ]);
    expect(betweenJudges).toEqual([
      { name: "A vs. B", n: 3, excluded: 1, agreement: 2 / 3 },
    ]);
  });

  test("mean absolute difference for numeric scores, with a single unkeyed judge", () => {
    const numeric: LLMResponse[] = [
      { ...resp("1", [3], "1"), eval_res: { items: [3], dtype: "Numeric" } },
      { ...resp("2", [2], "2"), eval_res: { items: [2], dtype: "Numeric" } },
    ];
    const { withLabel } = judgeAgreement(
      numeric,
      ["Judge"],
      false,
      SCALE,
      "__meta_team",
    );
    expect(withLabel).toEqual([
      { name: "Judge", n: 2, excluded: 0, meanAbsDiff: 1 },
    ]);
  });
});

describe("listing disagreements", () => {
  const responses = [
    resp("1", [{ A: "billing", B: "billing" }], "billing"), // all agree
    resp("2", [{ A: "technical", B: "billing" }], "technical"), // B differs from label
    resp("3", [{ A: "billing", B: "Sales" }]), // no label: B differs from... a tie
    resp("4", [{ A: "billing", B: "billing" }]), // no label, judges agree
  ];

  test("against the label where there is one, else between judges", () => {
    const found = findDisagreements(
      responses,
      ["A", "B"],
      true,
      CATS,
      "__meta_team",
    );
    expect(found.map((d) => d.uid)).toEqual(["2", "3"]);
    expect(found[0]).toMatchObject({
      label: "technical",
      answers: { A: "technical", B: "billing" },
      outliers: ["B"],
      response: "r",
    });
  });

  test("a single judge is listed where it differs from the label", () => {
    const single: LLMResponse[] = [
      {
        ...resp("1", ["billing"], "technical"),
        eval_res: { items: ["billing"], dtype: "Categorical" },
      },
      {
        ...resp("2", ["billing"], "billing"),
        eval_res: { items: ["billing"], dtype: "Categorical" },
      },
    ];
    const found = findDisagreements(single, ["J"], false, CATS, "__meta_team");
    expect(found.map((d) => d.uid)).toEqual(["1"]);
    expect(found[0].outliers).toEqual(["J"]);
  });
});
