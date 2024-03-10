import React, { useState, useEffect } from "react";
import {
  Table,
  Textarea,
  Menu,
  TextInputStylesNames,
  Styles,
} from "@mantine/core";
import {
  IconDots,
  IconPencil,
  IconArrowLeft,
  IconArrowRight,
  IconX,
} from "@tabler/icons-react";
import { TabularDataColType, TabularDataRowType } from "./backend/typing";

const cellTextareaStyle = {
  input: {
    border: "0",
    fontFamily: "monospace",
    fontSize: "10pt",
    padding: "2px !important",
    minHeight: "10pt",
    lineHeight: "1.2",
    whiteSpace: "pre-wrap",
    background: "transparent",
  },
  root: {
    width: "inherit",
  },
} satisfies Styles<TextInputStylesNames>;
const headerTextareaStyle = {
  input: {
    border: "0",
    fontSize: "10pt",
    fontWeight: "bold",
    padding: "2px !important",
    minHeight: "10pt",
    lineHeight: "1.2",
    whiteSpace: "pre-wrap",
    background: "transparent",
  },
  root: {
    width: "inherit",
  },
} satisfies Styles<TextInputStylesNames>;
const tableHeaderStyle = {
  paddingBottom: "4px",
};

/* Set the cursor position to start of innerText in a content editable div. */
const forceFocusContentEditable = (
  e: React.MouseEvent<HTMLParagraphElement>,
) => {
  // We need to do some jujitsu here, because apparently divs with no text don't autofocus the cursor
  // properly the first time they are clicked. Instead we (a) detect an empty div and (b) force the cursor to focus on it:
  if ((e.target as HTMLParagraphElement).innerText.length === 0) {
    const node = e.target as HTMLParagraphElement;
    const range = document.createRange();
    range.selectNode(node);
    range.setStart(node, 0);
    range.setEnd(node, 0);

    const selection = window.getSelection();
    range.collapse(false);
    if (selection !== null) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
};

interface CellTextareaProps {
  initialValue: string;
  rowIdx: number;
  column: TabularDataColType;
  handleSaveCell: (rowIdx: number, colKey: string, text: string) => void;
}

const CellTextarea: React.FC<CellTextareaProps> = ({
  initialValue,
  rowIdx,
  column,
  handleSaveCell,
  // onContextMenu,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <Textarea
      autosize={true}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      aria-autocomplete="none"
      value={value}
      placeholder={column.header}
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={(e) => handleSaveCell(rowIdx, column.key, e.currentTarget.value)}
      minRows={1}
      maxRows={6}
      styles={rowIdx > -1 ? cellTextareaStyle : headerTextareaStyle}
    />
  );
};

export interface EditableTableProps {
  rows: TabularDataRowType[];
  columns: TabularDataColType[];
  handleSaveCell: (rowIdx: number, colKey: string, text: string) => void;
  handleInsertColumn: (colKey: string, dir: 1 | -1) => void;
  handleRemoveColumn: (colKey: string) => void;
  handleRenameColumn: (col: TabularDataColType) => void;
}

/**
 * A table with multi-line textareas that is always editable and relatively fast.
 */
const EditableTable: React.FC<EditableTableProps> = ({
  rows,
  columns,
  handleSaveCell,
  handleInsertColumn,
  handleRemoveColumn,
  handleRenameColumn,
}) => {
  const [trows, setTrows] = useState<React.ReactNode[]>([]);
  const [thead, setThead] = useState<React.ReactNode>([]);

  // Re-create the table anytime the rows or columns changes
  useEffect(() => {
    const cols = columns ?? [];

    setTrows(
      rows.map(
        (
          row,
          rowIdx, // For some reason, table autosizing is broken by textareas. We'll live with it for now, but flagged to fix in the future.
        ) => (
          <tr key={row.__uid}>
            {cols.map((c) => {
              const txt = c.key in row ? row[c.key] : "";
              return (
                <td
                  key={`${row.__uid}-${c.key}`}
                  style={{ position: "relative" }}
                >
                  {/* We use contenteditable because it loads *much* faster than textareas, which is important for big tables. */}
                  <p
                    placeholder={c.header}
                    onClick={forceFocusContentEditable}
                    onBlur={(e) =>
                      handleSaveCell(rowIdx, c.key, e.currentTarget.innerText)
                    }
                    className="content-editable-div"
                    contentEditable
                    suppressContentEditableWarning={true}
                  >
                    {txt}
                  </p>
                  {/* <CellTextarea initialValue={txt} rowIdx={rowIdx} column={c} handleSaveCell={handleSaveCell} /> */}
                </td>
              );
            })}
          </tr>
        ),
      ),
    );

    setThead(
      <tr>
        {columns.map((c) => (
          <th key={c.key} style={tableHeaderStyle}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {/* <CellTextarea initialValue={c.header} rowIdx={-1} column={c} handleSaveCell={handleSaveCell} /> */}
              <p
                onClick={forceFocusContentEditable}
                onBlur={(e) =>
                  handleSaveCell(-1, c.key, e.currentTarget.innerText)
                }
                className="content-editable-div"
                contentEditable
                suppressContentEditableWarning={true}
              >
                {c.header}
              </p>
              <Menu
                closeOnClickOutside
                styles={{ dropdown: { boxShadow: "1px 1px 4px #ccc" } }}
              >
                <Menu.Target>
                  <IconDots
                    size="12pt"
                    style={{
                      padding: "0px",
                      marginTop: "3pt",
                      marginLeft: "2pt",
                    }}
                    className="table-col-edit-btn"
                  />
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    key="rename_col"
                    onClick={() => handleRenameColumn(c)}
                  >
                    <IconPencil size="10pt" />
                    &nbsp;Rename column
                  </Menu.Item>
                  <Menu.Item
                    key="insert_left"
                    onClick={() => handleInsertColumn(c.key, -1)}
                  >
                    <IconArrowLeft size="10pt" />
                    &nbsp;Insert column to left
                  </Menu.Item>
                  <Menu.Item
                    key="insert_right"
                    onClick={() => handleInsertColumn(c.key, 1)}
                  >
                    <IconArrowRight size="10pt" />
                    &nbsp;Insert column to right
                  </Menu.Item>
                  <Menu.Item
                    key="remove_col"
                    onClick={() => handleRemoveColumn(c.key)}
                  >
                    <IconX size="8pt" /> Remove column
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
          </th>
        ))}
      </tr>,
    );
  }, [rows, columns]);

  return (
    <Table
      verticalSpacing={"0px"}
      striped
      highlightOnHover
      className="editable-table"
    >
      <thead>{thead}</thead>
      <tbody>{trows}</tbody>
    </Table>
  );
};

export default EditableTable;
