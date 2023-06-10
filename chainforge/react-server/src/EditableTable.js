import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { Table, Textarea, Menu, Button, TextInput } from '@mantine/core';
import { IconDots, IconPencil, IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react';

const cellTextareaStyle = {
  input: {
    border: '0',
    fontFamily: 'monospace',
    fontSize: '10pt',
    padding: '2px !important',
    minHeight: '10pt',
    lineHeight: '1.2',
    whiteSpace: 'pre-wrap',
    background: 'transparent'
  }
};
const headerTextareaStyle = {
  input: {
    border: '0',
    fontSize: '10pt',
    fontWeight: '600',
    padding: '2px !important',
    minHeight: '10pt',
    lineHeight: '1.2',
    whiteSpace: 'pre-wrap',
    background: 'transparent'
  }
};
const tableHeaderStyle = {
  paddingBottom: '4px'
};

const CellTextarea = ({ initialValue, rowIdx, column, handleSaveCell, onContextMenu }) => {
  const [value, setValue] = useState(initialValue);

  return <Textarea autosize={true} 
                   autoComplete='off'
                   autoCapitalize='off'
                   autoCorrect='off'
                   aria-autocomplete='none'
                   value={value}
                   placeholder={column.header}
                   onChange={(e) => setValue(e.currentTarget.value)}
                   onBlur={(e) => handleSaveCell(rowIdx, column.key, e.currentTarget.value)}
                   minRows={1} 
                   maxRows={6} 
                   styles={rowIdx > -1 ? cellTextareaStyle : headerTextareaStyle} />;
};

/**
 * A table with multi-line textareas that is always editable and relatively fast.
 */
const EditableTable = ({ rows, columns, handleSaveCell, handleInsertColumn, handleRemoveColumn }) => {

  const [trows, setTrows] = useState([]);
  const [thead, setThead] = useState([]);

  // Re-create the table anytime the rows or columns changes
  useEffect(() => {
    const cols = columns || [];

    setTrows(rows.map((row, rowIdx) => (
      <tr key={row.__uid}>
        {cols.map(c => {
          const txt = (c.key in row) ? row[c.key] : "";
          return (<td key={c.key}>
            <CellTextarea initialValue={txt} rowIdx={rowIdx} column={c} handleSaveCell={handleSaveCell} />
          </td>);
        })}
      </tr>
    )));

    setThead(
      <tr>
        {columns.map(c => (
          <th key={c.key} style={tableHeaderStyle}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <CellTextarea initialValue={c.header} rowIdx={-1} column={c} handleSaveCell={handleSaveCell} />
              <Menu closeOnClickOutside styles={{dropdown: {boxShadow: '1px 1px 4px #ccc'}}}>
                <Menu.Target>
                  <IconDots size='12pt' className='table-col-edit-btn' />
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item key='rename_col'><IconPencil size='10pt' />&nbsp;Rename column</Menu.Item>
                  <Menu.Item key='insert_left' onClick={() => handleInsertColumn(c.key, -1)}><IconArrowLeft size='10pt' />&nbsp;Insert column to left</Menu.Item>
                  <Menu.Item key='insert_right' onClick={() => handleInsertColumn(c.key, 1)}><IconArrowRight size='10pt' />&nbsp;Insert column to right</Menu.Item>
                  <Menu.Item key='remove_col' onClick={() => handleRemoveColumn(c.key)}><IconX size='8pt' /> Remove column</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
          </th>
        ))}
      </tr>
    );

  }, [rows, columns]);

  return (
    <Table verticalSpacing={'0px'} highlightOnHover>
      <thead>{thead}</thead>
      <tbody>{trows}</tbody>
    </Table>
  );
};

export default EditableTable;