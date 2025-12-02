import React from "react";
import { Tooltip } from "@mantine/core";
import { IconQuestionMark } from "@tabler/icons-react";

interface DocumentationButtonProps {
  nodeType: string;
  customUrl?: string;
}

// Mapping from node types to documentation URL paths
const nodeTypeToDocPath: Record<string, string> = {
  prompt: "prompt-node",
  chat: "chat-turn-node",
  textfields: "textfields-node",
  csv: "random-sampling-from-a-spreadsheet",
  table: "tabular-data-node",
  chunk: "chunker-node",
  retrieval: "retrieval-node",
  rerank: "rerank-node",
  upload: "upload-node",
  simpleval: "simple-evaluator-node",
  evaluator: "code-evaluator-node",
  processor: "code-processor-nodes",
  llmeval: "llm-scorer-node",
  multieval: "multi-evaluator-node",
  vis: "vis-node",
  inspect: "inspect-node",
  script: "global-python-scripts",
  join: "join-node",
  split: "split-node",
  comment: "comment-node",
  media: "",
  selectvars: "",
};

const DocumentationButton: React.FC<DocumentationButtonProps> = ({
  nodeType,
  customUrl,
}) => {
  const docPath = customUrl || nodeTypeToDocPath[nodeType] || nodeType;
  const fullUrl = `https://chainforge.ai/docs/nodes/#${docPath}`;

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
