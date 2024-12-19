import { v4 as uuidv4 } from "uuid";
import { Dict, TabularDataRowType, TabularDataColType } from "./typing";
/*
  This file contains utility functions for parsing raw table data
  into a format for TabularDataNode
*/
export function parseTableData(rawTableData: any[]): {
  columns: TabularDataColType[];
  rows: TabularDataRowType[];
} {
  if (!Array.isArray(rawTableData)) {
    throw new Error(
      "Table data is not in array format: " +
        (rawTableData !== undefined && rawTableData !== null
          ? String(rawTableData)
          : ""),
    );
  }

  // Extract unique column names
  const headers = new Set<string>();
  rawTableData.forEach((row) =>
    Object.keys(row).forEach((key) => headers.add(key)),
  );

  // Create columns with unique IDs
  const columns = Array.from(headers).map((header, idx) => ({
    header,
    key: `c${idx}`,
  }));

  // Create a lookup table for column keys
  const columnKeyLookup: Dict<string> = {};
  columns.forEach((col) => {
    columnKeyLookup[col.header] = col.key;
  });

  // Map rows to the new column keys
  const rows = rawTableData.map((row) => {
    const parsedRow: TabularDataRowType = { __uid: uuidv4() };
    Object.keys(row).forEach((header) => {
      const rawValue = row[header];
      const value =
        typeof rawValue === "object" ? JSON.stringify(rawValue) : rawValue;
      parsedRow[columnKeyLookup[header]] = value?.toString() ?? "";
    });
    return parsedRow;
  });

  return { columns, rows };
}
