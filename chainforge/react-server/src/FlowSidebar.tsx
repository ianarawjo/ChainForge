import React, { useState, useEffect, useContext } from "react";
import {
  IconEdit,
  IconTrash,
  IconMenu2,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import axios from "axios";
import { AlertModalContext } from "./AlertModal";
import { Dict } from "./backend/typing";
import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  Stack,
  TextInput,
  Text,
  Flex,
  Header,
  Title,
  Divider,
} from "@mantine/core";
import { FLASK_BASE_URL } from "./backend/utils";

interface FlowSidebarProps {
  onLoadFlow: (flowFile: Dict<any>, flowName: string) => void;
}

const FlowSidebar: React.FC<FlowSidebarProps> = ({ onLoadFlow }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [savedFlows, setSavedFlows] = useState<string[]>([]);
  // const [editingFlow, setEditingFlow] = useState(null);
  const [editName, setEditName] = useState<string | null>(null);
  const [newEditName, setNewEditName] = useState<string>("newName");

  // // Pop-up to edit name of a flow
  // const editTextRef = useState<RenameValueModalRef | null>(null);

  // For displaying alerts
  const showAlert = useContext(AlertModalContext);

  // Fetch saved flows from the Flask backend
  const fetchSavedFlowList = async () => {
    try {
      const response = await axios.get(`${FLASK_BASE_URL}api/flows`);
      setSavedFlows(
        response.data.map((filename: string) =>
          filename.replace(".cforge", ""),
        ),
      );
    } catch (error) {
      console.error("Error fetching saved flows:", error);
    }
  };

  // Load a flow when clicked, and push it to the caller
  const handleLoadFlow = async (filename: string) => {
    try {
      // Fetch the flow
      const response = await axios.get(
        `${FLASK_BASE_URL}api/flows/${filename}`,
      );

      // Push the flow to the ReactFlow UI. We also pass the filename
      // so that the caller can use that info to save the right flow when the user presses save.
      onLoadFlow(response.data, filename);

      setIsOpen(false); // Close sidebar after loading
    } catch (error) {
      console.error(`Error loading flow ${filename}:`, error);
      if (showAlert) showAlert(error as Error);
    }
  };

  // Delete a flow
  const handleDeleteFlow = async (
    filename: string,
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    event.stopPropagation(); // Prevent triggering the parent click
    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      try {
        await axios.delete(`${FLASK_BASE_URL}api/flows/${filename}`);
        fetchSavedFlowList(); // Refresh the list
      } catch (error) {
        console.error(`Error deleting flow ${filename}:`, error);
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
      try {
        await axios.put(`${FLASK_BASE_URL}api/flows/${oldFilename}`, {
          newName: newFilename,
        });
        fetchSavedFlowList(); // Refresh the list
      } catch (error) {
        console.error(`Error renaming flow ${oldFilename}:`, error);
        if (showAlert) showAlert(error as Error);
      }
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
        variant="gradient"
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
        position="left"
        size="250px" // Adjust sidebar width
        padding="md"
        withCloseButton={false} // Hide default close button
      >
        <Stack spacing="4px" mt="0px">
          <Flex justify="space-between">
            <Title order={4} align="center" color="#333">
              Saved Flows
            </Title>
            <ActionIcon onClick={() => setIsOpen(false)}>
              <IconX />
            </ActionIcon>
          </Flex>
          <Divider />
          {savedFlows.length === 0 ? (
            <Text color="dimmed">No saved flows found</Text>
          ) : (
            savedFlows.map((flow) => (
              <Box
                key={flow}
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
                  if (editName !== flow) handleLoadFlow(flow);
                }}
              >
                {editName === flow ? (
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
                  <Flex
                    justify="space-between"
                    align="center"
                    gap="0px"
                    h="auto"
                  >
                    <Text size="sm">{flow}</Text>
                    <ActionIcon
                      color="blue"
                      onClick={(e) => handleEditClick(flow, e)}
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      onClick={(e) => handleDeleteFlow(flow, e)}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Flex>
                )}
                <Divider />
              </Box>
            ))
          )}
        </Stack>
      </Drawer>
    </div>
  );
};

export default FlowSidebar;
