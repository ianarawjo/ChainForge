import React, { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { Handle } from 'react-flow-renderer';
import { Menu, Textarea } from '@mantine/core';
import EditableTable from './EditableTable';
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

  const tableRef = useRef(null);

  const [tableData, setTableData] = useState(testData || []);
  const [tableColumns, setTableColumns] = useState(testColumns || []);
  const [templateVars, setTemplateVars] = useState(['First Name', 'Last Name']);

  const [contextMenuPos, setContextMenuPos] = useState({left: -100, top:0});
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [selectedRow, setSelectedRow] = useState(undefined);

  const [scrollToBottom, setScrollToBottom] = useState(false);

  // Dynamically update the position of the template hooks
  const ref = useRef(null);
  const [hooksY, setHooksY] = useState(120);

  const handleSaveCell = useCallback((cell, value) => {
    console.log(`there are ${tableData.length} rows in table`);
    console.log('saving cell', cell.row.index, cell.column.id);
    tableData[cell.row.index][cell.column.id] = value;
    setTableData([...tableData]); //re-render with new data
  }, [tableData]);

  // Adds a new row to the table
  const handleAddRow = useCallback(() => {
    // Creates a blank row with the same columns as the table
    const blank_row = {};
    tableColumns.forEach(o => {
      blank_row[o.accessorKey] = '';
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
      accessorKey: uid,
      header: 'New Column',  // default name
    };

    // Insert the new column into the columns array
    const startColIdx = tableColumns.findIndex((elem) => elem.accessorKey === startColKey);
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
    const colIdx = tableColumns.findIndex((elem) => elem.accessorKey === colKey);
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

    const print_firstnames = (data) => {
      data.forEach((row, idx) => {
        console.log(idx.toString() + ' ' + row.firstName);
      });
    };

    // Remove the select row
    console.log('deleting row', tableData[selectedRow-1].firstName);
    tableData.splice(selectedRow-1, 1);
    console.log(`there are now ${tableData.length} rows of the table`);

    // Save state
    setTableData([...tableData]);
  }, [tableData, selectedRow, tableRef]);

  // Scrolls to bottom of the table when scrollToBottom toggle is true
  useEffect(() => {
    if (scrollToBottom) {
      if (ref.current)
        ref.current.scrollTop = ref.current.scrollHeight;
      setScrollToBottom(false);
    }
  }, [scrollToBottom]);

  // const renderCellTextarea = 

  // Set table column custom editing textareas
  useEffect(() => {
    let cols = [...tableColumns];
    cols.forEach(c => {
      c.Cell = ({cell}) => {
        return <CellTextarea cell={cell} handleSaveCell={handleSaveCell} />;
        // return <Textarea autosize={true} 
        //                  value={cell.getValue()}
        //                  onChange={(e) => handleSaveCell(cell, e.currentTarget.value)} 
        //                  minRows={1} 
        //                  maxRows={4} 
        //                  styles={cellTextareaStyle} />
      };
    });
    setTableColumns(cols);
  }, [handleSaveCell]);

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
          <Menu.Item><IconArrowBarToUp size='10pt' /> Insert Row Above</Menu.Item>
          <Menu.Item><IconArrowBarToDown size='10pt' /> Insert Row Below</Menu.Item>
          <Menu.Item onClick={handleRemoveRow}><IconX size='8pt' /> Delete row</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <div ref={setRef} className='tabular-data-container nowheel nodrag' onPointerDown={() => setContextMenuOpened(false)} onContextMenu={(e) => {

        e.preventDefault();

        if (e.target.localName === 'textarea') {
          setContextMenuPos({
            left: e.pageX,
            top: e.pageY
          });
          setContextMenuOpened(true);

          // Some really sketchy stuff to get the row index....
          // :: We've clicked on an 'input' element. We know that there is a 'td' element 3 levels up, and a 'tr' 4 levels up.
          // :: NOTE: We can also get the cell clicked on with e.target.parentNode?.parentNode?.parentNode?.cellIndex.
          const rowIndex = e.target.parentNode?.parentNode?.parentNode?.parentNode?.rowIndex;
          setSelectedRow(rowIndex);
        }
        
      }}>
        <MantineReactTable
          tableInstanceRef={tableRef}
          columns={tableColumns}
          data={tableData}
          // editingMode="cell"
          enableColumnResizing
          enableEditing
          enableBottomToolbar={false}
          enableTopToolbar={false}
          enablePagination={false}
          enableRowActions={false}
          enableSorting={false}

          renderColumnActionsMenuItems={({column, table}) => {
            const colkey = column.id;
            return [
              <Menu.Item key='rename_col'><IconPencil size='10pt' />&nbsp;Rename column</Menu.Item>,
              <Menu.Item key='insert_left' onClick={() => handleInsertColumn(colkey, -1)}><IconArrowLeft size='10pt' />&nbsp;Insert column to left</Menu.Item>,
              <Menu.Item key='insert_right' onClick={() => handleInsertColumn(colkey, 1)}><IconArrowRight size='10pt' />&nbsp;Insert column to right</Menu.Item>,
              <Menu.Item key='remove_col' onClick={() => handleRemoveColumn(colkey)}><IconX size='8pt' /> Remove column</Menu.Item>
            ];
          }}

          state={{
            density: 'xs',
            columnOrder: tableColumns.map(c => c.accessorKey),
          }}

          mantinePaperProps={{
            sx: {
              border: '0 !important',
              boxShadow: 'none',
            }
          }}
          mantineTopToolbarProps={{
            sx: {
              '& div': {
                padding: '0px',
                margin: '0px'
              }
            }
          }}
          // mantineEditTextInputProps={({ cell }) => ({
          //   //onBlur is more efficient, but could use onChange instead
          //   onBlur: (event) => {
          //     handleSaveCell(cell, event.target.value);
          //   },
          //   onChange: (event) => {
          //     console.log('on edit text change');
          //   },
          //   variant: 'filled',
          // })}

          mantineTableHeadProps={{
            sx: {
              '& tr th': {
                padding: '0rem 0.625rem 0.3rem 0.625rem !important'
              }
            },
          }}

          // Set the style of individual cells in the table
          mantineTableBodyProps={{
            sx: {  
              // '& tr td': {   // For editingMode="cell"
              //   padding: '2px !important',  //Unfortunately we need to mark this as !important to get it to work
              //   fontFamily: 'monospace',
              //   fontSize: '10pt !important',
              //   height: '12pt',
              //   minHeight: '10pt',
              //   margin: '0px',
              //   backgroundColor: '#fff',
              //   overflowWrap: 'break-word',
              //   whiteSpace: 'pre-wrap',
              //   textTransform: 'none'
              // }
              '& tr td': {   // For when editingMode="table"
                padding: '2px !important',  //Unfortunately we need to mark this as !important to get it to work
              },
              '& tr td div input': {   
                fontFamily: 'monospace',
                fontSize: '10pt',
                padding: '2px',
                height: '12pt',
                minHeight: '10pt',
                margin: '0px',
                backgroundColor: '#fff',
                overflowWrap: 'break-word',
                whiteSpace: 'pre-wrap',
              }
            }
          }}
        />
      </div>

      <div className="add-table-row-btn">
        <button onClick={handleAddRow}>add row +</button>
      </div>

      <TemplateHooks vars={templateVars} nodeId={id} startY={hooksY} position='right' />
      
      {/* <Handle
        type="source"
        position="right"
        id="output"
        style={{ top: "50%", background: '#555' }}
      /> */}
    </div>
  );
};

export default TabularDataNode;