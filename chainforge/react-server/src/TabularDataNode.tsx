import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
} from "react";
import {
  Button,
  Flex,
  Menu,
  NumberInput,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import TanStackEditableTable from "./TanStackEditableTable";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import {
  IconX,
  IconArrowBarToUp,
  IconArrowBarToDown,
  IconArrowBarUp,
} from "@tabler/icons-react";
import TemplateHooks from "./TemplateHooksComponent";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { AlertModalContext } from "./AlertModal";
import RenameValueModal, { RenameValueModalRef } from "./RenameValueModal";
import useStore from "./store";
import { sampleRandomElements, transformDict } from "./backend/utils";
import {
  Dict,
  TabularDataRowType,
  TabularDataColType,
  StringOrHash,
  TemplateVarInfo,
} from "./backend/typing";
import { Handle, Position } from "reactflow";
import { AIGenReplaceTablePopover } from "./AiPopover";
import { parseTableData } from "./backend/tableUtils";
import { StringLookup } from "./backend/cache";
import { pulledInputsToTable, responsesToTable } from "./LLMResponseInspector";
import { generatePrompts, grabResponses } from "./backend/backend";

const defaultRows: TabularDataRowType[] = [
  {
    question: "What is 2+2?",
    answer: "4",
  },
  {
    question: "",
    answer: "",
  },
];

const defaultColumns: TabularDataColType[] = [
  {
    key: "question",
    header: "Question",
  },
  {
    key: "answer",
    header: "Expected",
  },
];

export interface TabularDataNodeData {
  title?: string;
  sample?: boolean;
  sampleNum?: number;
  rows?: TabularDataRowType[];
  columns?: TabularDataColType[];
}
export interface TabularDataNodeProps {
  data: TabularDataNodeData;
  id: string;
}

const TabularDataNode: React.FC<TabularDataNodeProps> = ({ data, id }) => {
  const [tableData, setTableData] = useState<TabularDataRowType[]>(
    data.rows ||
      [...defaultRows].map((row) => {
        return { __uid: uuidv4(), ...row };
      }),
  );
  const [tableColumns, setTableColumns] = useState<TabularDataColType[]>(
    data.columns ||
      [...defaultColumns].map((col) => {
        return { ...col };
      }),
  );
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const inputEdgesForNode = useStore((state) => state.inputEdgesForNode);

  const [contextMenuPos, setContextMenuPos] = useState({ left: -100, top: 0 });
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | undefined>(undefined);

  const [scrollToBottom, setScrollToBottom] = useState(false);

  // Whether to randomly sample N outputs, versus all outputs
  const [shouldSample, setShouldSample] = useState(data.sample ?? false);
  const [sampleNum, setSampleNum] = useState(data.sampleNum ?? 1);
  const handleChangeSampleNum = useCallback(
    (n: number) => {
      setSampleNum(n);
      setDataPropsForNode(id, { sampleNum: n });
    },
    [setSampleNum, id],
  );

  // Dynamically update the position of the template hooks
  const ref = useRef<HTMLDivElement | null>(null);
  const [hooksY, setHooksY] = useState(120);

  // For displaying error messages to user
  const showAlert = useContext(AlertModalContext);

  // For renaming a column
  const renameColumnModal = useRef<RenameValueModalRef>(null);
  const [renameColumnInitialVal, setRenameColumnInitialVal] = useState<
    TabularDataColType | string
  >("");

  const handleSaveCell = useCallback(
    (rowIdx: number, columnKey: string, value: string) => {
      pingOutputNodes(id);
      if (rowIdx === -1) {
        // Saving the column header
        setTableColumns(
          tableColumns.map((col) => {
            if (col.key === columnKey) col.header = value;
            return col;
          }),
        );
        return;
      }
      // console.log('handleSaveCell', rowIdx, columnKey, value);
      tableData[rowIdx][columnKey] = value;
      setTableData([...tableData]);
    },
    [tableData, tableColumns, pingOutputNodes],
  );

  // Adds a new row to the table
  const handleAddRow = useCallback(() => {
    // Creates a blank row with the same columns as the table
    const blank_row: TabularDataRowType = { __uid: uuidv4() };
    tableColumns.forEach((o) => {
      blank_row[o.key] = "";
    });

    // Adds the row to the table
    tableData.push(blank_row);
    setTableData([...tableData]);

    // Pings the effect handler to scroll down to the bottom of the table,
    // so the user can see the new row.
    setScrollToBottom(true);
  }, [tableColumns, tableData, ref]);

  // Inserts a column to left or right of existing one
  const handleInsertColumn = useCallback(
    (startColKey: string, dir: 1 | -1) => {
      // Create a unique ID to refer to this new column
      const uid = `col-${Date.now()}`;
      const new_col = {
        key: uid,
        header: "New Column", // default name
      };

      // Insert the new column into the columns array
      const startColIdx = tableColumns.findIndex(
        (elem) => elem.key === startColKey,
      );
      if (dir === -1) tableColumns.splice(startColIdx, 0, new_col);
      else if (dir === 1)
        tableColumns.splice(
          Math.min(startColIdx + 1, tableColumns.length),
          0,
          new_col,
        );

      // Set blank values at that column for each row of the table
      tableData.forEach((row) => {
        row[uid] = "";
      });

      // Update React state
      setTableColumns([...tableColumns]);
      setTableData([...tableData]);
    },
    [tableColumns, tableData],
  );

  // Removes a column
  const handleRemoveColumn = useCallback(
    (colKey: string) => {
      // Find the index of the column
      const colIdx = tableColumns.findIndex((elem) => elem.key === colKey);
      if (colIdx === -1) {
        console.error(
          `Could not find a column with key ${colKey} in the table.`,
        );
        return;
      }

      // Remove the column from the list
      tableColumns.splice(colIdx, 1);

      // Remove all data associated with that column from the table row data
      tableData.forEach((row) => {
        if (colKey in row) delete row[colKey];
      });

      setTableColumns([...tableColumns]);
      setTableData([...tableData]);
      pingOutputNodes(id);
    },
    [tableColumns, tableData, pingOutputNodes],
  );

  // Opens a modal popup to let user rename a column
  const openRenameColumnModal = useCallback(
    (col: TabularDataColType) => {
      setRenameColumnInitialVal(col);
      if (renameColumnModal && renameColumnModal.current)
        renameColumnModal.current.trigger();
    },
    [renameColumnModal],
  );

  const handleRenameColumn = useCallback(
    (new_header: string) => {
      if (typeof renameColumnInitialVal !== "object") {
        console.error("Initial column value was not set.");
        return;
      }
      const new_cols = tableColumns.map((c) => {
        if (c.key === renameColumnInitialVal.key) c.header = new_header;
        return c;
      });
      setTableColumns([...new_cols]);
      pingOutputNodes(id);
    },
    [tableColumns, renameColumnInitialVal, pingOutputNodes],
  );

  // Removes a row of the table, at <table> index 'selectedRow'
  const handleRemoveRow = useCallback(() => {
    if (!selectedRow) {
      console.warn("No row selected to remove.");
      return;
    }

    // Remove the select row
    tableData.splice(selectedRow - 1, 1);

    // Save state
    setTableData([...tableData]);
  }, [tableData, selectedRow]);

  // Removes a row of the table, at <table> index 'selectedRow'
  const handleInsertRow = useCallback(
    (offset: 0 | -1) => {
      if (!selectedRow) {
        console.warn("No row selected to insert from.");
        return;
      }

      const insertIdx = selectedRow + offset;

      // Creates a blank row with the same columns as the table
      const blank_row: TabularDataRowType = { __uid: uuidv4() };
      tableColumns.forEach((o) => {
        blank_row[o.key] = "";
      });

      // Adds the row to the table at the requested position
      const new_rows = tableData
        .slice(0, insertIdx)
        .concat([blank_row], tableData.slice(insertIdx));

      // Save state
      setTableData([...new_rows]);
    },
    [tableData, tableColumns, selectedRow],
  );

  // Import list of JSON data to the table
  // NOTE: JSON objects should be in row format, with keys
  //       as the header names. The internal keys of the columns will use uids to be unique.
  const importJSONList = (jsonl: unknown) => {
    const { columns, rows } = parseTableData(jsonl as any[]);
    setTableColumns(columns);
    setTableData(rows);
    pingOutputNodes(id);
  };

  // Import tabular data from a file
  // NOTE: Assumes first row of table is a header
  const openImportFileModal = async () => {
    // Create an input element with type "file" and accept only JSON files
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json, .jsonl, .xlsx, .xls, .csv";

    const parseJSONL = (txt: string) => {
      return txt
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    };

    // Handle file selection
    input.addEventListener("change", function (event: Event) {
      const target = event.target as HTMLInputElement;
      const file = target.files ? target.files[0] : null;
      const reader = new window.FileReader();

      if (!file) {
        console.error("Could not load tabular data file. Unknown error.");
        return;
      }

      // Extract the file extension from the file name
      const extension = file.name.split(".").pop();

      // Handle file load event
      reader.addEventListener("load", function () {
        try {
          if (reader.result === null)
            throw new Error(
              "Could not load tabular data file into file reader. Unknown error.",
            );

          // Try to parse the file using the appropriate file reader
          let jsonl = null;
          switch (extension) {
            case "jsonl":
              // Should be a newline-separated list of JSON objects, e.g. {}\n{}\n{}
              // Split the result on newlines and JSON parse individual lines:
              jsonl = parseJSONL(reader.result as string);
              // Load the JSON list into the table
              importJSONList(jsonl);
              break;

            case "json":
              // Should be a list of JSON objects, e.g. in format [{...}]
              try {
                jsonl = JSON.parse(reader.result as string);
              } catch (error) {
                // Just in case, try to parse it as a JSONL file instead...
                jsonl = parseJSONL(reader.result as string);
              }
              importJSONList(jsonl);
              break;

            case "xlsx":
              // Parse data using XLSX
              {
                const wb = XLSX.read(reader.result, { type: "array" });
                // Extract the first worksheet
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                // Convert to JSON list format, assuming the first row is a 'header':
                jsonl = XLSX.utils.sheet_to_json(ws);
                // Load the JSON list into the table
                importJSONList(jsonl);
              }
              break;

            case "csv":
              // Parse the CSV string to a list,
              // assuming the first row is a header
              {
                const papa_parsed = Papa.parse(reader.result as string, {
                  header: true,
                });
                importJSONList(papa_parsed.data);
              }
              break;

            default:
              throw new Error(`Unknown file extension: ${extension}`);
          }
        } catch (error) {
          handleError(error as Error);
        }
      });

      // Read the selected file using the appropriate reader
      if (extension === "xlsx" || extension === "xls")
        reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    });

    // Trigger the file selector
    input.click();
  };

  // Scrolls to bottom of the table when scrollToBottom toggle is true
  useEffect(() => {
    if (scrollToBottom) {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
      setScrollToBottom(false);
    }
  }, [scrollToBottom]);

  // Updates the internal data store whenever the table data changes
  useEffect(() => {
    let sel_rows: TabularDataRowType[] | null = null;

    // Check for sampling
    if (shouldSample && sampleNum !== undefined) {
      // If sampling is enabled, randomly choose only sampleNum rows:
      sel_rows = sampleRandomElements(tableData, sampleNum);
    }

    setDataPropsForNode(id, {
      rows: tableData,
      columns: tableColumns,
      sel_rows,
    });
  }, [tableData, tableColumns, shouldSample, sampleNum]);

  const handleError = (err: Error) => {
    if (showAlert) showAlert(err.message);
    console.error(err.message);
  };

  // To listen for resize events of the table container, we need to use a ResizeObserver.
  // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div container.
  const setRef = useCallback(
    (elem: HTMLDivElement) => {
      if (!ref.current && elem && window.ResizeObserver) {
        let past_hooks_y = 120;
        const observer = new window.ResizeObserver(() => {
          if (!ref || !ref.current) return;
          const new_hooks_y = ref.current.clientHeight + 68;
          if (past_hooks_y !== new_hooks_y) {
            setHooksY(new_hooks_y);
            past_hooks_y = new_hooks_y;
          }
        });

        observer.observe(elem);
        ref.current = elem;
      }
    },
    [ref],
  );

  const [isLoading, setIsLoading] = useState(false);

  // Function to add new columns to the right of the existing columns (with optional row values)
  const addColumns = (
    newColumns: TabularDataColType[],
    rowValues?: string[], // If values are passed, they will be used to populate the new columns
  ) => {
    setTableColumns((prevColumns) => {
      // Filter out columns that already exist
      const filteredNewColumns = newColumns.filter(
        (col) =>
          !prevColumns.some((existingCol) => existingCol.key === col.key),
      );

      // If no genuinely new columns, return previous columns
      if (filteredNewColumns.length === 0) return prevColumns;

      const updatedColumns = [...prevColumns, ...filteredNewColumns];

      setTableData((prevData) => {
        let updatedRows: TabularDataRowType[] = [];

        if (prevData.length > 0) {
          // Update the existing rows with the new column values
          updatedRows = prevData.map((row, rowIndex) => {
            const updatedRow = { ...row };

            // Set the value for each new column
            filteredNewColumns.forEach((col) => {
              // Only set the value if it's not already set
              if (updatedRow[col.key] === undefined) {
                updatedRow[col.key] =
                  rowValues && rowValues[rowIndex] !== undefined
                    ? rowValues[rowIndex]
                    : "";
              }
            });
            return updatedRow;
          });
        } else if (rowValues && rowValues.length > 0) {
          // If no rows exist, create rows using rowValues
          updatedRows = rowValues.map((value) => {
            const newRow: TabularDataRowType = { __uid: uuidv4() };
            filteredNewColumns.forEach((col) => {
              newRow[col.key] = value || "";
            });
            return newRow;
          });
        } else {
          // If no rows and no rowValues, create a single blank row
          const blankRow: TabularDataRowType = { __uid: uuidv4() };
          filteredNewColumns.forEach((col) => {
            blankRow[col.key] = "";
          });
          updatedRows.push(blankRow);
        }

        return updatedRows; // Update table rows
      });

      return updatedColumns; // Update table columns
    });
  };

  // Function to add multiple rows to the table
  const addMultipleRows = (newRows: TabularDataRowType[]) => {
    setTableData((prev) => {
      // Remove the last row of the current table data as it is a blank row (if table is not empty)
      let newTableData = prev;
      if (prev.length > 0) {
        const lastRow = prev[prev.length - 1]; // Get the last row
        const emptyLastRow = Object.values(lastRow).every((val) => !val); // Check if the last row is empty
        if (emptyLastRow) newTableData = prev.slice(0, -1); // Remove the last row if it is empty
      }

      // Add the new rows to the table
      const addedRows = newRows.map((value) => {
        const newRow: TabularDataRowType = { __uid: uuidv4() };

        // Map to correct column keys
        tableColumns.forEach((col, index) => {
          newRow[col.key] = value[`col-${index}`] || ""; // If (false, empty, null, etc...), default to empty string
        });

        return newRow;
      });

      // Return the updated table data with the new rows
      return [...newTableData, ...addedRows];
    });
  };

  // Function to replace the entire table (columns and rows)
  const replaceTable = (
    columns: TabularDataColType[],
    rows: TabularDataRowType[],
  ) => {
    // Validate columns
    if (!Array.isArray(columns) || columns.length === 0) {
      console.error("Invalid columns provided for table replacement.");
      return;
    }

    // Validate rows
    if (!Array.isArray(rows)) {
      console.error("Invalid rows provided for table replacement.");
      return;
    }

    // Replace columns
    const updatedColumns = columns.map((col, idx) => ({
      header: col.header,
      key: col.key || `c${idx}`, // Ensure each column has a uid
    }));

    // Replace rows
    const updatedRows = rows.map((row) => {
      const newRow: TabularDataRowType = { __uid: uuidv4() };

      updatedColumns.forEach((column) => {
        // Map row data to columns, default to empty strings for missing values
        newRow[column.key] = row[column.key] || "";
      });
      return newRow;
    });

    setTableColumns(updatedColumns); // Replace table columns
    setTableData(updatedRows); // Replace table rows
  };

  // Handler for inserting rows (compatible with TanStackEditableTable)
  const handleInsertRowAtIndex = useCallback(
    (rowIndex: number, offset: 0 | -1) => {
      const insertIdx = rowIndex + offset + 1; // Adjust for 0-based indexing

      // Creates a blank row with the same columns as the table
      const blank_row: TabularDataRowType = { __uid: uuidv4() };
      tableColumns.forEach((o) => {
        blank_row[o.key] = "";
      });

      // Adds the row to the table at the requested position
      const new_rows = tableData
        .slice(0, insertIdx)
        .concat([blank_row], tableData.slice(insertIdx));

      // Save state
      setTableData([...new_rows]);
      pingOutputNodes(id);
    },
    [tableData, tableColumns, pingOutputNodes, id],
  );

  // Handler for removing rows by index (compatible with TanStackEditableTable)
  const handleRemoveRowAtIndex = useCallback(
    (rowIndex: number) => {
      if (rowIndex < 0 || rowIndex >= tableData.length) {
        console.warn("Invalid row index for removal.");
        return;
      }

      // Remove the selected row
      const newTableData = tableData.filter((_, index) => index !== rowIndex);

      // Save state
      setTableData([...newTableData]);
      pingOutputNodes(id);
    },
    [tableData, pingOutputNodes, id],
  );

  // Handler for clearing the entire dataset
  const handleClearDataset = useCallback(() => {
    // Reset to default state with default columns and one empty row
    const resetColumns = [...defaultColumns].map((col) => ({ ...col }));
    const blank_row: TabularDataRowType = { __uid: uuidv4() };
    resetColumns.forEach((col) => {
      blank_row[col.key] = "";
    });

    setTableColumns(resetColumns);
    setTableData([blank_row]);
    pingOutputNodes(id);
  }, [pingOutputNodes, id]);

  // Pulls data from input nodes into the table
  const pullInputData = useStore((state) => state.pullInputData);
  const handlePullDataIn = async () => {
    try {
      // There are two ways in CF to pull data, unfortunately:
      // pulling via "input data", which includes things like text fields, and
      // pulling via "nodes", which fetches the cache'd LLM outputs from another node.
      // We need to consider both since we don't know what nodes the user will attach.
      const pulled_data = pullInputData(["load-data"], id);

      // Ensure pulled_data has the expected structure
      if (!pulled_data || !pulled_data["load-data"]) {
        console.warn("No load-data found in pulled data");
        return;
      }

      // Ensure load-data is an array
      if (!Array.isArray(pulled_data["load-data"])) {
        console.warn("load-data is not an array:", pulled_data["load-data"]);
        return;
      }

      if (Object.keys(pulled_data).length > 1) {
        // If there's more than one key pulled, this likely means
        // we are pulling prompt templates from the input nodes.
        const other_vars = transformDict(pulled_data, (k) => k !== "load-data");
        pulled_data["load-data"] = (
          await Promise.all(
            pulled_data["load-data"].map(async (info) => {
              try {
                // Skip LLM responses
                if (typeof info !== "string" && info.llm !== undefined)
                  return info;
                // Get the text version of the info object
                const text =
                  typeof info === "string" ? info : StringLookup.get(info.text);
                if (!text) return info;
                // Generate the prompts for the text
                const texts = await generatePrompts(text, other_vars);
                return texts.map(
                  (t) =>
                    ({
                      text: t.toString(),
                      fill_history: {
                        ...t.fill_history,
                        Input: text,
                      },
                      metavars: t.metavars,
                    }) as TemplateVarInfo,
                );
              } catch (error) {
                console.warn("Error processing info item:", error);
                return info; // Return original item on error
              }
            }),
          )
        ).flat() as TemplateVarInfo[];
      }

      // Grab the input node ids
      // Get the ids from the connected input nodes:
      const input_node_ids = inputEdgesForNode(id).map((e) => e.source);
      const resps =
        input_node_ids.length > 0
          ? await grabResponses(input_node_ids).catch((error) => {
              console.warn("Error grabbing responses:", error);
              return [];
            })
          : [];

      const pulled_data_table = pulledInputsToTable(
        pulled_data["load-data"] || [],
      );
      const pulled_resps_table = await responsesToTable(resps ?? []);

      // Ensure both are arrays
      if (!Array.isArray(pulled_data_table)) {
        console.warn("pulled_data_table is not an array:", pulled_data_table);
        return;
      }

      if (!Array.isArray(pulled_resps_table)) {
        console.warn("pulled_resps_table is not an array:", pulled_resps_table);
        return;
      }

      const col_names = new Set<string>();

      // Safe iteration over pulled_data_table
      pulled_data_table.forEach((row) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((key) => col_names.add(key));
        }
      });

      // Safe iteration over pulled_resps_table
      pulled_resps_table.forEach((row) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((key) => col_names.add(key));
        }
      });

      const new_table_columns = Array.from(col_names).map((col) => ({
        key: col,
        header: col,
      }));

      // Merge the tables, removing duplicates
      const uids_in_table = new Set<string>();
      pulled_resps_table.forEach((row) => {
        if (row && typeof row === "object") {
          if (typeof row["Batch Id"] === "string")
            uids_in_table.add(row["Batch Id"]);
          // ...also convert boolean values to strings, while we're at it
          Object.keys(row).forEach((key) => {
            if (typeof row[key] === "boolean") {
              row[key] = row[key].toString();
            }
          });
        }
      });

      const dedup_pulled_data_table = pulled_data_table.filter((row) => {
        if (!row || typeof row !== "object") return false;
        return (
          !(typeof row["Batch Id"] === "string") ||
          !uids_in_table.has(row["Batch Id"])
        );
      });

      const new_table = [
        ...dedup_pulled_data_table,
        ...pulled_resps_table,
      ] as Dict<StringOrHash>[];

      // Remove 'Batch Id's from the table, if it exists
      // NOTE: We do this since the Batch Ids are likely not useful for the user.
      new_table.forEach((row) => {
        if (
          row &&
          typeof row === "object" &&
          typeof row["Batch Id"] === "string"
        ) {
          delete row["Batch Id"];
        }
      });

      const col_batch_id_idx = new_table_columns.findIndex(
        (col) => col.key === "Batch Id",
      );
      if (col_batch_id_idx !== -1) {
        new_table_columns.splice(col_batch_id_idx, 1);
      }

      // Only replace table if we have valid data
      if (new_table_columns.length > 0) {
        replaceTable(new_table_columns, new_table);
      } else {
        console.warn("No valid columns found in pulled data");
        if (showAlert) {
          showAlert(
            "No valid data found to load. Please check your connected nodes.",
          );
        }
      }
    } catch (error) {
      console.error("Error in handlePullDataIn:", error);
      if (showAlert) {
        showAlert(
          `Error loading data: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  };

  return (
    <BaseNode
      classNames="tabular-data-node"
      nodeId={id}
      // @ts-expect-error onPointerDown does exist here, on the base element, though TypeScript is not catching this.
      onPointerDown={() => setContextMenuOpened(false)}
    >
      <NodeLabel
        title={data.title || "Tabular Data Node"}
        nodeId={id}
        icon={"🗂️"}
        customButtons={[
          <AIGenReplaceTablePopover
            key="ai-popover"
            values={tableData}
            colValues={tableColumns}
            onAddRows={addMultipleRows}
            onAddColumns={addColumns}
            onReplaceTable={replaceTable}
            areValuesLoading={isLoading}
            setValuesLoading={setIsLoading}
          />,
          <Tooltip
            key={0}
            label="Accepts xlsx, jsonl, and csv files with a header row"
          >
            <button
              className="custom-button"
              key="import-data"
              onClick={openImportFileModal}
            >
              Import data
            </button>
          </Tooltip>,
        ]}
      />
      <RenameValueModal
        ref={renameColumnModal}
        initialValue={
          typeof renameColumnInitialVal === "object"
            ? renameColumnInitialVal.header
            : ""
        }
        title="Rename column"
        label="New column name"
        onSubmit={handleRenameColumn}
      />

      <Menu
        opened={contextMenuOpened}
        withinPortal={true}
        onChange={setContextMenuOpened}
        styles={{
          dropdown: {
            position: "absolute",
            left: contextMenuPos.left + "px !important",
            top: contextMenuPos.top + "px !important",
            boxShadow: "2px 2px 4px #ccc",
          },
        }}
      >
        <Menu.Dropdown>
          <Menu.Item onClick={() => handleInsertRow(-1)}>
            <IconArrowBarToUp size="10pt" /> Insert Row Above
          </Menu.Item>
          <Menu.Item onClick={() => handleInsertRow(0)}>
            <IconArrowBarToDown size="10pt" /> Insert Row Below
          </Menu.Item>
          <Menu.Item onClick={handleRemoveRow}>
            <IconX size="8pt" /> Delete row
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <div
        ref={setRef}
        className="tabular-data-container nowheel nodrag"
        onPointerDown={() => setContextMenuOpened(false)}
      >
        <TanStackEditableTable
          rows={tableData}
          columns={tableColumns}
          handleSaveCell={handleSaveCell}
          handleRemoveColumn={handleRemoveColumn}
          handleInsertColumn={handleInsertColumn}
          handleRenameColumn={openRenameColumnModal}
          handleAddRow={handleAddRow}
          handleInsertRow={handleInsertRowAtIndex}
          handleRemoveRow={handleRemoveRowAtIndex}
          handleClearDataset={handleClearDataset}
        />
      </div>

      <div className="tabular-data-footer">
        <TemplateHooks
          vars={tableColumns.map((col) => col.header)}
          nodeId={id}
          startY={hooksY}
          position={Position.Right}
          ignoreHandles={["load-data"]}
        />

        <div
          className="hook-tag"
          style={{ display: "flex", justifyContent: Position.Left }}
        >
          <Tooltip
            label="Pulls input data into table. Attach input(s), and click to load. Will replace table values."
            multiline
            w="220px"
            withArrow
            withinPortal
          >
            <Button
              onClick={handlePullDataIn}
              color="green"
              variant="light"
              size="xs"
              h="20px"
              pl="xs"
              pr="xs"
              radius="sm"
              tt="none"
              pos="absolute"
              top={hooksY - 9 + "px"}
            >
              <Flex gap="4px" align="center">
                <Text>Load into</Text>
                <IconArrowBarUp size="12pt" />
              </Flex>
            </Button>
          </Tooltip>
          <Handle
            type="target"
            id="load-data"
            position={Position.Left}
            style={{ top: hooksY + "px", background: "#555" }}
          />
        </div>

        <Switch
          label={
            <Tooltip label="Toggle Random Sampling" position="bottom" withArrow>
              <Text color={shouldSample ? "indigo" : "gray"}>Sample</Text>
            </Tooltip>
          }
          defaultChecked={true}
          checked={shouldSample}
          onChange={(event) => {
            setShouldSample(event.currentTarget.checked);
            setDataPropsForNode(id, { sample: event.currentTarget.checked });
          }}
          color="indigo"
          size="xs"
          mt={shouldSample && tableColumns.length >= 2 ? "-50px" : "0px"}
        />
        {shouldSample ? (
          <Tooltip
            label="Number of table rows to sample. Outputs will only draw from this many rows."
            width={200}
            position="left"
            withArrow
            multiline
          >
            <NumberInput
              size="xs"
              mt="6px"
              maw="100px"
              value={sampleNum}
              onChange={handleChangeSampleNum}
              min={1}
            />
          </Tooltip>
        ) : (
          <></>
        )}
      </div>
    </BaseNode>
  );
};

export default TabularDataNode;
