import React, { useState, useRef, useEffect, useCallback, forwardRef, useId } from 'react';
import { Handle } from 'react-flow-renderer';
import { Menu, Textarea } from '@mantine/core';
import EditableTable from './EditableTable';
import { v4 as uuidv4 } from 'uuid';
import { IconPencil, IconArrowLeft, IconArrowRight, IconX, IconArrowBarToUp, IconArrowBarToDown } from '@tabler/icons-react';
import TemplateHooks from './TemplateHooksComponent';
import NodeLabel from './NodeLabelComponent';

const testData = [
  {
    firstName: 'Dylan',
    lastName: 'Murray',
    address: '261 Erdman Ford',
    city: 'East Daphne',
    state: 'Kentucky',
  },
  {
    firstName: 'Raquel',
    lastName: 'Kohler',
    address: '769 Dominic Grove',
    city: 'Columbus',
    state: 'Ohio',
  },
  {
    firstName: 'Ervin',
    lastName: 'Reinger',
    address: '566 Brakus Inlet',
    city: 'South Linda',
    state: 'West Virginia',
  },
  {
    firstName: 'Brittany',
    lastName: 'McCullough',
    address: '722 Emie Stream',
    city: 'Lincoln',
    state: 'Nebraska',
  },
  {
    firstName: 'Branson',
    lastName: 'Frami',
    address: '32188 Larkin Turnpike',
    city: 'Charleston',
    state: 'South Carolina',
  },
];
const testColumns = [
    //column definitions...
    {
      key: 'firstName',
      header: 'First Name',
    },
    {
      key: 'lastName',
      header: 'Last Name',
    },

    {
      key: 'address',
      header: 'Address',
    },
    {
      key: 'city',
      header: 'City',
    },
    {
      key: 'state',
      header: 'State',
    }, //end
];

const TabularDataNode = ({ data, id }) => {

  const [tableData, setTableData] = useState([...testData].map(row => {
    row.__uid = uuidv4();
    return row;
  }));
  const [tableColumns, setTableColumns] = useState([...testColumns]);
  const [templateVars, setTemplateVars] = useState(['First Name', 'Last Name']);

  const [contextMenuPos, setContextMenuPos] = useState({left: -100, top:0});
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [selectedRow, setSelectedRow] = useState(undefined);

  const [scrollToBottom, setScrollToBottom] = useState(false);

  // Dynamically update the position of the template hooks
  const ref = useRef(null);
  const [hooksY, setHooksY] = useState(120);

  const handleSaveCell = useCallback((rowIdx, columnKey, value) => {
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
  }, [tableData, tableColumns]);

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
  }, [tableColumns, tableData]);

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

  // Scrolls to bottom of the table when scrollToBottom toggle is true
  useEffect(() => {
    if (scrollToBottom) {
      if (ref.current)
        ref.current.scrollTop = ref.current.scrollHeight;
      setScrollToBottom(false);
    }
  }, [scrollToBottom]);

  // To listen for resize events of the table container, we need to use a ResizeObserver.
  // We initialize the ResizeObserver only once, when the 'ref' is first set, and only on the div container.
  const setRef = useCallback((elem) => {
    if (!ref.current && elem && window.ResizeObserver) {
      let past_hooks_y = 120;
      const observer = new ResizeObserver(() => {
        if (!ref || !ref.current) return;
        const new_hooks_y = ref.current.clientHeight + 100;
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
    <div className="tabular-data-node cfnode" onPointerDown={() => setContextMenuOpened(false)}>
      <NodeLabel title={data.title || 'Tabular Data Node'} nodeId={id} icon={'🗂️'} />
      
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

      <div ref={setRef} className='tabular-data-container nowheel nodrag' onPointerDown={() => setContextMenuOpened(false)} onContextMenu={(e) => {
        e.preventDefault();

        if (e.target.localName === 'textarea') {
          // Some really sketchy stuff to get the row index....
          // :: We've clicked on an 'input' element. We know that there is a 'td' element 3 levels up, and a 'tr' 4 levels up.
          // :: NOTE: We can also get the cell clicked on with e.target.parentNode?.parentNode?.parentNode?.cellIndex.
          const grandparent = e.target.parentNode?.parentNode?.parentNode?.parentNode;
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
      }} >
        <EditableTable rows={tableData} columns={tableColumns} handleSaveCell={handleSaveCell} handleRemoveColumn={handleRemoveColumn} handleInsertColumn={handleInsertColumn} />
      </div>

      <div className="add-table-row-btn">
        <button onClick={handleAddRow}>add row +</button>
      </div>

      <TemplateHooks vars={templateVars} nodeId={id} startY={hooksY} position='right' />
    </div>
  );
};

export default TabularDataNode;