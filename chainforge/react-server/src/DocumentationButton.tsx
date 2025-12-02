import React from "react";
import { Tooltip } from "@mantine/core";
import { IconQuestionMark } from "@tabler/icons-react";

interface DocumentationButtonProps {
  nodeType: string;
  customUrl?: string;
}

// Mapping from node types to documentation URL paths
const nodeTypeToDocPath: Record<string, string> = {
  prompt: "prompt",
  chat: "prompt",
  textfields: "text-fields",
  csv: "csv",
  table: "table",
  chunk: "chunk",
  retrieval: "retrieval",
  rerank: "rerank",
  upload: "upload",
  simpleval: "simple-eval",
  evaluator: "code-evaluator",
  processor: "code-evaluator",
  llmeval: "llm-eval",
  multieval: "multi-eval",
  vis: "visualization",
  inspect: "inspect",
  script: "script",
  join: "join",
  split: "split",
  comment: "comment",
  media: "media",
  selectvars: "select-vars",
};

const DocumentationButton: React.FC<DocumentationButtonProps> = ({
  nodeType,
  customUrl,
}) => {
  const docPath = customUrl || nodeTypeToDocPath[nodeType] || nodeType;
  const fullUrl = `https://chainforge.ai/docs/nodes/${docPath}`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Tooltip label="View documentation" key="docs" withArrow>
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
