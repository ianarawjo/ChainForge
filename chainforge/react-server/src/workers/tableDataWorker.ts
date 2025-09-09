// Web Worker for processing large datasets
import { TabularDataRowType, TabularDataColType } from "../backend/typing";

export interface WorkerMessage {
  type: "PROCESS_DATA" | "SAMPLE_DATA" | "FILTER_DATA" | "PAGINATE_DATA";
  payload: any;
}

export interface ProcessDataPayload {
  rows: TabularDataRowType[];
  columns: TabularDataColType[];
  operation: string;
}

export interface SampleDataPayload {
  rows: TabularDataRowType[];
  sampleSize: number;
}

export interface PaginateDataPayload {
  rows: TabularDataRowType[];
  page: number;
  pageSize: number;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case "PROCESS_DATA":
        handleProcessData(payload as ProcessDataPayload);
        break;
      case "SAMPLE_DATA":
        handleSampleData(payload as SampleDataPayload);
        break;
      case "PAGINATE_DATA":
        handlePaginateData(payload as PaginateDataPayload);
        break;
      default:
        self.postMessage({
          type: "ERROR",
          error: `Unknown message type: ${type}`,
        });
    }
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};

function handleProcessData(payload: ProcessDataPayload) {
  const { rows, columns, operation } = payload;

  // Simulate processing time for large datasets
  const startTime = Date.now();

  let processedRows = [...rows];

  // Example processing operations
  switch (operation) {
    case "VALIDATE":
      processedRows = rows.filter((row) => {
        return Object.values(row).some(
          (value) => value !== null && value !== undefined && value !== "",
        );
      });
      break;
    case "CLEAN":
      processedRows = rows.map((row) => {
        const cleanedRow = { ...row };
        Object.keys(cleanedRow).forEach((key) => {
          if (typeof cleanedRow[key] === "string") {
            cleanedRow[key] = (cleanedRow[key] as string).trim();
          }
        });
        return cleanedRow;
      });
      break;
    default:
      break;
  }

  const processingTime = Date.now() - startTime;

  self.postMessage({
    type: "PROCESS_DATA_COMPLETE",
    result: {
      rows: processedRows,
      columns,
      processingTime,
      originalCount: rows.length,
      processedCount: processedRows.length,
    },
  });
}

function handleSampleData(payload: SampleDataPayload) {
  const { rows, sampleSize } = payload;

  if (sampleSize >= rows.length) {
    self.postMessage({
      type: "SAMPLE_DATA_COMPLETE",
      result: { sampledRows: rows },
    });
    return;
  }

  // Fisher-Yates shuffle algorithm for random sampling
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const sampledRows = shuffled.slice(0, sampleSize);

  self.postMessage({
    type: "SAMPLE_DATA_COMPLETE",
    result: { sampledRows },
  });
}

function handlePaginateData(payload: PaginateDataPayload) {
  const { rows, page, pageSize } = payload;

  const startIndex = page * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rows.length);
  const paginatedRows = rows.slice(startIndex, endIndex);

  self.postMessage({
    type: "PAGINATE_DATA_COMPLETE",
    result: {
      rows: paginatedRows,
      totalRows: rows.length,
      currentPage: page,
      pageSize,
      totalPages: Math.ceil(rows.length / pageSize),
    },
  });
}

export {};
