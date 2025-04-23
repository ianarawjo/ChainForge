import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useDisclosure } from "@mantine/hooks";
import {
  Text,
  Tooltip,
  Group,
  ActionIcon,
  Box,
  Image,
  Modal,
  Button,
  Code,
} from "@mantine/core";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import {
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle,
  IconPlus,
  IconPencil,
} from "@tabler/icons-react";
import TemplateHooks from "./TemplateHooksComponent";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { AlertModalContext } from "./AlertModal";
import RenameValueModal, { RenameValueModalRef } from "./RenameValueModal";
import useStore from "./store";
import { sampleRandomElements, __http_url_to_base64 } from "./backend/utils";
import {
  Dict,
  TabularDataRowType,
  TabularDataColType,
  LLMResponse,
} from "./backend/typing";
import { Position } from "reactflow";
import { parseTableData } from "./backend/tableUtils";
import UploadFileModal, { UploadFileModalRef } from "./UploadFileModal";
import ImagePreviewModal, { ImagePreviewModalRef } from "./ImagePreviewModal";
import InspectFooter from "./InspectFooter";
import LLMResponseInspectorModal, {
  LLMResponseInspectorModalRef,
} from "./LLMResponseInspectorModal";
import LLMResponseInspectorDrawer from "./LLMResponseInspectorDrawer";

const defaultRows: TabularDataRowType = {
  question: "Prompt Question",
  answer: "Expected Answer",
};

const defaultColumns: TabularDataColType[] = [
  {
    key: "question",
    header: "Question",
  },
  {
    key: "answer",
    header: "Answer",
  },
];

const __construct_items_in_json_responses = (
  tableData: TabularDataRowType[],
  tableColumns: TabularDataColType[],
) => {
  const items_in_json_responses: Promise<LLMResponse[]> = Promise.all(
    tableData.map(async (row) => {
      const item: LLMResponse = {
        responses: [
          {
            t: "img",
            d: String(row.image).startsWith("http")
              ? // if the image is a URL, convert it to base64, get the string from the response
                await __http_url_to_base64(String(row.image))
              : String(row.image).split("base64,")[1],
          },
        ],
        uid: String(row.__uid),
        prompt: "prompt",
        vars: tableColumns.reduce(
          (acc, col) => {
            if (col.key !== "image") acc[col.header] = row[col.key];
            return acc;
          },
          {} as Record<string, any>,
        ),
        llm: "image_preview",
        metavars: {
          LLM_0: "image_preview",
          __pt:
            "{" +
            tableColumns
              .map((dic) => dic.header)
              .filter((e) => e !== "Image")
              .join("}\n{") +
            "}",
        },
      };
      return item;
    }),
  );
  return items_in_json_responses;
};

export interface MultimediaNodeData {
  title?: string;
  sample?: boolean;
  sampleNum?: number;
  rows?: TabularDataRowType[];
  columns?: TabularDataColType[];
}
export interface MultimediaNodeDataProps {
  data: MultimediaNodeData;
  id: string;
}

