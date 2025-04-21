import React, { useMemo } from "react";
import { Button, Tooltip } from "@mantine/core";
import {
  IconSearch,
  IconSquareArrowLeft,
  IconSquareArrowRight,
} from "@tabler/icons-react";

export interface InspectFooterProps {
  onClick: () => void;
  showDrawerButton: boolean;
  onDrawerClick: () => void;
  isDrawerOpen: boolean;
  showNotificationDot?: boolean;
  label?: React.ReactNode;
}

/**
 * The footer at the bottom of a node, allowing a user to click it
 * to inspect responses.
 */
const InspectFooter: React.FC<InspectFooterProps> = ({
  label,
  onClick,
  showDrawerButton,
  onDrawerClick,
  isDrawerOpen,
  showNotificationDot,
}) => {
  const text = useMemo(
    () =>
      label ?? (
        <>
          Inspect responses&nbsp;
          <IconSearch size="12pt" />
        </>
      ),
    [label],
  );
  const inspectBtnWidth = useMemo(
    () => (showDrawerButton ? "84%" : "100%"),
    [showDrawerButton],
  );
  const drawerBtn = useMemo(() => {
    if (showDrawerButton)
      return (
        <Tooltip
          label={`${isDrawerOpen ? "Close" : "Open"} inspector drawer`}
          position="bottom"
          withArrow
          withinPortal
        >
          <Button
            color="blue"
            variant="subtle"
            w="16%"
            p="0px"
            onClick={onDrawerClick}
            style={{
              borderRadius: "0px",
              borderLeft: "1px solid #bdf",
              cursor: "pointer",
            }}
          >
            {isDrawerOpen ? (
              <IconSquareArrowLeft size="12pt" style={{ flexShrink: "0" }} />
            ) : (
              <IconSquareArrowRight size="12pt" style={{ flexShrink: "0" }} />
            )}
          </Button>
        </Tooltip>
      );
    else return undefined;
  }, [showDrawerButton, onDrawerClick, isDrawerOpen]);

  return (
    <div
      className="eval-inspect-response-footer nodrag"
      style={{ display: "flex", justifyContent: "center" }}
    >
      <Tooltip
        label="Open fullscreen inspector"
        position="bottom"
        withArrow
        withinPortal
      >
        <Button
          color="blue"
          variant="subtle"
          w={inspectBtnWidth}
          onClick={onClick}
        >
          {text}
          {showNotificationDot ? (
            <div className="something-changed-circle"></div>
          ) : (
            <></>
          )}
        </Button>
      </Tooltip>
      {drawerBtn}
    </div>
  );
};

export default InspectFooter;
