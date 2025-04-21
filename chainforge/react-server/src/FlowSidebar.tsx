import React, { useState, useEffect, useContext } from "react";
import {
  IconEdit,
  IconTrash,
  IconMenu2,
  IconX,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import axios from "axios";
import { AlertModalContext } from "./AlertModal";
import { Dict } from "./backend/typing";
import {
  ActionIcon,
  Box,
  Drawer,
  Group,
  Stack,
  TextInput,
  Text,
  Flex,
  Divider,
  ScrollArea,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { FLASK_BASE_URL } from "./backend/utils";

interface FlowFile {
  name: string;
  pwd_protected: boolean; // whether the flow is encrypted on the backend
  last_modified: string;
}

interface FlowSidebarProps {
  /** The name of flow that's currently loaded in the front-end, if defined. */
  currentFlow?: string;
  onLoadFlow: (flowFile?: Dict<any>, flowName?: string) => void;
}

const FlowSidebar: React.FC<FlowSidebarProps> = ({
  onLoadFlow,
  currentFlow,
}) => {
  // Color theme (dark or light mode)
  const { colorScheme } = useMantineColorScheme();

  const [isOpen, setIsOpen] = useState(false);
  const [savedFlows, setSavedFlows] = useState<FlowFile[]>([]);
  const [editName, setEditName] = useState<string | null>(null);
  const [newEditName, setNewEditName] = useState<string>("newName");

  // The name of the local directory where flows are stored
  const [flowDir, setFlowDir] = useState<string | undefined>(undefined);

  // For displaying alerts
  const showAlert = useContext(AlertModalContext);

  // Fetch saved flows from the Flask backend
  const fetchSavedFlowList = async () => {
    try {
      const response = await axios.get(`${FLASK_BASE_URL}api/flows`);
      const flows = response.data.flows as FlowFile[];
      setFlowDir(response.data.flow_dir);
      setSavedFlows(
        flows.map((item) => ({
          name: item.name.replace(/\.cforge(\.enc)?$/, ""),
          pwd_protected: item.name.endsWith(".enc"),
          last_modified: new Date(item.last_modified).toLocaleString(),
        })),
      );
    } catch (error) {
      console.error("Error fetching saved flows:", error);
    }
  };

  // Load a flow when clicked, and push it to the caller
  const handleLoadFlow = async (flow: FlowFile) => {
    try {
      // Fetch the flow
      const response = await axios
        .get(`${FLASK_BASE_URL}api/flows/${flow.name}`, {
          params: {
            pwd_protected: flow.pwd_protected,
            autosave: true,
          },
        })
        .catch((error) => {
          let msg: string;
          if (error.response) {
            msg = "Error: " + (error.response.data?.error ?? "Flow not found.");
          } else if (error.request) {
            // Request was made but no response was received
            msg = "No response received from server.";
          } else {
            // Something else happened in setting up the request
            msg = `Unknown Error: ${error.message}`;
          }
          console.error(msg);
          if (showAlert) showAlert(msg);
        });

      if (!response) return;

      // Push the flow to the ReactFlow UI. We also pass the filename
      // so that the caller can use that info to save the right flow when the user presses save.
      onLoadFlow(response.data, flow.name);

      setIsOpen(false); // Close sidebar after loading
    } catch (error) {
      console.error(`Error loading flow ${flow.name}:`, error);
      if (showAlert) showAlert(error as Error);
    }
  };

  // Delete a flow
  const handleDeleteFlow = async (
    flow: FlowFile,
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    event.stopPropagation(); // Prevent triggering the parent click
    if (window.confirm(`Are you sure you want to delete "${flow.name}"?`)) {
      try {
        await axios.delete(`${FLASK_BASE_URL}api/flows/${flow.name}`, {
          params: { pwd_protected: flow.pwd_protected },
        });
        fetchSavedFlowList(); // Refresh the list
      } catch (error) {
        console.error(`Error deleting flow ${flow.name}:`, error);
        if (showAlert) showAlert(error as Error);
      }
    }
  };

  // Start editing a flow name
  const handleEditClick = (
    flowFile: string,
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    event.stopPropagation(); // Prevent triggering the parent click
    setEditName(flowFile);
    setNewEditName(flowFile);
  };

  // 'Duplicate' the flow
  const handleDuplicateFlow = async (
    flowFile: string,
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    event.stopPropagation(); // Prevent triggering the parent click
    await axios
      .put(`${FLASK_BASE_URL}api/flows/${flowFile}`, {
        duplicate: true,
      })
      .then((resp) => {
        onLoadFlow(undefined, resp.data.copyName as string); // Tell the parent that the filename has changed. This won't replace the flow.
        fetchSavedFlowList(); // Refresh the list
      })
      .catch((err) => {
        console.error(err);
        if (showAlert) showAlert(err);
      });
  };

  // Cancel editing
  const handleCancelEdit = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    event.stopPropagation(); // Prevent triggering the parent click
    setEditName(null);
  };

  // Save the edited flow name
  const handleSaveEdit = async (
    oldFilename: string,
    newFilename: string,
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    event?.stopPropagation(); // Prevent triggering the parent click
    if (newFilename && newFilename !== oldFilename) {
      await axios
        .put(`${FLASK_BASE_URL}api/flows/${oldFilename}`, {
          newName: newFilename,
        })
        .then(() => {
          onLoadFlow(undefined, newFilename); // Tell the parent that the filename has changed. This won't replace the flow.
          fetchSavedFlowList(); // Refresh the list
        })
        .catch((error) => {
          let msg: string;
          if (error.response) {
            msg = `404 Error: ${error.response.status === 404 ? error.response.data?.error ?? "Not Found" : error.response.data}`;
          } else if (error.request) {
            // Request was made but no response was received
            msg = "No response received from server.";
          } else {
            // Something else happened in setting up the request
            msg = `Unknown Error: ${error.message}`;
          }
          console.error(msg);
          if (showAlert) showAlert(msg);
        });
    }

    // No longer editing
    setEditName(null);
    setNewEditName("newName");
  };

  // Load flows when component mounts
  useEffect(() => {
    if (isOpen) {
      fetchSavedFlowList();
    }
  }, [isOpen]);

  return (
    <div className="relative">
      {/* <RenameValueModal title="Rename flow" label="Edit name" initialValue="" onSubmit={handleEditName} /> */}

      {/* Toggle Button */}
      <ActionIcon
        variant={colorScheme === "light" ? "gradient" : "filled"}
        color={colorScheme === "light" ? "blue" : "gray"}
        size="1.625rem"
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          // left: isOpen ? "250px" : "10px",
          // transition: "left 0.3s ease-in-out",
          zIndex: 10,
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <IconX /> : <IconMenu2 />}
      </ActionIcon>

      {/* Sidebar */}
      <Drawer
        opened={isOpen}
        onClose={() => setIsOpen(false)}
        title="Saved Flows"
        position="left"
        size="350px" // Adjust sidebar width
        padding="md"
        withCloseButton={true}
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Divider />
        <Stack spacing="4px" mt="0px" mb="120px">
          {savedFlows.length === 0 ? (
            <Text color="dimmed">No saved flows found</Text>
          ) : (
            savedFlows.map((flow) => (
              <Box
                key={flow.name}
                p="6px"
                sx={(theme) => ({
                  borderRadius: theme.radius.sm,
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor:
                      theme.colorScheme === "dark"
                        ? theme.colors.dark[6]
                        : theme.colors.gray[0],
                  },
                })}
                onClick={() => {
                  if (editName !== flow.name) handleLoadFlow(flow);
                }}
              >
                {editName === flow.name ? (
                  <Group spacing="xs">
                    <TextInput
                      value={newEditName}
                      onChange={(e) => setNewEditName(e.target.value)}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <ActionIcon
                      color="green"
                      onClick={(e) => handleSaveEdit(editName, newEditName, e)}
                    >
                      <IconCheck size={18} />
                    </ActionIcon>
                    <ActionIcon color="gray" onClick={handleCancelEdit}>
                      <IconX size={18} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <>
                    <Flex
                      justify="space-between"
                      align="center"
                      gap="0px"
                      h="auto"
                    >
                      {currentFlow === flow.name ? (
                        <Box
                          ml="-15px"
                          mr="5px"
                          bg="green"
                          w="10px"
                          h="10px"
                          style={{ borderRadius: "50%" }}
                        ></Box>
                      ) : (
                        <></>
                      )}
                      <Flex justify="left" mr="auto">
                        <Text size="sm">{flow.name}</Text>
                        {flow.pwd_protected && (
                          <Tooltip
                            label="Password protected. (You need to load ChainForge with the --secure flag to load this.)"
                            withArrow
                            arrowPosition="center"
                            multiline
                            w="200px"
                            withinPortal
                          >
                            <Text size="sm" ml={5}>
                              🔒
                            </Text>
                          </Tooltip>
                        )}
                      </Flex>
                      <Flex gap="0px">
                        <Tooltip
                          label="Edit name"
                          withArrow
                          arrowPosition="center"
                          withinPortal
                        >
                          <ActionIcon
                            color="blue"
                            onClick={(e) => handleEditClick(flow.name, e)}
                          >
                            <IconEdit size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip
                          label="Duplicate this flow"
                          withArrow
                          arrowPosition="center"
                          withinPortal
                        >
                          <ActionIcon
                            color="blue"
                            onClick={(e) => handleDuplicateFlow(flow.name, e)}
                          >
                            <IconCopy size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip
                          label="Delete this flow"
                          withArrow
                          arrowPosition="center"
                          withinPortal
                        >
                          <ActionIcon
                            color="red"
                            onClick={(e) => handleDeleteFlow(flow, e)}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Flex>
                    </Flex>
                    <Text size="xs" color="gray">
                      {flow.last_modified}
                    </Text>
                  </>
                )}
                <Divider />
              </Box>
            ))
          )}
        </Stack>

        {/* Sticky footer */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            background: "white",
            padding: "10px",
            borderTop: "1px solid #ddd",
          }}
        >
          {flowDir ? (
            <Text size="xs" color="gray">
              Local flows are saved at: {flowDir}
            </Text>
          ) : (
            <></>
          )}
        </div>
      </Drawer>
    </div>
  );
};

export default FlowSidebar;
