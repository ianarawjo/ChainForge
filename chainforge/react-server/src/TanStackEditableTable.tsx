import React, { useState, useEffect, useMemo } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_TableOptions,
} from "mantine-react-table";
import {
  Menu,
  ActionIcon,
  Button,
  TextInput,
  Box,
  Flex,
  Loader,
  Text,
} from "@mantine/core";
import {
  IconDots,
  IconPencil,
  IconArrowLeft,
  IconArrowRight,
  IconX,
  IconArrowBarToUp,
  IconArrowBarToDown,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import { TabularDataColType, TabularDataRowType } from "./backend/typing";
import { useTableWorker } from "./hooks/useTableWorker";

export interface TanStackEditableTableProps {
  rows: TabularDataRowType[];
  columns: TabularDataColType[];
  handleSaveCell: (rowIdx: number, colKey: string, text: string) => void;
  handleInsertColumn: (colKey: string, dir: 1 | -1) => void;
  handleRemoveColumn: (colKey: string) => void;
  handleRenameColumn: (col: TabularDataColType) => void;
  handleAddRow?: () => void;
  handleInsertRow?: (rowIndex: number, offset: 0 | -1) => void;
  handleRemoveRow?: (rowIndex: number) => void;
  handleClearDataset?: () => void;
}

const TanStackEditableTable: React.FC<TanStackEditableTableProps> = ({
  rows,
  columns,
  handleSaveCell,
  handleInsertColumn,
  handleRemoveColumn,
  handleRenameColumn,
  handleAddRow,
  handleInsertRow,
  handleRemoveRow,
  handleClearDataset,
}) => {
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    rowIndex: number;
    position: { x: number; y: number };
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayRows, setDisplayRows] = useState<TabularDataRowType[]>(rows);

  // Worker hook for handling large datasets
  const { processData, sampleData, paginateData, isWorkerAvailable } =
    useTableWorker({
      onDataProcessed: (result) => {
        setDisplayRows(result.rows);
        setIsProcessing(false);
      },
      onSampleComplete: (result) => {
        setDisplayRows(result.sampledRows);
        setIsProcessing(false);
      },
      onPaginateComplete: (result) => {
        setDisplayRows(result.rows);
        setIsProcessing(false);
      },
      onError: (error) => {
        console.error("Worker error:", error);
        setIsProcessing(false);
      },
    });

  // Update display rows when input rows change
  useEffect(() => {
    setDisplayRows(rows);
  }, [rows]);

  // Convert TabularDataColType[] to MRT_ColumnDef[]
  const tableColumns = useMemo<MRT_ColumnDef<TabularDataRowType>[]>(() => {
    return columns.map((col) => ({
      accessorKey: col.key,
      id: col.key,
      header: col.header,
      size: 150,
      minSize: 100,
      maxSize: 400,
      enableColumnOrdering: true,
      enableResizing: true,
      Header: ({ column }) => (
        <Box style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {editingHeader === col.key ? (
            <TextInput
              defaultValue={col.header}
              size="xs"
              autoFocus
              onBlur={(e) => {
                handleSaveCell(-1, col.key, e.currentTarget.value);
                setEditingHeader(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveCell(-1, col.key, e.currentTarget.value);
                  setEditingHeader(null);
                }
                if (e.key === "Escape") {
                  setEditingHeader(null);
                }
              }}
              style={{ fontSize: "10pt", fontWeight: "bold" }}
            />
          ) : (
            <span
              style={{
                fontSize: "10pt",
                fontWeight: "bold",
                cursor: "pointer",
                flex: 1,
              }}
              onClick={() => setEditingHeader(col.key)}
            >
              {col.header}
            </span>
          )}
          <Menu>
            <Menu.Target>
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={(e) => e.stopPropagation()}
              >
                <IconDots size={12} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                icon={<IconPencil size={14} />}
                onClick={() => handleRenameColumn(col)}
              >
                Rename column
              </Menu.Item>
              <Menu.Item
                icon={<IconArrowLeft size={14} />}
                onClick={() => handleInsertColumn(col.key, -1)}
              >
                Insert column to left
              </Menu.Item>
              <Menu.Item
                icon={<IconArrowRight size={14} />}
                onClick={() => handleInsertColumn(col.key, 1)}
              >
                Insert column to right
              </Menu.Item>
              <Menu.Item
                icon={<IconX size={14} />}
                onClick={() => handleRemoveColumn(col.key)}
                color="red"
              >
                Remove column
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Box>
      ),
      Cell: ({ cell, row }) => {
        const isEditing =
          editingCell?.rowIndex === row.index &&
          editingCell?.columnId === col.key;
        const cellValue = String(cell.getValue() || "");

        if (isEditing) {
          return (
            <TextInput
              defaultValue={cellValue}
              size="xs"
              autoFocus
              style={{
                fontSize: "10pt",
                fontFamily: "monospace",
              }}
              onBlur={(e) => {
                handleSaveCell(row.index, col.key, e.currentTarget.value);
                setEditingCell(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveCell(row.index, col.key, e.currentTarget.value);
                  setEditingCell(null);
                }
                if (e.key === "Escape") {
                  setEditingCell(null);
                }
              }}
            />
          );
        }

        return (
          <div
            style={{
              fontSize: "10pt",
              fontFamily: "monospace",
              minHeight: "16px",
              padding: "2px",
              cursor: "text",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
            onClick={() =>
              setEditingCell({ rowIndex: row.index, columnId: col.key })
            }
          >
            {cellValue}
          </div>
        );
      },
    }));
  }, [
    columns,
    editingCell,
    editingHeader,
    handleSaveCell,
    handleInsertColumn,
    handleRemoveColumn,
    handleRenameColumn,
  ]);

  const table = useMantineReactTable({
    columns: tableColumns,
    data: displayRows,
    enableEditing: true,
    editDisplayMode: "cell",
    enableColumnActions: false,
    enableColumnDragging: true,
    enableColumnOrdering: true,
    enableColumnResizing: true,
    enableDensityToggle: false,
    enableFilters: false,
    enableFullScreenToggle: false,
    enableGlobalFilter: false,
    enableHiding: false,
    enablePagination: true,
    enableRowActions: true,
    enableRowSelection: false,
    enableSorting: false,
    enableTopToolbar: true,
    enableBottomToolbar: true,
    enableVirtualization: true,
    initialState: {
      density: "xs",
      pagination: {
        pageIndex: 0,
        pageSize: 100,
      },
    },
    mantineTableContainerProps: {
      style: {
        maxHeight: "400px",
        fontSize: "10pt",
        fontFamily: "monospace",
      },
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "2px",
        fontSize: "10pt",
        fontFamily: "monospace",
        lineHeight: "1.2",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "4px",
        fontSize: "10pt",
        fontWeight: "bold",
      },
    },
    mantineTableBodyRowProps: ({ row }) => ({
      onContextMenu: (e) => {
        e.preventDefault();
        setContextMenuTarget({
          rowIndex: row.index,
          position: { x: e.clientX, y: e.clientY },
        });
      },
    }),
    renderRowActions: ({ row }) => (
      <Menu>
        <Menu.Target>
          <ActionIcon size="sm" variant="subtle">
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            icon={<IconArrowBarToUp size={14} />}
            onClick={() => handleInsertRow?.(row.index, -1)}
          >
            Insert row above
          </Menu.Item>
          <Menu.Item
            icon={<IconArrowBarToDown size={14} />}
            onClick={() => handleInsertRow?.(row.index, 0)}
          >
            Insert row below
          </Menu.Item>
          <Menu.Item
            icon={<IconX size={14} />}
            onClick={() => handleRemoveRow?.(row.index)}
            color="red"
          >
            Delete row
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    ),
    renderTopToolbar: ({ table }) => (
      <Flex justify="space-between" align="center" p="md">
        <Flex gap="sm">
          <Button
            leftIcon={<IconPlus size={16} />}
            onClick={handleAddRow}
            size="xs"
            variant="light"
          >
            Add Row
          </Button>
          {handleClearDataset && (
            <Button
              leftIcon={<IconTrash size={16} />}
              onClick={handleClearDataset}
              size="xs"
              variant="light"
              color="red"
            >
              Clear Dataset
            </Button>
          )}
        </Flex>
        <Flex gap="sm" align="center">
          {isProcessing && <Loader size="xs" />}
          <Text size="xs" c="dimmed">
            {displayRows.length} rows{" "}
            {displayRows.length !== rows.length && `(of ${rows.length})`}
          </Text>
          {isWorkerAvailable && (
            <Text size="xs" c="green">
              ⚡ Worker enabled
            </Text>
          )}
        </Flex>
      </Flex>
    ),
  } as MRT_TableOptions<TabularDataRowType>);

  // Handle context menu clicks outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuTarget(null);
    };

    if (contextMenuTarget) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenuTarget]);

  return (
    <Box style={{ position: "relative" }}>
      <MantineReactTable table={table} />

      {/* Context menu for row operations */}
      {contextMenuTarget && (
        <Menu
          opened={true}
          onChange={() => setContextMenuTarget(null)}
          withinPortal
          styles={{
            dropdown: {
              position: "fixed",
              left: contextMenuTarget.position.x,
              top: contextMenuTarget.position.y,
              zIndex: 1000,
            },
          }}
        >
          <Menu.Dropdown>
            <Menu.Item
              icon={<IconArrowBarToUp size={14} />}
              onClick={() => {
                handleInsertRow?.(contextMenuTarget.rowIndex, -1);
                setContextMenuTarget(null);
              }}
            >
              Insert row above
            </Menu.Item>
            <Menu.Item
              icon={<IconArrowBarToDown size={14} />}
              onClick={() => {
                handleInsertRow?.(contextMenuTarget.rowIndex, 0);
                setContextMenuTarget(null);
              }}
            >
              Insert row below
            </Menu.Item>
            <Menu.Item
              icon={<IconX size={14} />}
              onClick={() => {
                handleRemoveRow?.(contextMenuTarget.rowIndex);
                setContextMenuTarget(null);
              }}
              color="red"
            >
              Delete row
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </Box>
  );
};

export default TanStackEditableTable;
