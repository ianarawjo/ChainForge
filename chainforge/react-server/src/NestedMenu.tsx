import React, { ReactNode, useMemo, useState } from "react";
import { Menu, Tooltip, Popover, ActionIcon } from "@mantine/core";
import { IconChevronRight, IconTrash } from "@tabler/icons-react";
import { ContextMenuItemOptions } from "mantine-contextmenu/dist/types";

const NESTED_MENU_STYLE = {
  dropdown: { padding: "0px !important" },
  item: { padding: "6px 8px 6px 12px" },
};

export const MenuTooltip = ({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) => {
  if (!label) return <>{children}</>;
  else
    return (
      <Tooltip
        label={label}
        position="right"
        width={200}
        multiline
        withArrow
        arrowSize={10}
      >
        {children}
      </Tooltip>
    );
};

export type NestedMenuItemProps = ContextMenuItemOptions & {
  tooltip?: string;
  onTrash?: (closeMenu: () => void) => void;
};

export default function NestedMenu({
  items,
  button,
}: {
  items: NestedMenuItemProps[];
  button: (closeMenu: () => void) => ReactNode;
}) {
  const [menuOpened, setMenuOpened] = useState(false);
  const [submenusOpened, setSubmenusOpened] = useState<string[] | null>(null);
  const openSubmenu = (key: string) => {
    if (submenusOpened) {
      setSubmenusOpened((prev) => [...(prev as string[]), key]);
    } else {
      setSubmenusOpened([key]);
    }
  };
  const closeSubmenu = (key: string) => {
    if (submenusOpened) {
      setSubmenusOpened((prev) => (prev as string[]).filter((k) => k !== key));
    }
  };

  const menuItemInfoToMenuItem = (
    item: NestedMenuItemProps,
    showChevron: boolean,
    idx: number,
  ) => {
    if (!item.items && !item.onClick) {
      if (item.key === "divider")
        // If the item is a divider, show it as a divider
        return <Menu.Divider key={`divider-${idx}`} />;
      else
        return (
          <Menu.Label key={item.key} pb={2}>
            {item.title ?? item.key}
          </Menu.Label>
        );
    }
    return (
      <MenuTooltip label={item.tooltip} key={item.key}>
        <Menu.Item
          icon={item.icon}
          rightSection={
            item.onTrash ? (
              <ActionIcon
                ml="sm"
                color="red"
                p={0}
                size={16}
                onClick={(evt) => {
                  evt.stopPropagation();
                  if (item.onTrash) item.onTrash(() => setMenuOpened(false));
                }}
              >
                <IconTrash size="10pt" />
              </ActionIcon>
            ) : showChevron ? (
              <IconChevronRight size={14} />
            ) : null
          }
          className={item.className}
          sx={item.sx}
          onClick={(evt) => {
            if (item.onClick) {
              item.onClick(evt);

              // Close the menu when an item is clicked
              setMenuOpened(false);
              setSubmenusOpened(null);
            }
          }}
        >
          {item.title}
        </Menu.Item>
      </MenuTooltip>
    );
  };

  const menuItems = useMemo(() => {
    return items.map((item, idx) => {
      const makeMenu = (_item: NestedMenuItemProps, _idx: number) => {
        if (_item.items) {
          return (
            <Popover
              key={_item.key}
              opened={submenusOpened?.includes(_item.key)}
              position="right-start"
              shadow="md"
              withinPortal={false}
              offset={0}
            >
              <Popover.Target>
                <div
                  onMouseEnter={() => openSubmenu(_item.key)}
                  onMouseLeave={() => closeSubmenu(_item.key)}
                >
                  {menuItemInfoToMenuItem(_item, true, _idx)}
                </div>
              </Popover.Target>

              <Popover.Dropdown
                onMouseEnter={() => openSubmenu(_item.key)}
                onMouseLeave={() => closeSubmenu(_item.key)}
                p={4}
              >
                <Menu styles={NESTED_MENU_STYLE}>
                  {_item.items.map((subItem, subIdx) =>
                    makeMenu(subItem, subIdx),
                  )}
                </Menu>
              </Popover.Dropdown>
            </Popover>
          );
        } else {
          return menuItemInfoToMenuItem(_item, false, idx);
        }
      };
      return makeMenu(item, idx);
    });
  }, [items, submenusOpened]);

  return (
    <Menu
      opened={menuOpened}
      shadow="md"
      position="bottom-start"
      width={200}
      styles={NESTED_MENU_STYLE}
      offset={1}
      withinPortal
    >
      <Menu.Target>{button(() => setMenuOpened(!menuOpened))}</Menu.Target>

      <Menu.Dropdown>{menuItems}</Menu.Dropdown>
    </Menu>
  );
}