export const IMAGE_COLUMN_NAME = "Image";
const MultimediaNode: React.FC<MultimediaNodeDataProps> = ({ data, id }) => {
  const [tableData, setTableData] = useState<TabularDataRowType[]>(
    data.rows || [],
  );
  const [tableColumns, setTableColumns] = useState<TabularDataColType[]>(
    data.columns || [],
  );
  const [metadataRows, setMetadataRows] = useState<
    Record<string, Dict<string>>
  >({}); // New state for metadata

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);

  const [currentRowIndex, setCurrentRowIndex] = useState(0);

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
      // Update the specific row in the table data
      const updatedTableData = [...tableData];
      updatedTableData[rowIdx] = {
        ...updatedTableData[rowIdx],
        [columnKey]: value,
      };
      setTableData(updatedTableData);
    },
    [tableData, tableColumns, pingOutputNodes],
  );

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

  // Import list of JSON data to the table
  // NOTE: JSON objects should be in row format, with keys
  //       as the header names. The internal keys of the columns will use uids to be unique.
  const importJSONList = (jsonl: Array<Dict>) => {
    // I noticed for some .tsv files, sometimes the last row is empty
    // so if the last element is empty `{index: "",}`  , remove it
    const lastRow = jsonl[jsonl.length - 1];
    if (
      lastRow.length !== Object.keys(jsonl[0]).length ||
      Object.values(lastRow).every((v) => v === "")
    ) {
      jsonl.pop();
    }

    const { columns, rows } = parseTableData(jsonl as any[]);

    // find the image key
    const image_col = columns.find((col) => col.header === "image");
    if (!image_col) {
      throw new Error("No image column found in the data");
    }

    // Set the new columns,
    // and verify that if the image column is present in the state tableColumns, we dont add it again
    // otherwise add it as { key: "image", header: "Image" }
    const imageColumnExists = tableColumns.some((col) => col.key === "image");
    const colIdx = columns.findIndex((elem) => elem.header === "image");
    const imageColumnKey = columns[colIdx].key;
    if (!imageColumnExists) {
      columns[colIdx] = {
        header: IMAGE_COLUMN_NAME,
        key: "image",
      };
    } else {
      // Remove the image column from the columns array
      if (colIdx !== -1) {
        columns.splice(colIdx, 1);
      }
    }
    // Add the new columns to the table
    const new_columns = columns.map((col) => {
      const colExists = tableColumns.some((c) => c.key === col.key);
      if (!colExists) {
        return {
          ...col,
          header: col.header || "New Column",
        };
      }
      return col;
    });
    setTableColumns([...tableColumns, ...new_columns]);

    // Set the new rows and
    // for the field holding data image as "image"
    const new_rows = rows.map((row) => {
      // Rename the key of the image column to "image"
      const new_row: TabularDataRowType = {
        image: `data:image/jpeg;base64,${row[imageColumnKey]}`,
      };
      new_columns.forEach((col) => {
        if (col.key !== columns[colIdx].key) {
          new_row[col.key] = row[col.key];
        }
      });
      // Add a unique ID to each row
      if (!new_row.__uid) {
        new_row.__uid = uuidv4();
      }
      return new_row;
    });

    // Update metadata for imported rows
    const newMetadata = { ...metadataRows };
    new_rows.forEach((row) => {
      newMetadata[row.__uid] = { source: ".tsv import" };
    });
    setMetadataRows(newMetadata);

    setTableData([...tableData, ...new_rows]);
    setCurrentRowIndex(new_rows.length - 1);
    setDataPropsForNode(id, {
      rows: [...tableData, ...new_rows],
      columns: [...tableColumns, ...new_columns],
      sel_rows: null,
    });
    pingOutputNodes(id);
  };

  // Import tabular data from a file
  // NOTE: Assumes first row of table is a header
  const openImportFileModal = async () => {
    // Create an input element with type "file" and accept only JSON files
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".tsv";
    // Handle file selection
    input.addEventListener("change", function (event: Event) {
      const target = event.target as HTMLInputElement;
      const file = target.files ? target.files[0] : null;
      const reader = new window.FileReader();

      if (!file) {
        console.error("Could not load tabular data file. Unknown error.");
        return;
      }

      // Handle file load event
      reader.addEventListener("load", function () {
        try {
          if (reader.result === null)
            throw new Error(
              "Could not load tabular data file into file reader. Unknown error.",
            );

          const papa_parsed = Papa.parse(reader.result as string, {
            header: true,
          });

          // Verify that the we at least have the following headers:
          // - image, question, answer
          const requiredHeaders = ["image", "question", "answer"];
          const missingHeaders = requiredHeaders.filter((header) => {
            const firstRow = papa_parsed.data[0] as Record<string, unknown>;
            return Object.keys(firstRow).indexOf(header) === -1;
          });
          if (missingHeaders.length > 0) {
            throw new Error(
              `Missing required headers: ${missingHeaders.join(", ")}`,
            );
          }

          importJSONList(papa_parsed.data as Dict<any>[]);
        } catch (error) {
          handleError(error as Error);
        }
      });

      reader.readAsText(file);
    });

    // Trigger the file selector
    input.click();
  };

  // Scrolls to bottom of the table when scrollToBottom toggle is true
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, []);

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
  }, [
    tableData,
    tableColumns,
    shouldSample,
    sampleNum,
    currentRowIndex,
    id,
    setDataPropsForNode,
  ]);

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
          const new_hooks_y = ref.current.clientHeight + 342;
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

  const handleNextRow = useCallback(() => {
    if (tableData.length <= 1) return;
    const newIndex = (currentRowIndex + 1) % tableData.length;
    setCurrentRowIndex(newIndex);
  }, [currentRowIndex, tableData.length]);

  const handlePrevRow = useCallback(() => {
    if (tableData.length <= 1) return;
    const newIndex =
      (currentRowIndex - 1 + tableData.length) % tableData.length;
    setCurrentRowIndex(newIndex);
  }, [currentRowIndex, tableData.length]);

  const uploadFileModal = useRef<UploadFileModalRef>(null);

  const handleUploadFile = useCallback(
    (
      url: string,
      newRow: TabularDataRowType = defaultRows,
      newColumns: TabularDataColType[] = defaultColumns,
    ) => {
      // Ensure the image column exists
      const imageColumnKey = "image";
      const imageColumnExists = tableColumns.some(
        (col) => col.key === imageColumnKey,
      );

      const columns_to_add = [];

      // Add image column if it doesn't exist
      if (!imageColumnExists) {
        const imageColumn: TabularDataColType = {
          key: imageColumnKey,
          header: IMAGE_COLUMN_NAME,
        };
        columns_to_add.push(imageColumn);
      }

      // Only add new columns if there are no existing columns
      if (tableColumns.length === 0) {
        columns_to_add.push(...newColumns);
        setTableColumns([...tableColumns, ...columns_to_add]);
      }

      // Create new row with image URL and ensure it has a unique ID
      const rowWithImage: TabularDataRowType = {
        ...newRow,
        [imageColumnKey]: url,
        __uid: newRow.__uid || uuidv4(),
      };

      // Update table data
      const updatedTableData = [...tableData, rowWithImage];
      setTableData(updatedTableData);
      setCurrentRowIndex(updatedTableData.length - 1);

      // Update metadata for the new row
      const newMetadata = {
        ...metadataRows,
        [rowWithImage.__uid]: {
          source: url.startsWith("http")
            ? "Remote image"
            : "Local file Uploaded",
        },
      };
      setMetadataRows(newMetadata);

      // Update store with new data
      const selectedRows =
        shouldSample && sampleNum !== undefined
          ? sampleRandomElements(updatedTableData, sampleNum)
          : null;

      setDataPropsForNode(id, {
        rows: updatedTableData,
        columns: tableColumns,
        sel_rows: selectedRows,
      });
    },
    [
      tableColumns,
      tableData,
      shouldSample,
      sampleNum,
      id,
      setDataPropsForNode,
      metadataRows,
    ],
  );

  const handleOpenUploadModal = useCallback(() => {
    if (uploadFileModal.current) {
      uploadFileModal.current.open();
      // Remove the ref when opening upload modal
      if (ref.current) {
        ref.current = null;
      }
    }
  }, [ref]);

  const imagePreviewModal = useRef<ImagePreviewModalRef>(null);

  const handleImageClick = useCallback(() => {
    const currentRow = tableData[currentRowIndex];
    const imageUrl = currentRow.image;
    const metadata = metadataRows[currentRow.__uid];
    if (imagePreviewModal.current && typeof imageUrl === "string") {
      imagePreviewModal.current.trigger(imageUrl, metadata);
    }
  }, [tableData, currentRowIndex, metadataRows]);

  // Relative to the info Button
  const default_header = useMemo(() => {
    return "Info about Imported File Format";
  }, []);

  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] =
    useDisclosure(false);

  // TODO : ADD TO THE INFO MESSAGE BELOW
  //  THE GENERAL USAGE OF THE NODE AND
  //      DONT FORGET TO SAY THAT THE CORRESPONDING {image} TEMPLATE VARS IN THE PromptNode
  //      must be surrounded by line breaks
  const node_info_modal = useMemo(() => {
    return (
      <Box m="lg" mt="xl">
        <Text mb="sm">
          To have more details about the .tsv file format, visit{" "}
          <a
            href="https://github.com/open-compass/VLMEvalKit/blob/main/docs/en/Development.md#1-prepare-your-benchmark-tsv-file"
            target="_blank"
            rel="noreferrer"
          >
            this link
          </a>
        </Text>
        <Text mt="sm" mb="sm">
          Summary of the mandatory fields in the TSV file:
        </Text>
        <Text mt="sm" mb="sm">
          <Code>- index</Code>: Integer, Unique for each line in tsv
        </Text>
        <Text mt="sm" mb="sm">
          <Code>- image</Code>: The base64 of the image. See examples of APIs
          implemented in{" "}
          <a
            href="https://github.com/open-compass/VLMEvalKit/blob/c57f96566c4c1d62dd9bf4b4319a450ce81e4f53/vlmeval/smp/vlm.py#L92-L126"
            target="_blank"
            rel="noreferrer"
          >
            vlmeval/smp/vlm.py
          </a>{" "}
          for encoding and decoding.
        </Text>
        <Text mt="sm" mb="sm">
          <Code>- question</Code>: The question corresponding to the image, a
          string
        </Text>
        <Text mt="sm" mb="sm">
          <Code>- answer</Code>: The answer to the question, a string.
        </Text>
      </Box>
    );
  }, [default_header]);

  // -------------------- Everything about the Inspect Items thing
  const inspectModal = useRef<LLMResponseInspectorModalRef>(null);

  const [jsonResponses, setJSONResponses] = useState<LLMResponse[] | null>(
    null,
  );

  const [showDrawer, setShowDrawer] = useState(false);

  const showResponseInspector = useCallback(() => {
    const items_in_json_responses = __construct_items_in_json_responses(
      tableData,
      tableColumns,
    );
    items_in_json_responses
      .then((resolvedResponses) => {
        setJSONResponses(resolvedResponses);
      })
      .catch((error) => {
        console.error("Error resolving JSON responses:", error);
      });
    if (inspectModal && inspectModal.current && jsonResponses) {
      inspectModal.current?.trigger();
    }
  }, [inspectModal, jsonResponses]);

  return (
    <BaseNode classNames="tabular-data-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Multimedia Node"}
        nodeId={id}
        icon={"📺"}
        customButtons={[
          <Tooltip label="Info" key="eval-info">
            <button
              onClick={openInfoModal}
              className="custom-button"
              style={{ border: "none" }}
            >
              <IconInfoCircle
                size="12pt"
                color="gray"
                style={{ marginBottom: "-4px" }}
              />
            </button>
          </Tooltip>,
          <Tooltip key={0} label="Click on the info button to learn more.">
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
      <Modal
        title={default_header}
        size="60%"
        opened={infoModalOpened}
        onClose={closeInfoModal}
        styles={{
          header: { backgroundColor: "#FFD700" },
          root: { position: "relative", left: "-5%" },
        }}
      >
        {node_info_modal}
      </Modal>
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

      <ImagePreviewModal ref={imagePreviewModal} />
      <UploadFileModal
        ref={uploadFileModal}
        title="Upload Image"
        label="Provide a URL pointing to an image"
        onSubmit={handleUploadFile}
      />

      {tableData.length > 0 &&
        tableData[currentRowIndex].image &&
        typeof tableData[currentRowIndex].image === "string" && (
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              padding: "8px",
              backgroundColor: "#fff",
              width: "250px",
              margin: "0 auto",
              marginTop: "10px",
            }}
          >
            <div onClick={handleImageClick} style={{ cursor: "pointer" }}>
              <Tooltip label="Click me for more details">
                <Image
                  src={tableData[currentRowIndex].image as string}
                  height={200}
                  width={200}
                  fit="contain"
                  withPlaceholder
                  style={{
                    backgroundColor: "#f8f9fa",
                    margin: "0 auto",
                  }}
                />
              </Tooltip>
            </div>
          </div>
        )}

      <div className="carousel-row-display" style={{ marginTop: "20px" }}>
        {tableData.length > 0 && (
          <div
            ref={setRef}
            className="tabular-data-container nowheel nodrag"
            style={{
              minHeight: "220px",
              minWidth: "220px",
              height: "220px",
              overflowY: "auto",
              border: "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {tableColumns
              .filter((col) => col.key !== "image")
              .map((col) => (
                <div
                  key={col.key}
                  style={{ display: "flex", flexDirection: "column" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <Text size="sm" weight={500}>
                      {col.header}
                    </Text>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={() => openRenameColumnModal(col)}
                      style={{ color: "#666" }}
                    >
                      <IconPencil size={12} />
                    </ActionIcon>
                    {tableColumns.filter((col) => col.key !== "image").length >
                      1 && (
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={() => handleRemoveColumn(col.key)}
                        style={{ color: "#666" }}
                      >
                        <IconX size={12} />
                      </ActionIcon>
                    )}
                  </div>
                  <textarea
                    value={tableData[currentRowIndex]?.[col.key] || ""}
                    onChange={(e) =>
                      handleSaveCell(currentRowIndex, col.key, e.target.value)
                    }
                    style={{
                      padding: "8px",
                      border: "1px solid #e0e0e0",
                      borderRadius: "4px",
                      minHeight: "60px",
                      resize: "vertical",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  />
                </div>
              ))}
          </div>
        )}
        {tableData.length === 0 && (
          <div
            ref={setRef}
            className="tabular-data-container nowheel nodrag"
            style={{
              minHeight: "220px",
              minWidth: "220px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                height: 200,
                width: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f8f9fa",
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
                margin: "0 auto",
              }}
            >
              <Text color="dimmed">No Media Uploaded</Text>
            </Box>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "10px",
          }}
        >
          {tableData.length > 0 && (
            <Button
              variant="subtle"
              size="xs"
              leftIcon={<IconPlus size={14} />}
              onClick={() =>
                handleInsertColumn(tableColumns[tableColumns.length - 1].key, 1)
              }
              style={{ color: "#666" }}
            >
              Add Column
            </Button>
          )}
          <Button
            variant="subtle"
            size="xs"
            leftIcon={<IconPlus size={14} />}
            onClick={handleOpenUploadModal}
            style={{ color: "#666" }}
          >
            Add Media
          </Button>
          {tableData.length > 0 && (
            <Button
              variant="subtle"
              size="xs"
              leftIcon={<IconX size={14} />}
              onClick={() => {
                const newTableData = tableData.filter(
                  (_, index) => index !== currentRowIndex,
                );
                setTableData(newTableData);
                setCurrentRowIndex(
                  Math.min(currentRowIndex, newTableData.length - 1),
                );
                // if no more rows, reinitialize columns also
                if (newTableData.length === 0) {
                  setTableColumns([]);
                }
              }}
              style={{ color: "#666" }}
            >
              Remove Media
            </Button>
          )}
        </div>
      </div>

      <div className="tabular-data-footer">
        {/* Enhanced Carousel Navigation */}
        {tableData.length > 1 && (
          <Group
            position="center"
            mt="sm"
            spacing={0}
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <ActionIcon
              onClick={handlePrevRow}
              disabled={tableData.length <= 1}
              variant="transparent"
              size="xl"
              sx={{
                fontSize: "32px",
                color: "#666",
                cursor: "pointer",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.05)",
                borderRadius: "50%",
                transition: "all 0.2s",
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.1)",
                  transform: "scale(1.1)",
                },
                "&:active": {
                  transform: "scale(0.95)",
                },
              }}
            >
              <IconChevronLeft size={32} />
            </ActionIcon>
            <Text
              size="sm"
              weight={500}
              style={{ minWidth: "60px", textAlign: "center" }}
            >
              {`${currentRowIndex + 1}/${tableData.length}`}
            </Text>
            <ActionIcon
              onClick={handleNextRow}
              disabled={tableData.length <= 1}
              variant="transparent"
              size="xl"
              sx={{
                fontSize: "32px",
                color: "#666",
                cursor: "pointer",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.05)",
                borderRadius: "50%",
                transition: "all 0.2s",
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.1)",
                  transform: "scale(1.1)",
                },
                "&:active": {
                  transform: "scale(0.95)",
                },
              }}
            >
              <IconChevronRight size={32} />
            </ActionIcon>
          </Group>
        )}
        <TemplateHooks
          vars={tableColumns.map((col) => col.header)}
          nodeId={id}
          startY={hooksY}
          position={Position.Right}
        />
        {tableData.length >= 1 ? (
          <InspectFooter
            onClick={showResponseInspector}
            isDrawerOpen={showDrawer}
            showDrawerButton={true}
            onDrawerClick={() => {
              const items_in_json_responses =
                __construct_items_in_json_responses(tableData, tableColumns);
              items_in_json_responses
                .then((resolvedResponses) => {
                  setJSONResponses(resolvedResponses);
                })
                .catch((error) => {
                  console.error("Error resolving JSON responses:", error);
                });
              setShowDrawer(!showDrawer);
              bringNodeToFront(id);
            }}
          />
        ) : (
          <></>
        )}

        <LLMResponseInspectorDrawer
          jsonResponses={jsonResponses ?? []}
          showDrawer={showDrawer}
        />
      </div>
      <LLMResponseInspectorModal
        ref={inspectModal}
        jsonResponses={jsonResponses ?? []}
      />
    </BaseNode>
  );
};

export default MultimediaNode;
