/**
 * The base class for every node in ChainForge.
 * Used to wrap common behavior like right-click context menu.
 */

import { useCallback, useMemo, useState, useRef } from "react";
import { Menu } from '@mantine/core';
import { IconCopy, IconX } from '@tabler/icons-react';
import AreYouSureModal from "./AreYouSureModal";
import useStore from './store';

export const BaseNode = ({children, classNames, nodeId, style}) => {

  const removeNode = useStore((state) => state.removeNode);
  const duplicateNode = useStore((state) => state.duplicateNode);

  const [contextMenuStyle, setContextMenuStyle] = useState({left: -100, top:0});
  const [contextMenuOpened, setContextMenuOpened] = useState(false);

  // For 'delete node' confirmation popup
  const deleteConfirmModal = useRef(null);

  // Class styles for ChainForge nodes
  const classes = useMemo(() => {
    return "cfnode " + (classNames ?? ""); 
  }, [classNames]);

  // Duplicate the node
  const handleDuplicateNode = useCallback(() => {
    duplicateNode(nodeId, { x: 28, y: 28 });
  }, [nodeId, duplicateNode]);

  // Remove the node, after user confirmation dialog
  const handleRemoveNode = useCallback(() => {  
    // Open the 'are you sure' modal:
    if (deleteConfirmModal && deleteConfirmModal.current)
        deleteConfirmModal.current.trigger();
  }, [deleteConfirmModal]);

  const handleOpenContextMenu = (e) => {
    // Ignore all right-clicked elements that aren't divs:
    // (for instance, textfields should still have normal right-click)
    if (e.target.localName !== "div")
      return;

    e.preventDefault();
    setContextMenuStyle({
      dropdown: {
        position: 'absolute',
        left: e.pageX + 'px !important',
        top: e.pageY + 'px !important',
        boxShadow: '2px 2px 4px #ccc',
      }
    });
    setContextMenuOpened(true);
  };

  // A BaseNode is just a div with "cfnode" as a class, and optional other className(s) for the specific node.
  // It adds a context menu to all nodes upon right-click of the node itself (the div), to duplicate or delete the node.
  return (<div className={classes} onPointerDown={() => setContextMenuOpened(false)} onContextMenu={handleOpenContextMenu} style={style}>
    <AreYouSureModal ref={deleteConfirmModal} 
                     title="Delete node" 
                     message="Are you sure you want to delete this node? This action is irreversible." 
                     onConfirm={() => removeNode(nodeId)} />
    <Menu opened={contextMenuOpened} withinPortal={true} onChange={setContextMenuOpened} styles={contextMenuStyle}>
      {children}
      <Menu.Dropdown>
        <Menu.Item key='duplicate' onClick={handleDuplicateNode}><IconCopy size='10pt' />&nbsp;Duplicate Node</Menu.Item>
        <Menu.Item key='delete' onClick={handleRemoveNode}><IconX size='10pt' />&nbsp;Delete Node</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  </div>);
};

export default BaseNode;