import { describe, expect, test } from "@jest/globals";
import {
  buildGrid,
  collectGridItems,
  defaultGridAxes,
  formatScore,
  GridAccessors,
  gridAxisOptions,
  GridItem,
  heatLevel,
  heatScaleFor,
  metricValue,
  MODEL_AXIS,
  passFail,
  SCORE_METRIC,
  scoreMetrics,
  UNSPECIFIED,
} from "../responseGrid";
import { EvaluationScore, LLMResponse } from "../typing";

const accessors: GridAccessors = {
  modelOf: (r) => String(r.llm),
  valueOf: (r, v) =>
    v in r.vars ? String((r.vars as Record<string, unknown>)[v]) : undefined,
  textOf: (d) => String(d),
};

let nextId = 0;
/** A response whose outputs are image ids, or text when given { text }. */
const response = (
  llm: string,
  vars: Record<string, unknown>,
  outputs: (string | { text: string })[] = [`img${nextId++}`],
  scores?: EvaluationScore[],
): LLMResponse =>
  ({
    uid: `resp${nextId++}`,
    prompt: "a prompt",
    llm,
    vars,
    metavars: {},
    responses: outputs.map((o) =>
      typeof o === "string" ? { t: "img", d: o } : o.text,
    ),
    ...(scores ? { eval_res: { items: scores, dtype: "Unknown" } } : {}),
  }) as unknown as LLMResponse;

const text = (t: string) => ({ text: t });

/** Image uid or text of each item. */
const ids = (items: GridItem[]) =>
  items.map((i) => (i.kind === "image" ? i.uid : i.text));

const items = (...responses: LLMResponse[]) =>
  collectGridItems(responses, accessors);

describe("default axes", () => {
  test("two or more variables with several models: split by model", () => {
    expect(defaultGridAxes(["style", "subject", "seed"], 2)).toEqual({
      rows: "style",
      cols: "subject",
      split: MODEL_AXIS,
    });
  });

  test("two or more variables with one model: no split", () => {
    expect(defaultGridAxes(["style", "subject"], 1)).toEqual({
      rows: "style",
      cols: "subject",
      split: undefined,
    });
  });

  test("one variable with several models: models become columns", () => {
    expect(defaultGridAxes(["style"], 3)).toEqual({
      rows: "style",
      cols: MODEL_AXIS,
    });
  });

  test("one variable with one model: rows only", () => {
    expect(defaultGridAxes(["style"], 1)).toEqual({
      rows: "style",
      cols: undefined,
    });
  });

  test("no variables with several models: models as columns", () => {
    expect(defaultGridAxes([], 2)).toEqual({
      rows: undefined,
      cols: MODEL_AXIS,
    });
  });
});

describe("collecting items and axis options", () => {
  test("text and image responses are both collected, with their positions", () => {
    const collected = items(
      response("gpt", {}, [text("hello"), "pic", text("bye")]),
    );
    expect(collected.map((i) => [i.kind, i.index])).toEqual([
      ["text", 0],
      ["image", 1],
      ["text", 2],
    ]);
    expect(ids(collected)).toEqual(["hello", "pic", "bye"]);
  });

  test("documents are skipped", () => {
    const withDoc = {
      ...response("gpt", {}),
      responses: [{ t: "doc", d: "file" }, "text"],
    } as unknown as LLMResponse;
    expect(ids(items(withDoc))).toEqual(["text"]);
  });

  test("variables in first-seen order, with the models involved", () => {
    expect(
      gridAxisOptions(
        items(
          response("gpt", { style: "photo", subject: "cat" }),
          response("flux", { style: "sketch", seed: "1" }),
        ),
        accessors,
      ),
    ).toEqual({ vars: ["style", "subject", "seed"], models: ["gpt", "flux"] });
  });

  test("variables holding media are not offered as axes", () => {
    const collected = items(
      response("vlm", { image: { t: "img", d: "input" }, question: "what?" }, [
        text("a cat"),
      ]),
    );
    expect(gridAxisOptions(collected, accessors).vars).toEqual(["question"]);
  });
});

