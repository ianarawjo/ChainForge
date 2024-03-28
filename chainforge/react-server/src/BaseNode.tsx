/**
 * The base class for every node in ChainForge.
 * Used to wrap common behavior like right-click context menu.
 */

import React, { useCallback, useMemo, useState, useRef } from "react";
import { Menu, MenuStylesNames, Styles } from "@mantine/core";
import { IconCopy, IconX } from "@tabler/icons-react";
import AreYouSureModal, { AreYouSureModalRef } from "./AreYouSureModal";
import useStore from "./store";
import { Dict } from "./backend/typing";

interface BaseNodeProps {
  children: React.ReactNode; // For components, HTML elements, text, etc.
  nodeId: string;
  classNames?: string;
  style?: React.CSSProperties; // Optional prop for inline styles
  contextMenuExts?: {
    key: string;
    icon: JSX.Element;
    text: string;
    onClick: () => void;
  }[];
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  children,
  classNames,
  nodeId,
  style,
  contextMenuExts,
}) => {
  const addNode = useStore((state) => state.addNode);
  const removeNode = useStore((state) => state.removeNode);
  const duplicateNode = useStore((state) => state.duplicateNode);

  const [contextMenuStyle, setContextMenuStyle] = useState<
    Styles<MenuStylesNames>
  >({});
  const [contextMenuOpened, setContextMenuOpened] = useState(false);

  // For 'delete node' confirmation popup
  const deleteConfirmModal = useRef<AreYouSureModalRef>(null);

  // Class styles for ChainForge nodes
  const classes = useMemo(() => {
    return "cfnode " + (classNames ?? "");
  }, [classNames]);

  // Duplicate the node
  const handleDuplicateNode = useCallback(() => {
    // Duplicate this node
    const dupNode = duplicateNode(nodeId, { x: 28, y: 28 });
    // Add it to the ReactFlow canvas
    addNode(dupNode);
  }, [nodeId, duplicateNode]);

  // Remove the node, after user confirmation dialog
  const handleRemoveNode = useCallback(() => {
    // Open the 'are you sure' modal:
    if (deleteConfirmModal && deleteConfirmModal.current)
      deleteConfirmModal.current.trigger();
  }, [deleteConfirmModal]);

  const handleOpenContextMenu = (e: Dict) => {
    // Ignore all right-clicked elements that aren't children of the parent,
    // and that aren't divs (for instance, textfields should still have normal right-click)
    if (e.target?.localName !== "div") return;

    let parent = e.target?.parentElement;
    let found_cfnode = false;
    while (parent) {
      if (parent.className.startsWith("cfnode")) {
        found_cfnode = true;
        break;
      }
      parent = parent.parentElement;
    }

    // This effectively quits if the user is right-clicking in a pop-up Modal view,
    // since the pop-up Modals are not children of the BaseNode:
    if (!found_cfnode) return;

    e.preventDefault();
    setContextMenuStyle({
      dropdown: {
        position: "absolute",
        left: e.pageX + "px !important",
        top: e.pageY + "px !important",
        boxShadow: "2px 2px 4px #ccc",
      },
    });
    setContextMenuOpened(true);
  };

  // A BaseNode is just a div with "cfnode" as a class, and optional other className(s) for the specific node.
  // It adds a context menu to all nodes upon right-click of the node itself (the div), to duplicate or delete the node.
  return (
    <div
      className={classes}
      onPointerDown={() => setContextMenuOpened(false)}
      onContextMenu={handleOpenContextMenu}
      style={style}
    >
      <AreYouSureModal
        ref={deleteConfirmModal}
        title="Delete node"
        message="Are you sure you want to delete this node? This action is irreversible."
        onConfirm={() => removeNode(nodeId)}
      />
      <Menu
        opened={contextMenuOpened}
        withinPortal={true}
        onChange={setContextMenuOpened}
        styles={contextMenuStyle}
      >
        {children}
        <Menu.Dropdown>
          {contextMenuExts &&
            contextMenuExts.map(({ key, icon, text, onClick }) => (
              <Menu.Item key={key} onClick={onClick}>
                {icon}&nbsp;{text}
              </Menu.Item>
            ))}
          <Menu.Item key="duplicate" onClick={handleDuplicateNode}>
            <IconCopy size="10pt" />
            &nbsp;Duplicate Node
          </Menu.Item>
          <Menu.Item key="delete" onClick={handleRemoveNode}>
            <IconX size="10pt" />
            &nbsp;Delete Node
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
};

export default BaseNode;
