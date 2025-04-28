import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import { v4 as uuid } from "uuid";
import { Button, Group, Text, Box, List, ThemeIcon } from "@mantine/core";
import { IconUpload, IconTrash } from "@tabler/icons-react";
import useStore from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { AlertModalContext } from "./AlertModal";
import { Status } from "./StatusIndicatorComponent";
import { TemplateVarInfo } from "./backend/typing";
import { FLASK_BASE_URL } from "./backend/utils";

interface UploadNodeProps {
  data: {
    title: string;
    fields: TemplateVarInfo[];
    refresh: boolean;
  };
  id: string;
}

const UploadNode: React.FC<UploadNodeProps> = ({ data, id }) => {
  const nodeIcon = useMemo(() => "📁", []);
  const nodeDefaultTitle = useMemo(() => "Upload Node", []);
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const [fields, setFields] = useState<TemplateVarInfo[]>(data.fields || []);
  const [status, setStatus] = useState<Status>(Status.READY);

  const [fileListCollapsed, setFileListCollapsed] = useState(true);
  const toggleFileList = () => setFileListCollapsed((prev) => !prev);

  const showAlert = useContext(AlertModalContext);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle file uploads
  const handleFilesUpload = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return;

      setStatus(Status.LOADING);
      const updatedFields = [...fields];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch(`${FLASK_BASE_URL}/upload`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to process file");
          }

          const json = await res.json();
          const textContent = json.text || "";

          // Add filename + text content as a new TemplateVarInfo
          updatedFields.push({
            text: textContent,
            prompt: "",
            fill_history: {},
            llm: undefined,
            metavars: {
              size: file.size.toString(),
              type: file.type,
              filename: file.name, // important: store doc name
              id: uuid(),
            },
          });
        } catch (error: any) {
          console.error("Error uploading file:", error);
          showAlert?.(`Error uploading ${file.name}: ${error.message}`);
          setStatus(Status.ERROR);
        }
      }

      setFields(updatedFields);

      // Also set the node's output for the flow
      setDataPropsForNode(id, { fields: updatedFields, output: updatedFields });
      setStatus(Status.READY);
    },
    [fields, id, setDataPropsForNode, showAlert],
  );

  // On file input change
  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files) {
      handleFilesUpload(event.target.files);
      event.target.value = "";
    }
  };

  // Drag & drop
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      handleFilesUpload(event.dataTransfer.files);
    }
  };
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  // Remove a file
  const handleRemoveFile = (index: number) => {
    const updatedFields = fields.filter((_, i) => i !== index);
    setFields(updatedFields);
    setDataPropsForNode(id, { fields: updatedFields, output: updatedFields });
  };

  // Clear all
  const handleClearUploads = useCallback(() => {
    setFields([]);
    setDataPropsForNode(id, { fields: [], output: [] });
    setStatus(Status.READY);
  }, [id, setDataPropsForNode]);

  // Refresh logic
  useEffect(() => {
    if (data.refresh) {
      handleClearUploads();
      setDataPropsForNode(id, { refresh: false });
    }
  }, [data.refresh, handleClearUploads, id, setDataPropsForNode]);

  return (
    <BaseNode classNames="upload-node" nodeId={id}>
      <NodeLabel
        title={data.title || nodeDefaultTitle}
        nodeId={id}
        icon={nodeIcon}
        status={status}
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: "2px dashed #ccc",
          borderRadius: "8px",
          padding: "20px",
          textAlign: "center",
          margin: "10px",
          backgroundColor: "#f9f9f9",
          cursor: "pointer",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <IconUpload size={40} color="#888" />
        <Text size="sm" color="dimmed">
          Drag & drop files here or click to upload
        </Text>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ top: "50%" }}
      />

      <Box mt="sm">
        <Group position="apart" mb="xs">
          <Text size="sm" weight={500}>
            Uploaded Files ({fields.length})
          </Text>
          {fields.length > 0 && (
            <Button size="xs" variant="light" compact onClick={toggleFileList}>
              {fileListCollapsed ? "Show Files ▼" : "Hide Files ▲"}
            </Button>
          )}
        </Group>

        {!fileListCollapsed && fields.length > 0 && (
          <Box
            style={{
              maxHeight: 200,
              maxWidth: 290, // this is a magic number, but it works for now to keep the node's width when expanded, must be fixed later
              overflowY: "auto",
              overflowX: "auto",
              border: "1px solid #eee",
              borderRadius: "8px",
              padding: "8px",
              background: "#fafafa",
            }}
          >
            <List spacing="xs" size="sm">
              {fields.map((field, index) => (
                <List.Item
                  key={field.metavars?.id}
                  icon={
                    <ThemeIcon color="blue" size={20} radius="xl">
                      📄
                    </ThemeIcon>
                  }
                >
                  <Group position="apart">
                    <Box>
                      <Text size="sm" weight={500}>
                        {field.metavars?.filename || "Untitled file"}
                      </Text>
                      {field.text && typeof field.text === "string" && (
                        <Text size="xs" color="dimmed">
                          {field.text.slice(0, 50)}
                          {field.text.length > 50 ? "..." : ""}
                        </Text>
                      )}
                    </Box>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() => handleRemoveFile(index)}
                      compact
                    >
                      <IconTrash size="14" />
                    </Button>
                  </Group>
                </List.Item>
              ))}
            </List>
          </Box>
        )}
      </Box>
    </BaseNode>
  );
};

export default UploadNode;
