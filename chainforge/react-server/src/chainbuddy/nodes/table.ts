import doc from "../knowledge/nodes/table.md";
import { v4 as uuid } from "uuid";
import { StringLookup } from "../../backend/cache";
import { Dict } from "../../backend/typing";
import { isPlainObject } from "../runtime/tools";
import { listOf, titleSetting } from "./common";
import { NodeKind } from "./types";

/** A column as the node keeps it: an internal key, and the name shown. */
type Column = { key: string; header: string };

const columnNames = (settings: Record<string, unknown>) =>
  listOf(settings.columns).filter((c): c is string => typeof c === "string");

const isCell = (v: unknown) =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";

const rowLabel = (row: unknown) =>
  isPlainObject(row) ? Object.values(row).map(String).join(" | ") : String(row);

export const tableKind: NodeKind = {
  type: "table",
  name: "Tabular Data Node",
  doc,
  // One output per column, named by it; each gives that column's values.
  output: "values",
  outputNames: columnNames,
  accepts: [],
  handles: {},

  settings: {
    title: titleSetting,
    columns: {
      label: "Columns",
      required: true,
      items: { key: String, label: String },
      check: (value) => {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          !value.every((c) => typeof c === "string" && c.trim() !== "")
        )
          return "columns should be a list of at least one column name.";
        const names = value.map((c: string) => c.trim().toLowerCase());
        return new Set(names).size === names.length
          ? undefined
          : "each column needs its own name.";
      },
    },
    rows: {
      label: "Rows",
      required: true,
      items: {
        key: (row) => JSON.stringify(row),
        label: rowLabel,
        separator: "; ",
      },
      check: (value) => {
        if (!Array.isArray(value) || value.length === 0)
          return "rows should be a list of at least one row.";
        return value.every(
          (row) => isPlainObject(row) && Object.values(row).every(isCell),
        )
          ? undefined
          : 'each row should map column names to text, such as { "question": "What is 2+2?", "answer": "4" }.';
      },
    },
    sample: {
      label: "Sample",
      check: (value) =>
        Number.isInteger(value) && (value as number) >= 0
          ? undefined
          : "sample should be how many rows to pick at random, or 0 to send every row.",
    },
  },

  inputs: () => [],

  checkAll: (settings, given) => {
    const names = new Set(columnNames(settings));
    const quote = (list: string[]) => list.map((n) => `"${n}"`).join(", ");

    // Changing the columns alone keeps each row's cells only under names
    // that stay, so a column left out loses its values. A rename needs the
    // rows given again, under the new name.
    if (given.columns !== undefined && given.rows === undefined) {
      const dropped = new Set<string>();
      for (const row of listOf(settings.rows))
        if (isPlainObject(row))
          for (const [name, value] of Object.entries(row))
            if (!names.has(name) && String(value).trim() !== "")
              dropped.add(name);
      if (dropped.size > 0)
        return `columns leaves out ${quote(Array.from(dropped))}, which ${dropped.size === 1 ? "holds" : "hold"} values. To rename a column, give rows too, with its values under the new name; to remove it, give rows without it.`;
      return undefined;
    }

    const unknown = new Set<string>();
    for (const row of listOf(settings.rows))
      if (isPlainObject(row))
        for (const name of Object.keys(row))
          if (!names.has(name)) unknown.add(name);
    if (unknown.size === 0) return undefined;
    return `rows use ${quote(Array.from(unknown))}, which ${unknown.size === 1 ? "isn't a column" : "aren't columns"}. The columns are: ${Array.from(names).join(", ")}.`;
  },

  missing: (settings) =>
    listOf(settings.rows).some(
      (row) =>
        isPlainObject(row) &&
        Object.values(row).some((v) => String(v).trim() !== ""),
    )
      ? undefined
      : "has no rows yet",

  read(data) {
    const columns: Column[] = data.columns ?? [];
    return {
      title: data.title ?? tableKind.name,
      columns: columns.map((c) => c.header),
      rows: ((data.rows ?? []) as Dict[]).map((row) =>
        Object.fromEntries(
          columns.map((c) => [
            c.header,
            String(StringLookup.get(row[c.key]) ?? ""),
          ]),
        ),
      ),
      ...(data.sample ? { sample: data.sampleNum ?? 1 } : {}),
    };
  },

  write(settings, base) {
    const out: Dict = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;

    // A column keeps its key while its name stays, so its cells and the
    // connections from it still find it. New columns get new keys.
    const before: Column[] = base?.columns ?? [];
    let columns = before;
    if (Array.isArray(settings.columns)) {
      const taken = new Set(before.map((c) => c.key));
      let n = 0;
      const newKey = () => {
        while (taken.has(`col-${n}`)) n++;
        taken.add(`col-${n}`);
        return `col-${n}`;
      };
      columns = (settings.columns as string[]).map(
        (header) =>
          before.find((c) => c.header === header) ?? { key: newKey(), header },
      );
      out.columns = columns;
    }

    // Rows are kept by the node under column keys, each with an id that
    // pairs a row's values when they fill several variables. A row keeps
    // the id of the row it replaces.
    const oldRows: Dict[] = base?.rows ?? [];
    const cellsOf = (cell: (c: Column) => unknown) =>
      Object.fromEntries(columns.map((c) => [c.key, cell(c)]));
    if (Array.isArray(settings.rows))
      out.rows = (settings.rows as Dict[]).map((row, i) => ({
        __uid: oldRows[i]?.__uid ?? uuid(),
        ...cellsOf((c) =>
          row[c.header] === undefined ? "" : String(row[c.header]),
        ),
      }));
    else if (Array.isArray(settings.columns))
      out.rows = oldRows.map((row) => ({
        __uid: row.__uid ?? uuid(),
        ...cellsOf((c) => row[c.key] ?? ""),
      }));

    if (typeof settings.sample === "number") {
      out.sample = settings.sample > 0;
      if (settings.sample > 0) out.sampleNum = settings.sample;
    }
    if (base === undefined) {
      out.columns ??= [];
      out.rows ??= [];
    }
    return out;
  },
};
