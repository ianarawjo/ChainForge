import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  useContext,
} from "react";
import { Handle, Position } from "reactflow";
import {
  Button,
  Group,
  Text,
  Box,
  List,
  ThemeIcon,
  Flex,
  ScrollArea,
} from "@mantine/core";
import { IconUpload, IconTrash } from "@tabler/icons-react";
import useStore from "./store";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import { AlertModalContext } from "./AlertModal";
import { Status } from "./StatusIndicatorComponent";
import { MediaLookup } from "./backend/cache";
import { APP_IS_RUNNING_LOCALLY } from "./backend/utils";
import { browserTextExtensions } from "./backend/extractText";
import { TemplateVarInfo } from "./backend/typing";

/** Renders a byte count as MB, for the browser storage budget readout. */
const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

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

  const [fileListCollapsed, setFileListCollapsed] = useState(
    !(data.fields && data.fields.length > 0),
  );
  const toggleFileList = () => setFileListCollapsed((prev) => !prev);

  const showAlert = useContext(AlertModalContext);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Without a local server, uploaded files live in the browser under a fixed
  // budget, so show what's being used. Meaningless when running locally
  // (files go to disk), hence the flag.
  const [storageUsage, setStorageUsage] = useState(MediaLookup.storageUsage());
  const runningLocally = APP_IS_RUNNING_LOCALLY();
  const showStorageUsage = !runningLocally;

  // With a backend, markitdown converts every format below. Without one we can
  // read text files and (via pdf.js) PDFs, but not DOCX/XLSX/PPTX -- so don't
  // offer those, since picking one would only fail after the upload.
  const acceptedExtensions = useMemo(
    () =>
      runningLocally
        ? [".pdf", ".docx", ".txt", ".md"]
        : browserTextExtensions(),
    [runningLocally],
  );
  const acceptAttr = useMemo(
    () => acceptedExtensions.join(","),
    [acceptedExtensions],
  );

  // Handle file uploads
  const handleFilesUpload = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return;

      setStatus(Status.LOADING);
      const updatedFields = [...fields];
      let anyFailed = false;

      for (const file of Array.from(files)) {
        try {
          // Upload the file to the lookup and get its UID
          const uid = await MediaLookup.upload(file);

          // Grab the content of the file, in plain text
          // TODO: Make this work on the front-end if backend is not available
          const text = await MediaLookup.getAsText(uid);

          // Add filename + text content as a new TemplateVarInfo
          updatedFields.push({
            text: text,
            prompt: "",
            fill_history: {},
            llm: undefined,
            metavars: {
              size: file.size.toString(),
              type: file.type,
              filename: file.name, // important: store doc name
              id: uid,
            },
          });
        } catch (error: any) {
          console.error("Error uploading file:", error);
          showAlert?.(`Error uploading ${file.name}: ${error.message}`);
          anyFailed = true;
        }
      }

      setFields(updatedFields);

      // Also set the node's output for the flow
      setDataPropsForNode(id, { fields: updatedFields, output: updatedFields });
      // Keep the error state visible if anything failed -- setting READY
      // unconditionally here hid it immediately.
      setStatus(anyFailed ? Status.ERROR : Status.READY);
      setStorageUsage(MediaLookup.storageUsage());
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
    const fieldToRemove = fields[index];

    // UID is stored in metavars.id, set when uploading
    const uid =
      typeof fieldToRemove?.metavars?.id === "string"
        ? fieldToRemove.metavars.id
        : undefined;

    // Remove from MediaLookup (same idea as MediaNode.handleRemoveMedia)
    if (uid) {
      try {
        MediaLookup.remove(uid);
      } catch (error) {
        console.error("Error removing file from MediaLookup:", error);
      }
    }

    // 2) Update local fields + node output
    const updatedFields = fields.filter((_, i) => i !== index);
    setFields(updatedFields);
    setDataPropsForNode(id, { fields: updatedFields, output: updatedFields });
    setStorageUsage(MediaLookup.storageUsage());
  };

  // Clear all
  const handleClearUploads = useCallback(() => {
    // Collect all UIDs before clearing
    const uidsToRemove = fields
      .map((field) =>
        typeof field.metavars?.id === "string" ? field.metavars.id : undefined,
      )
      .filter((x): x is string => !!x);

    // Remove each file from MediaLookup
    for (const uid of uidsToRemove) {
      try {
        MediaLookup.remove(uid);
      } catch (error) {
        console.error("Error removing file from MediaLookup:", error);
      }
    }

    setFields([]);
    setDataPropsForNode(id, { fields: [], output: [] });
    setStatus(Status.READY);
    setStorageUsage(MediaLookup.storageUsage());
  }, [fields, id, setDataPropsForNode]);

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
        className="upload-node-droparea"
        onClick={() => fileInputRef.current?.click()}
      >
        <IconUpload size={40} color="#888" />
        <Text size="sm" color="dimmed">
          Drag &amp; drop files here or click to upload (
          {acceptedExtensions.join(", ")})
        </Text>
        {!runningLocally && (
          <Text size="xs" color="dimmed" mt={2} ta="center">
            Run ChainForge locally to also use .docx, .xlsx and .pptx
          </Text>
        )}
        <input
          type="file"
          multiple
          accept={acceptAttr}
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
            {showStorageUsage && storageUsage.bytes > 0 && (
              <Text span size="xs" color="dimmed" ml={6}>
                {formatMB(storageUsage.bytes)} /{" "}
                {formatMB(storageUsage.limitBytes)} in browser
              </Text>
            )}
          </Text>
          {fields.length > 0 && (
            <Button size="xs" variant="light" compact onClick={toggleFileList}>
              {fileListCollapsed ? "Show Files ▼" : "Hide Files ▲"}
            </Button>
          )}
        </Group>

        {!fileListCollapsed && fields.length > 0 && (
          <ScrollArea.Autosize
            mah={200}
            className="upload-node-list nopan nowheel"
          >
            <List spacing="xs" size="sm" pr="sm">
              {fields.map((field, index) => (
                <List.Item
                  key={
                    field.metavars?.id === "string" ? field.metavars.id : index
                  }
                  w="100%"
                  icon={
                    <ThemeIcon color="blue" size={20} radius="xl">
                      📄
                    </ThemeIcon>
                  }
                >
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text
                        lh={1.0}
                        size="sm"
                        weight={500}
                        style={{
                          overflowWrap: "anywhere",
                          wordBreak: "break-all",
                        }}
                      >
                        {typeof field.metavars?.filename === "string"
                          ? field.metavars.filename
                          : "Untitled file"}
                      </Text>
                      {field.text && typeof field.text === "string" && (
                        <Text size="xs" color="dimmed" lh={1.0}>
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
                  </Flex>
                </List.Item>
              ))}
            </List>
          </ScrollArea.Autosize>
        )}
      </Box>
    </BaseNode>
  );
};

export default UploadNode;
