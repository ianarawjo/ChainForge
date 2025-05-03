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
  IconTrash,
} from "@tabler/icons-react";
import TemplateHooks from "./TemplateHooksComponent";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { AlertModalContext } from "./AlertModal";
import RenameValueModal, { RenameValueModalRef } from "./RenameValueModal";
import useStore from "./store";
import {
  Dict,
  TabularDataRowType,
  TabularDataColType,
  LLMResponse,
  FileWithContent,
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

import { MediaLookup } from "./backend/cache";
import { blobOrFileToDataURL, dataURLToBlob } from "./backend/utils";

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

// This function serves to convert the `tableData` and `tableColumns` into objects that
// the `LLMResponseInspectorModal` and `LLMResponseInspectorDrawer` support.
// The sum up, it converts the `tableData` into a list of `LLMResponse` objects
//  as if the image was the LLM response the InspectorModal should display
const __construct_items_in_json_responses = async (
  tableData: TabularDataRowType[],
  tableColumns: TabularDataColType[],
) => {
  const items_in_json_responses: LLMResponse[] = await Promise.all(
    tableData.map(async (row) => {
      const item: LLMResponse = {
        responses: [
          {
            t: "img",
            d: await MediaLookup.getUrl(row.image as string),
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

export type metadataRowType = {
  coming_from: "Remote image" | "Local file Uploaded" | ".tsv data import";
  source: string;
  timestamp: string;
  size: string;
  // TODO : Feature VISUAL TOKEN COUNT
  // token_count: string;
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

// This serves to recognize the column that contains the image data
export const IMAGE_COLUMN: TabularDataColType = {
  header: "Image",
  key: "image",
};

const MultimediaNode: React.FC<MultimediaNodeDataProps> = ({ data, id }) => {
  // ----- State variables
  const [tableData, setTableData] = useState<TabularDataRowType[]>(
    data.rows || [],
  );

  const [tableColumns, setTableColumns] = useState<TabularDataColType[]>(
    data.columns || [],
  );

  const [metadataRows, setMetadataRows] = useState<Dict<metadataRowType>>({}); // Keys are the __uid of the tableData rows

  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  const [hooksY, setHooksY] = useState(120);

  // Will store the image the Caroussel View is currently focusing on.
  // Purpose is to LAZY LOAD image data ON-THE-FLY only when user focuses it !!! see `fetchImageUrl` below
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const [renameColumnInitialVal, setRenameColumnInitialVal] = useState<
    TabularDataColType | string
  >("");

  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);
  const bringNodeToFront = useStore((state) => state.bringNodeToFront);

  // Dynamically update the position of the template hooks
  const ref = useRef<HTMLDivElement | null>(null);

  // For displaying error messages to user
  const showAlert = useContext(AlertModalContext);

  // For renaming a column
  const renameColumnModal = useRef<RenameValueModalRef>(null);

  // For clickable image
  const imagePreviewModal = useRef<ImagePreviewModalRef>(null);

  // For displaying the message when the user clicks on the INFO button
  const [infoModalOpened, { open: openInfoModal, close: closeInfoModal }] =
    useDisclosure(false);

  // For dispalying the LLMResponseInspectorModal
  const [jsonResponses, setJSONResponses] = useState<LLMResponse[] | null>(
    null,
  );
  const inspectModal = useRef<LLMResponseInspectorModalRef>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Add a handler for the "Remove ALL" button
  const handleRemoveAll = useCallback(() => {
    // Clear all data
    setTableData([]);
    setTableColumns([]);
    setMetadataRows({});
    setCurrentRowIndex(0);
    setImageUrl(undefined);

    // Update the data store
    setDataPropsForNode(id, {
      rows: [],
      columns: [],
    });

    // Notify connected nodes
    pingOutputNodes(id);
  }, [id, setDataPropsForNode, pingOutputNodes]);

  // called on the change of a textarea field
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

  // Inserts a new textfield area under existing ones, considered in the States as a column (hence the name)
  const handleInsertColumn = useCallback(
    (startColKey: string) => {
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

  const handleError = (err: Error) => {
    if (showAlert) showAlert(err.message);
    console.error(err.message);
  };

  useEffect(() => {
    const fetchImageUrl = async () => {
      if (tableData[currentRowIndex]?.image) {
        const url = await MediaLookup.getUrl(
          tableData[currentRowIndex].image as string,
        );
        setImageUrl(url);
      }
    };
    fetchImageUrl();
  }, [tableData, currentRowIndex]);

  // Scrolls to bottom of the table when scrollToBottom toggle is true
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, []);

  // Updates the internal data store whenever the table data changes
  useEffect(() => {
    setDataPropsForNode(id, {
      rows: tableData,
      columns: tableColumns,
    });
  }, [tableData, tableColumns, currentRowIndex, id, setDataPropsForNode]);

  // Used when user imports a .tsv file through the upload button
  // Arg `jsonl` is the converted JSON object from the .tsv file
  // where JSON objects should be in row format, with keys as the header names.
  // The internal keys of the columns will use uids to be unique.
  const importJSONList = (jsonl: Array<Dict>, source_file_data: Dict) => {
    // I noticed for some .tsv files, sometimes the last row is empty ( may originates from Papa.parse(...) function)
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
    const image_col = columns.find((col) => col.header === IMAGE_COLUMN.key);
    if (!image_col) {
      throw new Error("No image column found in the data");
    }

    // Set the new columns,
    // and verify that if the image column is present in the state tableColumns, we dont add it again
    const imageColumnExists = tableColumns.some(
      (col) => col.key === IMAGE_COLUMN.key,
    );
    const colIdx = columns.findIndex((elem) => elem.header === "image");
    const imageColumnKey = columns[colIdx].key;
    if (!imageColumnExists) {
      columns[colIdx] = IMAGE_COLUMN;
    } else {
      columns.splice(colIdx, 1);
    }

    // (VERY UNLIKELY) Check if some columns are already present in the state tableColumns
    // and if not, add them to the state tableColumns
    // and set the header to "New Column" if not already set
    const new_columns = columns
      .map((col, index) => {
        const colExists = tableColumns.some(
          (c) => c.key === col.key && c.header === col.header,
        );
        if (!colExists) {
          return {
            ...col,
            header: col.header || `New Column ${index + 1}th of the file`,
          };
        } else {
          console.warn(
            `Column ${col} (${index}th column in the file) already exists in the table. Not adding it again.`,
          );
          return undefined;
        }
      })
      .filter((col) => col !== undefined) as TabularDataColType[];

    // Set the new rows
    const new_rows = rows.map((row) => {
      const image_data_row = row[imageColumnKey] as string;
      const blob_object_to_upload = dataURLToBlob(
        image_data_row.startsWith("data:image")
          ? image_data_row
          : `data:image/jpeg;base64,${image_data_row}`,
      );

      const new_row: TabularDataRowType = {};

      new_columns.forEach((col) => {
        new_row[col.key] = row[col.key];
      });

      MediaLookup.upload(blob_object_to_upload).then((uid) => {
        new_row[IMAGE_COLUMN.key] = uid;
      });

      // Add a unique ID to each row
      new_row.__uid = uuidv4();
      return new_row;
    });

    // Update metadata for imported rows
    const newMetadata: Dict<metadataRowType> = { ...metadataRows };
    new_rows.forEach((row) => {
      newMetadata[row.__uid] = {
        source: source_file_data.name,
        coming_from: ".tsv data import",
        timestamp: source_file_data.lastModified.toString(),
        size: source_file_data.size.toString(),
      };
    });

    // Call the callbacks
    setMetadataRows(newMetadata);
    setTableColumns([...tableColumns, ...new_columns]);
    setTableData([...tableData, ...new_rows]);
    setCurrentRowIndex(new_rows.length - 1);
    setDataPropsForNode(id, {
      rows: [...tableData, ...new_rows],
      columns: [...tableColumns, ...new_columns],
    });
    pingOutputNodes(id);
  };

  // Import tabular data from a .tsv file
  // and sanity check the minimal headers required for the .tsv file
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
          const source_file_data = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
          };
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

          importJSONList(papa_parsed.data as Dict<any>[], source_file_data);
        } catch (error) {
          handleError(error as Error);
        }
      });

      reader.readAsText(file);
    });

    // Trigger the file selector
    input.click();
  };

  // To listen for resize events of the table container, we need to use a ResizeObserver.
  // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div container.
  const setRef = useCallback(
    (elem: HTMLDivElement) => {
      if (!ref.current && elem && window.ResizeObserver) {
        let past_hooks_y = 120;
        const observer = new window.ResizeObserver(() => {
          if (!ref || !ref.current) return;
          // Depending if there is the < > Chevron buttons or not, the offset is not the same
          const vertical_y_offset_hooks = tableData.length > 1 ? 405 : 345;
          const new_hooks_y =
            ref.current.clientHeight + vertical_y_offset_hooks;
          if (past_hooks_y !== new_hooks_y) {
            setHooksY(new_hooks_y);
            past_hooks_y = new_hooks_y;
          }
        });

        observer.observe(elem);
        ref.current = elem;
      }
    },
    [ref, tableData, currentRowIndex, tableColumns],
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
    async (
      image_data: FileWithContent,
      newRow: TabularDataRowType = defaultRows,
      newColumns: TabularDataColType[] = defaultColumns,
    ) => {
      //  ------- HANDLING NEW COLUMNS
      const imageColumnKey = "image";
      const imageColumnExists = tableColumns.some(
        (col) => col.key === imageColumnKey,
      );

      const columns_to_add = [];

      // Add image column if it doesn't exist
      if (!imageColumnExists) {
        columns_to_add.push(IMAGE_COLUMN);
      }

      // Only add new columns if there are no existing columns
      if (tableColumns.length === 0) {
        setTableColumns([...newColumns, ...columns_to_add]);
      }
      //  -------

      //  ------- HANDLING NEW ROWS
      const uid_image_cached = await MediaLookup.upload(image_data);

      // Create new row with image URL and ensure it has a unique ID
      const rowWithImage: TabularDataRowType = {
        ...newRow,
        [imageColumnKey]: uid_image_cached,
        __uid: newRow.__uid || uuidv4(),
      };
      //  -------

      // Update table data
      const updatedTableData = [...tableData, rowWithImage];
      setTableData(updatedTableData);
      setCurrentRowIndex(updatedTableData.length - 1);

      // Update metadata for the new row
      const coming_from: metadataRowType["coming_from"] =
        image_data.name.startsWith("http")
          ? "Remote image"
          : "Local file Uploaded";

      const timestamp = image_data.lastModified;

      const newMetadata = {
        ...metadataRows,
        [rowWithImage.__uid]: {
          source: image_data.name,
          coming_from: coming_from,
          timestamp: timestamp.toString(),
          size: image_data.size.toString(),
        },
      };
      setMetadataRows(newMetadata);

      setDataPropsForNode(id, {
        rows: updatedTableData,
        columns: tableColumns,
      });
    },
    [tableColumns, tableData, id, setDataPropsForNode, metadataRows],
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

  const handleImageClick = useCallback(() => {
    const metadata = metadataRows[tableData[currentRowIndex].__uid];
    if (imagePreviewModal.current && typeof imageUrl === "string") {
      imagePreviewModal.current.trigger(imageUrl, metadata);
    }
  }, [tableData, currentRowIndex, metadataRows, imageUrl]);

  // Relative to the info Button
  const default_header = useMemo(() => {
    return "Info about Imported File Format";
  }, []);

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

      {/* MODAL COMPONENTS :
            - Info Modal (for info button on the top right)
            - Rename Column Modal (to rename a column)
            - Upload File Modal (to upload a file)
            - Image Preview Modal (to have image info when clicking on the image)
            - LLMResponseInspectorModal (to inspect the LLM response)
            - LLMResponseInspectorDrawer (to inspect the LLM response in a drawer)
      */}
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
        title="Upload Image : HTTP url or local file"
        onSubmit={handleUploadFile}
      />
      <LLMResponseInspectorModal
        ref={inspectModal}
        jsonResponses={jsonResponses ?? []}
      />

      {/* if data present, display a clickable Image  */}
      {tableData.length > 0 && tableData[currentRowIndex].image && (
        <div
          style={{
            border: "1px solid #e0e0e0",
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
                src={imageUrl}
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

      {/* 
        if data present, for each column, display a textarea filled with the adequate row data
         and a button to rename the column
         and if we have more than one column, a button to remove the column
      */}
      <div className="carousel-row-display" style={{ marginTop: "20px" }}>
        {tableData.length > 0 && (
          <div
            ref={setRef}
            className="multimedia-textfields-container nowheel nodrag"
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
                    className="text-field-fixed-in-multimedia-node"
                  />
                </div>
              ))}
          </div>
        )}

        {/* If no data present, display a message */}
        {tableData.length === 0 && (
          <div
            ref={setRef}
            className="multimedia-textfields-container nowheel nodrag"
          >
            <Box className="empty-state-box-multimedia-node">
              <Text color="dimmed">No Media Uploaded</Text>
            </Box>
          </div>
        )}

        {/* 
          Display the button to add a media file
          and if data is present :
              - a button to add a column
              - a button to remove the media
        */}
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
                handleInsertColumn(tableColumns[tableColumns.length - 1].key)
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
            <>
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
              <Button
                variant="subtle"
                size="xs"
                leftIcon={<IconTrash size={14} />}
                onClick={handleRemoveAll}
                style={{ color: "#666" }}
              >
                Remove ALL
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 
        if we have more than one row, display Carousel Navigation left/right arrows
      */}
      <div className="tabular-data-footer">
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
              className="carousel-nav-button"
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
              className="carousel-nav-button"
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

        {/* 
          if we have more than one row, display the Inspect button
        */}
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
    </BaseNode>
  );
};

export default MultimediaNode;
