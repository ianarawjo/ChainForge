import React from "react";
import { Tooltip } from "@mantine/core";
import { IconQuestionMark } from "@tabler/icons-react";
import { NODE_TOOLTIPS, NODE_DOC_PATHS } from "./nodeConstants";

interface DocumentationButtonProps {
  nodeType: string;
  customUrl?: string;
  tooltip?: string;
}

const DocumentationButton: React.FC<DocumentationButtonProps> = ({
  nodeType,
  customUrl,
  tooltip,
}) => {
  const docPath = customUrl || NODE_DOC_PATHS[nodeType] || nodeType;
  const fullUrl = `https://chainforge.ai/docs/nodes/#${docPath}`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  const defaultTooltip = NODE_TOOLTIPS[nodeType] || "View documentation";
  const tooltipLabel = tooltip || defaultTooltip;

  return (
    <Tooltip
      label={tooltipLabel}
      key="docs"
      withArrow
      multiline
      width={300}
      styles={{
        tooltip: {
          whiteSpace: "normal",
          wordWrap: "break-word",
        },
      }}
    >
      <button
        onClick={handleClick}
        className="custom-button nodrag"
        style={{ border: "none", padding: "0px" }}
      >
        <IconQuestionMark
          size="12pt"
          color="gray"
          style={{ marginBottom: "-4px" }}
        />
      </button>
    </Tooltip>
  );
};

export default DocumentationButton;
