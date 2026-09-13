import { describe, expect, test } from "@jest/globals";
import {
  buildImageGrid,
  collectImages,
  defaultGridAxes,
  GridAccessors,
  gridAxisOptions,
  MODEL_AXIS,
  UNSPECIFIED,
} from "../imageGrid";
import { LLMResponse } from "../typing";

const accessors: GridAccessors = {
  modelOf: (r) => String(r.llm),
  valueOf: (r, v) =>
    v in r.vars ? String((r.vars as Record<string, unknown>)[v]) : undefined,
};

let nextId = 0;
/** A response with one image per entry of `images` (or text, if a string). */
const response = (
  llm: string,
  vars: Record<string, unknown>,
  images: string[] = [`img${nextId++}`],
): LLMResponse =>
  ({
    uid: `resp${nextId++}`,
    prompt: "a prompt",
    llm,
    vars,
    metavars: {},
    responses: images.map((d) => ({ t: "img", d })),
  }) as unknown as LLMResponse;

const uids = (imgs: { uid: string }[]) => imgs.map((i) => i.uid);

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

describe("collecting images and axis options", () => {
  test("text responses are skipped", () => {
    const withText = {
      ...response("gpt", {}),
      responses: ["some text", { t: "img", d: "pic" }],
    } as unknown as LLMResponse;
    expect(uids(collectImages([withText]))).toEqual(["pic"]);
  });

  test("variables in first-seen order, with the models involved", () => {
    const images = collectImages([
      response("gpt", { style: "photo", subject: "cat" }),
      response("flux", { style: "sketch", seed: "1" }),
    ]);
    expect(gridAxisOptions(images, accessors)).toEqual({
      vars: ["style", "subject", "seed"],
      models: ["gpt", "flux"],
    });
  });

  test("variables holding media are not offered as axes", () => {
    const images = collectImages([
      response("vlm", { image: { t: "img", d: "input" }, question: "what?" }),
    ]);
    expect(gridAxisOptions(images, accessors).vars).toEqual(["question"]);
  });
});

describe("building the grid", () => {
  const catPhoto = response("gpt", { style: "photo", subject: "cat" }, ["a"]);
  const dogPhoto = response("gpt", { style: "photo", subject: "dog" }, ["b"]);
  const catSketch = response("gpt", { style: "sketch", subject: "cat" }, ["c"]);
  const catPhotoFlux = response("flux", { style: "photo", subject: "cat" }, [
    "d",
  ]);
  const images = collectImages([catPhoto, dogPhoto, catSketch, catPhotoFlux]);

  test("rows and columns take their values in first-seen order", () => {
    const grid = buildImageGrid(
      images,
      { rows: "style", cols: "subject" },
      {},
      accessors,
    );
    expect(grid.rowValues).toEqual(["photo", "sketch"]);
    expect(grid.colValues).toEqual(["cat", "dog"]);
    expect(grid.sections).toHaveLength(1);
  });

  test("each cell holds every image with those values", () => {
    const { sections } = buildImageGrid(
      images,
      { rows: "style", cols: "subject" },
      {},
      accessors,
    );
    const cells = sections[0].cells.map((row) => row.map(uids));
    expect(cells).toEqual([
      [["a", "d"], ["b"]],
      [["c"], []],
    ]);
  });

  test("splitting repeats the grid per value, with shared headers", () => {
    const grid = buildImageGrid(
      images,
      { rows: "style", cols: "subject", split: MODEL_AXIS },
      {},
      accessors,
    );
    expect(grid.sections.map((s) => s.value)).toEqual(["gpt", "flux"]);
    expect(grid.colValues).toEqual(["cat", "dog"]);
    const flux = grid.sections[1].cells.map((row) => row.map(uids));
    expect(flux).toEqual([
      [["d"], []],
      [[], []],
    ]);
  });

  test("several images for one prompt share a cell", () => {
    const samples = collectImages([
      response("gpt", { style: "photo" }, ["s1", "s2", "s3"]),
    ]);
    const { sections } = buildImageGrid(
      samples,
      { rows: "style" },
      {},
      accessors,
    );
    expect(uids(sections[0].cells[0][0])).toEqual(["s1", "s2", "s3"]);
  });

  test("no axes puts everything in one cell", () => {
    const grid = buildImageGrid(images, {}, {}, accessors);
    expect(grid.rowValues).toEqual([""]);
    expect(grid.colValues).toEqual([""]);
    expect(uids(grid.sections[0].cells[0][0])).toEqual(["a", "b", "c", "d"]);
  });

  test("a missing variable is grouped as unspecified", () => {
    const withMissing = collectImages([
      response("gpt", { style: "photo" }, ["x"]),
      response("gpt", {}, ["y"]),
    ]);
    const grid = buildImageGrid(withMissing, { rows: "style" }, {}, accessors);
    expect(grid.rowValues).toEqual(["photo", UNSPECIFIED]);
  });

  test("filters keep only matching images, and headers follow", () => {
    const grid = buildImageGrid(
      images,
      { rows: "style" },
      { subject: "dog" },
      accessors,
    );
    expect(uids(grid.ordered)).toEqual(["b"]);
    expect(grid.rowValues).toEqual(["photo"]);
  });

  test("an empty filter value means all", () => {
    const grid = buildImageGrid(
      images,
      { rows: "style" },
      { subject: "" },
      accessors,
    );
    expect(grid.ordered).toHaveLength(4);
  });

  test("reading order runs section, row, column, then cell", () => {
    const grid = buildImageGrid(
      images,
      { rows: "style", cols: "subject", split: MODEL_AXIS },
      {},
      accessors,
    );
    // gpt: photo/cat a, photo/dog b, sketch/cat c; then flux: photo/cat d
    expect(uids(grid.ordered)).toEqual(["a", "b", "c", "d"]);
  });
});
