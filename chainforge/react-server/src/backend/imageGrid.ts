/**
 * Layout logic for the inspector's image grid: which variables can be axes,
 * sensible default axes, and grouping images into split -> row -> column cells.
 *
 * Kept free of React and of value lookups (passed in as accessors), so it can
 * be tested directly.
 */
import type { Dict, LLMResponse, LLMResponseData } from "./typing";

/** Axis id for the model that produced a response (vs. a prompt variable). */
export const MODEL_AXIS = "$LLM";

/** Shown for a response that has no value for an axis variable. */
export const UNSPECIFIED = "(unspecified)";

export interface GridAccessors {
  /** Name of the model that produced a response. */
  modelOf: (response: LLMResponse) => string;
  /** A prompt variable's value as text, or undefined if the response lacks it. */
  valueOf: (response: LLMResponse, varName: string) => string | undefined;
}

/** Axis ids (a prompt variable name or MODEL_AXIS); undefined = not used. */
export interface GridAxes {
  rows?: string;
  cols?: string;
  split?: string;
}

/** One image, and the response it belongs to. */
export interface GridImage {
  uid: string;
  response: LLMResponse;
}

export interface GridSection {
  /** Value of the split axis for this section; undefined when not splitting. */
  value?: string;
  /** cells[row][col] = the images there, in response order. */
  cells: GridImage[][][];
}

export interface ImageGrid {
  /** Row header values; [""] when there is no row axis. */
  rowValues: string[];
  /** Column header values; [""] when there is no column axis. */
  colValues: string[];
  sections: GridSection[];
  /** Every shown image, in reading order (section, row, column, cell). */
  ordered: GridImage[];
}

const isMedia = (v: LLMResponseData | undefined): boolean =>
  typeof v === "object" && v !== null && "t" in v;

const isImage = (v: LLMResponseData): v is { t: "img"; d: string } =>
  typeof v === "object" && v !== null && v.t === "img";

const distinct = (values: string[]): string[] => Array.from(new Set(values));

/** All images in the responses, in response order. Text responses are skipped. */
export function collectImages(responses: LLMResponse[]): GridImage[] {
  const images: GridImage[] = [];
  for (const response of responses)
    for (const r of response.responses)
      if (isImage(r)) images.push({ uid: r.d, response });
  return images;
}

/**
 * Candidate axes: prompt variables of image responses, in first-seen order, and
 * the models involved. Variables holding media (e.g. an input image) are left
 * out; their values are file ids, meaningless as headers.
 */
export function gridAxisOptions(
  images: GridImage[],
  accessors: GridAccessors,
): { vars: string[]; models: string[] } {
  const vars: string[] = [];
  const mediaVars = new Set<string>();
  const models: string[] = [];
  for (const { response } of images) {
    for (const [name, value] of Object.entries(response.vars ?? {})) {
      if (isMedia(value)) mediaVars.add(name);
      else if (!vars.includes(name)) vars.push(name);
    }
    const model = accessors.modelOf(response);
    if (!models.includes(model)) models.push(model);
  }
  return { vars: vars.filter((v) => !mediaVars.has(v)), models };
}

/**
 * Default axes. The first two variables go on rows and columns. With several
 * models and at least two variables, the models become the split, so each
 * model gets its own grid of the two variables. With fewer variables, several
 * models go on the columns instead.
 */
export function defaultGridAxes(vars: string[], numModels: number): GridAxes {
  const multipleModels = numModels > 1;
  if (vars.length >= 2)
    return {
      rows: vars[0],
      cols: vars[1],
      split: multipleModels ? MODEL_AXIS : undefined,
    };
  return {
    rows: vars[0],
    cols: multipleModels ? MODEL_AXIS : undefined,
  };
}

/** An image's value on an axis. */
export function axisValue(
  image: GridImage,
  axis: string,
  accessors: GridAccessors,
): string {
  if (axis === MODEL_AXIS) return accessors.modelOf(image.response);
  return accessors.valueOf(image.response, axis) ?? UNSPECIFIED;
}

/** The distinct values an axis takes across the images, in first-seen order. */
export function axisValues(
  images: GridImage[],
  axis: string,
  accessors: GridAccessors,
): string[] {
  return distinct(images.map((img) => axisValue(img, axis, accessors)));
}

/**
 * Lays images out on the given axes.
 *
 * @param filters Axis -> required value, for variables not on an axis. An
 *   empty or missing value means no filtering on that axis.
 */
export function buildImageGrid(
  images: GridImage[],
  axes: GridAxes,
  filters: Dict<string>,
  accessors: GridAccessors,
): ImageGrid {
  const shown = images.filter((img) =>
    Object.entries(filters).every(
      ([axis, required]) =>
        !required || axisValue(img, axis, accessors) === required,
    ),
  );

  const valuesOn = (axis?: string) =>
    axis ? axisValues(shown, axis, accessors) : [""];
  const rowValues = valuesOn(axes.rows);
  const colValues = valuesOn(axes.cols);
  const splitValues: (string | undefined)[] = axes.split
    ? axisValues(shown, axes.split, accessors)
    : [undefined];

  const sections: GridSection[] = splitValues.map((value) => ({
    value,
    cells: rowValues.map(() => colValues.map(() => [] as GridImage[])),
  }));

  const indexOn = (
    img: GridImage,
    axis: string | undefined,
    values: string[],
  ) => (axis ? values.indexOf(axisValue(img, axis, accessors)) : 0);

  for (const img of shown) {
    const s = axes.split
      ? splitValues.indexOf(axisValue(img, axes.split, accessors))
      : 0;
    const r = indexOn(img, axes.rows, rowValues);
    const c = indexOn(img, axes.cols, colValues);
    sections[s].cells[r][c].push(img);
  }

  const ordered: GridImage[] = [];
  for (const section of sections)
    for (const row of section.cells)
      for (const cell of row) ordered.push(...cell);

  return { rowValues, colValues, sections, ordered };
}
