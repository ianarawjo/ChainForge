import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, Tooltip } from '@mantine/core';
import EditableTable from './EditableTable';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { IconX, IconArrowBarToUp, IconArrowBarToDown } from '@tabler/icons-react';
import TemplateHooks from './TemplateHooksComponent';
import BaseNode from './BaseNode';
import NodeLabel from './NodeLabelComponent';
import AlertModal from './AlertModal';
import RenameValueModal from './RenameValueModal';
import useStore from './store';

const defaultRows = [
  {
    question: 'What is 2+2?',
    answer: '4',
  },
  {
    question: '',
    answer: '',
  },
];

const defaultColumns = [
    {
      key: 'question',
      header: 'Question',
    },
    {
      key: 'answer',
      header: 'Expected',
    },
];

const TabularDataNode = ({ data, id }) => {

  const [tableData, setTableData] = useState(data.rows || [...defaultRows].map(row => {
    return {__uid: uuidv4(), ...row};
  }));
  const [tableColumns, setTableColumns] = useState(data.columns || [...defaultColumns].map(col => {
    return {...col};
  }));
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const pingOutputNodes = useStore((state) => state.pingOutputNodes);

  const [contextMenuPos, setContextMenuPos] = useState({left: -100, top:0});
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [selectedRow, setSelectedRow] = useState(undefined);

  const [scrollToBottom, setScrollToBottom] = useState(false);

  // Dynamically update the position of the template hooks
  const ref = useRef(null);
  const [hooksY, setHooksY] = useState(120);

  // For displaying error messages to user
  const alertModal = useRef(null);

  // For renaming a column
  const renameColumnModal = useRef(null);
  const [renameColumnInitialVal, setRenameColumnInitialVal] = useState("");

  const handleSaveCell = useCallback((rowIdx, columnKey, value) => {
    pingOutputNodes(id);
    if (rowIdx === -1) {
      // Saving the column header
      setTableColumns(tableColumns.map(col => {
        if (col.key === columnKey)
          col.header = value;
        return col;
      }));
      return;
    }
    console.log('handleSaveCell', rowIdx, columnKey, value);
    tableData[rowIdx][columnKey] = value;
    setTableData([...tableData]);
  }, [tableData, tableColumns, pingOutputNodes]);

  // Adds a new row to the table
  const handleAddRow = useCallback(() => {
    // Creates a blank row with the same columns as the table
    const blank_row = {__uid: uuidv4()};
    tableColumns.forEach(o => {
      blank_row[o.key] = '';
    });

    // Adds the row to the table
    tableData.push(blank_row);
    setTableData([...tableData]);

    // Pings the effect handler to scroll down to the bottom of the table,
    // so the user can see the new row. 
    setScrollToBottom(true);
  }, [tableColumns, tableData, ref]);

  // Inserts a column to left or right of existing one
  const handleInsertColumn = useCallback((startColKey, dir) => {
    // Create a unique ID to refer to this new column
    const uid = `col-${Date.now()}`;
    const new_col = {
      key: uid,
      header: 'New Column',  // default name
    };

    // Insert the new column into the columns array
    const startColIdx = tableColumns.findIndex((elem) => elem.key === startColKey);
    if (dir === -1)
      tableColumns.splice(startColIdx, 0, new_col);
    else if (dir === 1)
      tableColumns.splice(Math.min(startColIdx+1, tableColumns.length), 0, new_col);

    // Set blank values at that column for each row of the table
    tableData.forEach(row => {
      row[uid] = "";
    });

    // Update React state
    setTableColumns([...tableColumns]);
    setTableData([...tableData]);
  }, [tableColumns, tableData]);

  // Removes a column
  const handleRemoveColumn = useCallback((colKey) => {
    // Find the index of the column
    const colIdx = tableColumns.findIndex((elem) => elem.key === colKey);
    if (colIdx === -1) {
      console.error(`Could not find a column with key ${colKey} in the table.`);
      return;
    }

    // Remove the column from the list
    tableColumns.splice(colIdx, 1);

    // Remove all data associated with that column from the table row data
    tableData.forEach(row => {
      if (colKey in row)
        delete row[colKey];
    });

    setTableColumns([...tableColumns]);
    setTableData([...tableData]);
    pingOutputNodes(id);
  }, [tableColumns, tableData, pingOutputNodes]);

  // Opens a modal popup to let user rename a column
  const openRenameColumnModal = useCallback((col) => {
    setRenameColumnInitialVal(col);
    if (renameColumnModal && renameColumnModal.current)
      renameColumnModal.current.trigger();
  }, [renameColumnModal]);

  const handleRenameColumn = useCallback((new_header) => {
    if (typeof renameColumnInitialVal !== 'object') {
      console.error('Initial column value was not set.');
      return;
    }
    const new_cols = tableColumns.map(c => {
      if (c.key === renameColumnInitialVal.key)
        c.header = new_header;
      return c;
    });
    setTableColumns([...new_cols]);
    pingOutputNodes(id);
  }, [tableColumns, renameColumnInitialVal, pingOutputNodes]);

  // Removes a row of the table, at <table> index 'selectedRow'
  const handleRemoveRow = useCallback(() => {
    if (!selectedRow) {
      console.warn('No row selected to remove.');
      return; 
    }

    // Remove the select row
    tableData.splice(selectedRow-1, 1);

    // Save state
    setTableData([...tableData]);
  }, [tableData, selectedRow]);

  // Removes a row of the table, at <table> index 'selectedRow'
  const handleInsertRow = useCallback((offset) => {
    if (!selectedRow) {
      console.warn('No row selected to insert from.');
      return; 
    }

    const insertIdx = selectedRow + offset;

    // Creates a blank row with the same columns as the table
    const blank_row = {__uid: uuidv4()};
    tableColumns.forEach(o => {
      blank_row[o.key] = '';
    });

    // Adds the row to the table at the requested position
    let new_rows = tableData.slice(0, insertIdx).concat([blank_row], tableData.slice(insertIdx));

    // Save state
    setTableData([...new_rows]);
  }, [tableData, tableColumns, selectedRow]);

  // Opens a context window inside the table
  // Currently only opens if a row cell textarea was right-clicked. 
  // TODO: Improve this to work on other parts of the table too (e.g., column headers and between rows)
  const handleOpenTableContextMenu = (e) => {
    e.preventDefault();

    if (e.target.localName === 'p') {
      // Some really sketchy stuff to get the row index....
      // :: We've clicked on an 'input' element. We know that there is a 'td' element 1 level up, and a 'tr' 2 levels up.
      const grandparent = e.target.parentNode?.parentNode;
      const rowIndex = grandparent?.rowIndex;
      const cellIndex = grandparent?.cellIndex;
      if (rowIndex !== undefined) {  // A cell of the table was right-clicked on
        setSelectedRow(rowIndex);
        setContextMenuPos({
          left: e.pageX,
          top: e.pageY
        });
        setContextMenuOpened(true);
      } else if (cellIndex !== undefined) { // A column header was right-clicked on
        setSelectedRow(undefined);
      }
    }
  };

  // Import list of JSON data to the table
  // NOTE: JSON objects should be in row format, with keys 
  //       as the header names. The internal keys of the columns will use uids to be unique. 
  const importJSONList = (jsonl) => {
    if (!Array.isArray(jsonl)) {
      throw new Error("Imported tabular data is not in array format: " + jsonl.toString())
    }

    // Extract unique column names
    let headers = new Set();
    jsonl.forEach(o => Object.keys(o).forEach(key => headers.add(key)));

    // Create new columns with unique ids c0, c1 etc
    let cols = Array.from(headers).map((h, idx) => ({
      header: h, key: `c${idx.toString()}`
    }));

    // Construct a lookup table from header name to our new key uid
    let col_key_lookup = {};
    cols.forEach(c => {
      col_key_lookup[c.header] = c.key;
    });

    // Construct the table rows by swapping the header names for our new columm keys
    let rows = jsonl.map(o => {
      let row = { __uid: uuidv4() };
      Object.keys(o).forEach(header => {
        const raw_val = o[header];
        const val = typeof raw_val === 'object' ? JSON.stringify(raw_val) : raw_val;
        row[col_key_lookup[header]] = val;
      })
      return row;
    });

    // Save the new columns and rows
    setTableColumns(cols);
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

    const parseJSONL = (txt) => {
      return txt.trim().split('\n').map((line) => JSON.parse(line));
    };

    // Handle file selection
    input.addEventListener("change", function(event) {

      const file = event.target.files[0];
      const reader = new FileReader();

      // Extract the file extension from the file name
      const extension = file.name.split('.').pop();

      // Handle file load event
      reader.addEventListener("load", function() {
        try {
          // Try to parse the file using the appropriate file reader
          let jsonl = null;
          switch (extension) {

            case 'jsonl':
              // Should be a newline-separated list of JSON objects, e.g. {}\n{}\n{}
              // Split the result on newlines and JSON parse individual lines: 
              jsonl = parseJSONL(reader.result);
              // Load the JSON list into the table
              importJSONList(jsonl);
              break;

            case 'json':
              // Should be a list of JSON objects, e.g. in format [{...}]
              try {
                jsonl = JSON.parse(reader.result);
              } catch (error) {
                // Just in case, try to parse it as a JSONL file instead...
                jsonl = parseJSONL(reader.result);
              }
              importJSONList(jsonl);
              break;

            case 'xlsx':
              // Parse data using XLSX
              const wb = XLSX.read(reader.result, { type:'binary' });
              // Extract the first worksheet
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              // Convert to JSON list format, assuming the first row is a 'header':
              jsonl = XLSX.utils.sheet_to_json(ws);
              // Load the JSON list into the table
              importJSONList(jsonl);
              break;

            case 'csv':
              // Parse the CSV string to a list,
              // assuming the first row is a header
              const papa_parsed = Papa.parse(reader.result, {header: true});
              importJSONList(papa_parsed.data);
              break;

            default:
              throw new Error(`Unknown file extension: ${extension}`)
          }
        } catch (error) {
          handleError(error);
        }
      });

      // Read the selected file using the appropriate reader
      if (extension === 'xlsx' || extension === 'xls')
        reader.readAsBinaryString(file);
      else reader.readAsText(file);
    });

    // Trigger the file selector
    input.click();
  };

  // Scrolls to bottom of the table when scrollToBottom toggle is true
  useEffect(() => {
    if (scrollToBottom) {
      if (ref.current)
        ref.current.scrollTop = ref.current.scrollHeight;
      setScrollToBottom(false);
    }
  }, [scrollToBottom]);

  // Updates the internal data store whenever the table data changes
  useEffect(() => {
    setDataPropsForNode(id, { rows: tableData, columns: tableColumns });
  }, [tableData, tableColumns]);

  const handleError = (err) => {
    if (alertModal.current)
      alertModal.current.trigger(err.message);
    console.error(err.message);
  };

  // To listen for resize events of the table container, we need to use a ResizeObserver.
  // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div container.
  const setRef = useCallback((elem) => {
    if (!ref.current && elem && window.ResizeObserver) {
      let past_hooks_y = 120;
      const observer = new ResizeObserver(() => {
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
  }, [ref]);

  return (
    <BaseNode classNames="tabular-data-node" nodeId={id} onPointerDown={() => setContextMenuOpened(false)}>
      <NodeLabel title={data.title || 'Tabular Data Node'} 
                 nodeId={id} 
                 icon={'🗂️'}
                 customButtons={[
                  <Tooltip label="Accepts xlsx, jsonl, and csv files with a header row">
                    <button className="custom-button" key="import-data" onClick={openImportFileModal}>Import data</button>
                  </Tooltip>
                 ]} />
      
      <AlertModal ref={alertModal} />

      <RenameValueModal ref={renameColumnModal} 
                        initialValue={(typeof renameColumnInitialVal === 'object') ? renameColumnInitialVal.header : ""} 
                        title="Rename column"
                        label="New column name" 
                        onSubmit={handleRenameColumn} />

      <Menu opened={contextMenuOpened} withinPortal={true} onChange={setContextMenuOpened} styles={{
        dropdown: {
          position: 'absolute',
          left: contextMenuPos.left + 'px !important',
          top: contextMenuPos.top + 'px !important',
          boxShadow: '2px 2px 4px #ccc',
        }
      }}>
        <Menu.Dropdown>
          <Menu.Item onClick={() => handleInsertRow(-1)}><IconArrowBarToUp size='10pt' /> Insert Row Above</Menu.Item>
          <Menu.Item onClick={() => handleInsertRow(0)}><IconArrowBarToDown size='10pt' /> Insert Row Below</Menu.Item>
          <Menu.Item onClick={handleRemoveRow}><IconX size='8pt' /> Delete row</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <div ref={setRef} className='tabular-data-container nowheel nodrag' onPointerDown={() => setContextMenuOpened(false)} onContextMenu={handleOpenTableContextMenu} >
        <EditableTable rows={tableData} columns={tableColumns} handleSaveCell={handleSaveCell} handleRemoveColumn={handleRemoveColumn} handleInsertColumn={handleInsertColumn} handleRenameColumn={openRenameColumnModal} />
      </div>

      <div className="tabular-data-footer">
        <div className="add-table-row-btn">
          <button onClick={handleAddRow}>add row +</button>
        </div>
        
        <TemplateHooks vars={tableColumns.map(col => col.header)} nodeId={id} startY={hooksY} position='right' />
      </div>
      
    </BaseNode>
  );
};

export default TabularDataNode;