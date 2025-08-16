import React, { useState, useRef, useEffect } from "react";

import Markdown, { MarkdownHooks } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkSupersub from "remark-supersub";
import rehypeStarryNight from "rehype-starry-night";
import rehypeRaw from "rehype-raw";
import { DEFAULT_ADMONITION_TYPES, remarkAdmonition } from "remark-admonition";
import "github-markdown-css/github-markdown.css";

import { Tooltip, Textarea, useMantineColorScheme } from "@mantine/core";

import useStore from "./store";
import NodeLabel from "./NodeLabelComponent";
import BaseNode from "./BaseNode";

const markdown_cheatsheet = `# Markdown Cheatsheet
## Basic Syntax
### Headers
# H1
## H2
### H3

### Emphasis
*italic* or _italic_

**bold** or __bold__

~~strikethrough~~

Superscript X^2^

### Blockquote
> blockquote

### Lists
- Unordered List
  - Nested Item
1. Ordered List
2. Second item

### Code
Inline \`code\`
\`\`\`javascript
// Code block
function greet() {
  console.log("Hello, World!");
}
\`\`\`

### Horizontal Rule
---

### Link
[Markdown Guide](https://www.markdownguide.org)

### Image
![alt text](logo192.png)

## Extended Syntax
### Table
| Syntax | Description |
| ----------- | ----------- |
| Header | Title |
| Paragraph | Text |

### Footnote
Here's a sentence with a footnote. [^1]
[^1]: This is the footnote.

### Task List
- [x] Write the press release
- [ ] Update the website

### Collapsible section
<details>
  <summary>Click to expand</summary>
  
  This is a collapsible section.
</details>
`;

export interface CommentNodeProps {
  data: {
    text: string;
    title: string;
  };
  id: string;
}

/**
 * A node without any inputs or outputs that
 * lets users write comment about their flow.
 */
const CommentNode: React.FC<CommentNodeProps> = ({ data, id }) => {
  const [value, setValue] = useState(data.text || markdown_cheatsheet);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { colorScheme } = useMantineColorScheme();

  const handleChangeComment = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const txt = evt.currentTarget.value;
    setValue(txt);
    setDataPropsForNode(id, { text: txt });
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleImportMarkdown = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt";

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const fileContent = event.target?.result as string;
        if (fileContent) {
          setValue(fileContent);
          setDataPropsForNode(id, { text: fileContent });
        }
      };
      reader.onerror = (err) => console.error("Failed to read file:", err);
      reader.readAsText(file);
    };

    input.click();
  };

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  return (
    <BaseNode classNames="comment-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Comment"}
        nodeId={id}
        icon={"✏️"}
        customButtons={[
          <Tooltip key={0} label="Accepts md, markdown and txt files">
            <button
              className="custom-button"
              key="import-data"
              onClick={handleImportMarkdown}
            >
              Import markdown file
            </button>
          </Tooltip>,
        ]}
      />
      <div
        className="inspect-response-container nowheel nodrag"
        style={{ marginTop: "-8pt" }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChangeComment}
            onBlur={handleBlur}
            placeholder="Start typing your markdown text here..."
            className="nodrag"
            autosize
            minRows={2}
            styles={{
              input: {
                border: "none",
                backgroundColor: colorScheme === "dark" ? "#222" : "#eee",
                color: colorScheme === "dark" ? "white" : "black",
              },
            }}
          />
        ) : (
          <div className="markdown-body" data-theme={colorScheme}>
            <MarkdownHooks
              rehypePlugins={[rehypeRaw, rehypeStarryNight]}
              remarkPlugins={[remarkGfm, remarkSupersub, remarkAdmonition]}
            >
              {value || markdown_cheatsheet}
            </MarkdownHooks>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default CommentNode;
