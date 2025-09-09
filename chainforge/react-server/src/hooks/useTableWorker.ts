import { useRef, useEffect, useCallback } from "react";
import { TabularDataRowType, TabularDataColType } from "../backend/typing";

export interface UseTableWorkerOptions {
  onDataProcessed?: (result: any) => void;
  onSampleComplete?: (result: any) => void;
  onPaginateComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export const useTableWorker = (options: UseTableWorkerOptions = {}) => {
  const workerRef = useRef<Worker | null>(null);
  const { onDataProcessed, onSampleComplete, onPaginateComplete, onError } =
    options;

  useEffect(() => {
    // Create worker instance
    try {
      // Note: In a real implementation, you'd need to properly configure worker-loader
      // For now, we'll create a simple inline worker as a fallback
      const workerCode = `
        self.onmessage = function(event) {
          const { type, payload } = event.data;
          
          try {
            switch (type) {
              case 'PROCESS_DATA':
                handleProcessData(payload);
                break;
              case 'SAMPLE_DATA':
                handleSampleData(payload);
                break;
              case 'PAGINATE_DATA':
                handlePaginateData(payload);
                break;
              default:
                self.postMessage({
                  type: 'ERROR',
                  error: 'Unknown message type: ' + type,
                });
            }
          } catch (error) {
            self.postMessage({
              type: 'ERROR',
              error: error.message || 'Unknown error occurred',
            });
          }
        };
        
        function handleProcessData(payload) {
          const { rows, columns, operation } = payload;
          const startTime = Date.now();
          
          let processedRows = [...rows];
          
          switch (operation) {
            case 'VALIDATE':
              processedRows = rows.filter(row => {
                return Object.values(row).some(value => 
                  value !== null && value !== undefined && value !== ''
                );
              });
              break;
            case 'CLEAN':
              processedRows = rows.map(row => {
                const cleanedRow = { ...row };
                Object.keys(cleanedRow).forEach(key => {
                  if (typeof cleanedRow[key] === 'string') {
                    cleanedRow[key] = cleanedRow[key].trim();
                  }
                });
                return cleanedRow;
              });
              break;
          }
          
          const processingTime = Date.now() - startTime;
          
          self.postMessage({
            type: 'PROCESS_DATA_COMPLETE',
            result: {
              rows: processedRows,
              columns,
              processingTime,
              originalCount: rows.length,
              processedCount: processedRows.length,
            },
          });
        }
        
        function handleSampleData(payload) {
          const { rows, sampleSize } = payload;
          
          if (sampleSize >= rows.length) {
            self.postMessage({
              type: 'SAMPLE_DATA_COMPLETE',
              result: { sampledRows: rows },
            });
            return;
          }
          
          const shuffled = [...rows];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          
          const sampledRows = shuffled.slice(0, sampleSize);
          
          self.postMessage({
            type: 'SAMPLE_DATA_COMPLETE',
            result: { sampledRows },
          });
        }
        
        function handlePaginateData(payload) {
          const { rows, page, pageSize } = payload;
          
          const startIndex = page * pageSize;
          const endIndex = Math.min(startIndex + pageSize, rows.length);
          const paginatedRows = rows.slice(startIndex, endIndex);
          
          self.postMessage({
            type: 'PAGINATE_DATA_COMPLETE',
            result: {
              rows: paginatedRows,
              totalRows: rows.length,
              currentPage: page,
              pageSize,
              totalPages: Math.ceil(rows.length / pageSize),
            },
          });
        }
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      workerRef.current = new Worker(URL.createObjectURL(blob));

      // Set up message handler
      workerRef.current.onmessage = (event) => {
        const { type, result, error } = event.data;

        switch (type) {
          case "PROCESS_DATA_COMPLETE":
            onDataProcessed?.(result);
            break;
          case "SAMPLE_DATA_COMPLETE":
            onSampleComplete?.(result);
            break;
          case "PAGINATE_DATA_COMPLETE":
            onPaginateComplete?.(result);
            break;
          case "ERROR":
            onError?.(error);
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        onError?.(`Worker error: ${error.message}`);
      };
    } catch (error) {
      console.warn(
        "Failed to create web worker, falling back to main thread processing",
      );
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [onDataProcessed, onSampleComplete, onPaginateComplete, onError]);

  const processData = useCallback(
    (
      rows: TabularDataRowType[],
      columns: TabularDataColType[],
      operation: string,
    ) => {
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: "PROCESS_DATA",
          payload: { rows, columns, operation },
        });
      } else {
        // Fallback to main thread processing
        setTimeout(() => {
          let processedRows = [...rows];

          switch (operation) {
            case "VALIDATE":
              processedRows = rows.filter((row) => {
                return Object.values(row).some(
                  (value) =>
                    value !== null && value !== undefined && value !== "",
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
          }

          onDataProcessed?.({
            rows: processedRows,
            columns,
            processingTime: 0,
            originalCount: rows.length,
            processedCount: processedRows.length,
          });
        }, 0);
      }
    },
    [onDataProcessed],
  );

  const sampleData = useCallback(
    (rows: TabularDataRowType[], sampleSize: number) => {
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: "SAMPLE_DATA",
          payload: { rows, sampleSize },
        });
      } else {
        // Fallback to main thread processing
        setTimeout(() => {
          if (sampleSize >= rows.length) {
            onSampleComplete?.({ sampledRows: rows });
            return;
          }

          const shuffled = [...rows];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          const sampledRows = shuffled.slice(0, sampleSize);
          onSampleComplete?.({ sampledRows });
        }, 0);
      }
    },
    [onSampleComplete],
  );

  const paginateData = useCallback(
    (rows: TabularDataRowType[], page: number, pageSize: number) => {
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: "PAGINATE_DATA",
          payload: { rows, page, pageSize },
        });
      } else {
        // Fallback to main thread processing
        setTimeout(() => {
          const startIndex = page * pageSize;
          const endIndex = Math.min(startIndex + pageSize, rows.length);
          const paginatedRows = rows.slice(startIndex, endIndex);

          onPaginateComplete?.({
            rows: paginatedRows,
            totalRows: rows.length,
            currentPage: page,
            pageSize,
            totalPages: Math.ceil(rows.length / pageSize),
          });
        }, 0);
      }
    },
    [onPaginateComplete],
  );

  return {
    processData,
    sampleData,
    paginateData,
    isWorkerAvailable: workerRef.current !== null,
  };
};