describe("building the grid", () => {
  const all = items(
    response("gpt", { style: "photo", subject: "cat" }, ["a"]),
    response("gpt", { style: "photo", subject: "dog" }, ["b"]),
    response("gpt", { style: "sketch", subject: "cat" }, ["c"]),
    response("flux", { style: "photo", subject: "cat" }, ["d"]),
  );

  test("rows and columns take their values in first-seen order", () => {
    const grid = buildGrid(
      all,
      { rows: "style", cols: "subject" },
      {},
      accessors,
    );
    expect(grid.rowValues).toEqual(["photo", "sketch"]);
    expect(grid.colValues).toEqual(["cat", "dog"]);
    expect(grid.sections).toHaveLength(1);
  });

  test("each cell holds every item with those values", () => {
    const { sections } = buildGrid(
      all,
      { rows: "style", cols: "subject" },
      {},
      accessors,
    );
    expect(sections[0].cells.map((row) => row.map(ids))).toEqual([
      [["a", "d"], ["b"]],
      [["c"], []],
    ]);
  });

  test("splitting repeats the grid per value, with shared headers", () => {
    const grid = buildGrid(
      all,
      { rows: "style", cols: "subject", split: MODEL_AXIS },
      {},
      accessors,
    );
    expect(grid.sections.map((s) => s.value)).toEqual(["gpt", "flux"]);
    expect(grid.colValues).toEqual(["cat", "dog"]);
    expect(grid.sections[1].cells.map((row) => row.map(ids))).toEqual([
      [["d"], []],
      [[], []],
    ]);
  });

  test("text and images can share a grid", () => {
    const mixed = items(
      response("gpt", { topic: "cats" }, [text("Cats purr.")]),
      response("gpt-image", { topic: "cats" }, ["cat.png"]),
    );
    const grid = buildGrid(mixed, { cols: MODEL_AXIS }, {}, accessors);
    expect(grid.sections[0].cells[0].map(ids)).toEqual([
      ["Cats purr."],
      ["cat.png"],
    ]);
  });

  test("several responses to one prompt share a cell", () => {
    const samples = items(
      response("gpt", { style: "photo" }, [text("one"), text("two")]),
    );
    const { sections } = buildGrid(samples, { rows: "style" }, {}, accessors);
    expect(ids(sections[0].cells[0][0])).toEqual(["one", "two"]);
  });

  test("no axes puts everything in one cell", () => {
    const grid = buildGrid(all, {}, {}, accessors);
    expect(grid.rowValues).toEqual([""]);
    expect(grid.colValues).toEqual([""]);
    expect(ids(grid.sections[0].cells[0][0])).toEqual(["a", "b", "c", "d"]);
  });

  test("a missing variable is grouped as unspecified", () => {
    const withMissing = items(
      response("gpt", { style: "photo" }, ["x"]),
      response("gpt", {}, ["y"]),
    );
    expect(
      buildGrid(withMissing, { rows: "style" }, {}, accessors).rowValues,
    ).toEqual(["photo", UNSPECIFIED]);
  });

  test("filters keep only matching items, and headers follow", () => {
    const grid = buildGrid(
      all,
      { rows: "style" },
      { subject: "dog" },
      accessors,
    );
    expect(ids(grid.ordered)).toEqual(["b"]);
    expect(grid.rowValues).toEqual(["photo"]);
  });

  test("an empty filter value means all", () => {
    expect(
      buildGrid(all, { rows: "style" }, { subject: "" }, accessors).ordered,
    ).toHaveLength(4);
  });

  test("reading order runs section, row, column, then cell", () => {
    const grid = buildGrid(
      all,
      { rows: "style", cols: "subject", split: MODEL_AXIS },
      {},
      accessors,
    );
    expect(ids(grid.ordered)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("evaluation scores", () => {
  test("each output's score is found at its position", () => {
    const [first, second] = items(
      response("gpt", {}, [text("a"), text("b")], [0.2, 0.9]),
    );
    expect(metricValue(first, SCORE_METRIC)).toBe(0.2);
    expect(metricValue(second, SCORE_METRIC)).toBe(0.9);
  });

  test("metrics list single scores first, then named metrics", () => {
    const scored = items(
      response("gpt", {}, [text("a")], [true]),
      response("gpt", {}, [text("b")], [{ relevance: 3, tone: "formal" }]),
      response("gpt", {}, [text("c")]), // unscored
    );
    expect(scoreMetrics(scored)).toEqual([SCORE_METRIC, "relevance", "tone"]);
    expect(metricValue(scored[1], "relevance")).toBe(3);
    expect(metricValue(scored[1], SCORE_METRIC)).toBeUndefined();
    expect(metricValue(scored[2], SCORE_METRIC)).toBeUndefined();
  });

  test("unscored responses have no metrics", () => {
    expect(scoreMetrics(items(response("gpt", {}, [text("a")])))).toEqual([]);
  });

  test("numeric scores get a min-max scale, ignoring unscored items", () => {
    const scored = items(
      response("gpt", {}, [text("a"), text("b"), text("c")], [2, 8, 5]),
      response("gpt", {}, [text("d")]),
    );
    const scale = heatScaleFor(scored, SCORE_METRIC);
    expect(scale).toEqual({ kind: "numeric", min: 2, max: 8 });
    expect(heatLevel(2, scale!)).toBe(0);
    expect(heatLevel(8, scale!)).toBe(1);
    expect(heatLevel(5, scale!)).toBe(0.5);
    expect(heatLevel(undefined, scale!)).toBeUndefined();
  });

  test("identical numeric scores all sit at the top of the scale", () => {
    const scale = heatScaleFor(
      items(response("gpt", {}, [text("a"), text("b")], [3, 3])),
      SCORE_METRIC,
    );
    expect(heatLevel(3, scale!)).toBe(1);
  });

  test("booleans and pass/fail words get a pass/fail scale", () => {
    const scored = items(
      response(
        "gpt",
        {},
        [text("a"), text("b"), text("c")],
        [true, "No", " pass "],
      ),
    );
    const scale = heatScaleFor(scored, SCORE_METRIC);
    expect(scale).toEqual({ kind: "passfail" });
    expect(heatLevel(true, scale!)).toBe(1);
    expect(heatLevel("No", scale!)).toBe(0);
    expect(heatLevel(" pass ", scale!)).toBe(1);
  });

  test("categories have no heat scale", () => {
    const scored = items(
      response("gpt", {}, [text("a"), text("b")], ["formal", "casual"]),
    );
    expect(heatScaleFor(scored, SCORE_METRIC)).toBeUndefined();
  });

  test("pass/fail words are recognized regardless of case", () => {
    expect(passFail("YES")).toBe(true);
    expect(passFail("failed")).toBe(false);
    expect(passFail("maybe")).toBeUndefined();
    expect(passFail(1)).toBeUndefined();
  });

  test("badges show short score labels", () => {
    expect(formatScore(3)).toBe("3");
    expect(formatScore(0.8333)).toBe("0.83");
    expect(formatScore(0.5)).toBe("0.5");
    expect(formatScore(false)).toBe("false");
    expect(formatScore("a very long category name")).toBe("a very long c…");
  });
});
