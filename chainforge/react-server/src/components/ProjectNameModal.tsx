import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  TextInput,
  Button,
  Select,
  Box,
  Loader,
  Text,
  Flex,
} from "@mantine/core"; // Import Text and Flex
import StorageCache from "../backend/cache";

interface ProjectNameModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (projectName: string) => Promise<void>; // Update onSubmit type
  isLoading: boolean;
  exportStatus: { success: boolean; message: string } | null; // Add exportStatus prop
}

const WANDB_PROJECT_NAMES_CACHE_KEY = "chainforge-wandb-project-names";

const ProjectNameModal: React.FC<ProjectNameModalProps> = ({
  opened,
  onClose,
  onSubmit,
  isLoading,
  exportStatus, // Destructure exportStatus prop
}) => {
  const [newProjectName, setNewProjectName] = useState<string>(""); // For new input
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(
    null,
  ); // For dropdown selection
  const [cachedProjectNames, setCachedProjectNames] = useState<string[]>([]);

  useEffect(() => {
    // Load cached project names when the component mounts
    const cachedData = StorageCache.loadFromLocalStorage(
      WANDB_PROJECT_NAMES_CACHE_KEY,
    );
    if (cachedData && Array.isArray(cachedData)) {
      setCachedProjectNames(cachedData as string[]);
    }
  }, []);

  const handleSaveProjectName = useCallback(
    (name: string) => {
      // Add to cache if not already present
      if (name && !cachedProjectNames.includes(name)) {
        const newCachedNames = [...cachedProjectNames, name];
        setCachedProjectNames(newCachedNames);
        StorageCache.saveToLocalStorage(
          WANDB_PROJECT_NAMES_CACHE_KEY,
          newCachedNames,
        );
      }
    },
    [cachedProjectNames],
  );

  const handleSubmit = () => {
    const finalProjectName = selectedProjectName || newProjectName;
    if (finalProjectName) {
      handleSaveProjectName(finalProjectName);
      onSubmit(finalProjectName); // Do not close here
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Enter Weights & Biases Project Name"
      centered
    >
      <Box mb="md">
        <Select
          label="Select a recent project name (or type a new one below)"
          placeholder="Select an existing project"
          data={cachedProjectNames.map((name) => ({
            value: name,
            label: name,
          }))}
          value={selectedProjectName}
          onChange={(value) => {
            setSelectedProjectName(value);
            setNewProjectName(""); // Clear new project name when selecting from dropdown
          }}
          searchable
          clearable
          disabled={
            isLoading || (exportStatus !== null && exportStatus.success)
          }
        />
      </Box>
      <TextInput
        label="New Project Name"
        placeholder="e.g., my-experiment-flow"
        value={newProjectName}
        onChange={(event) => {
          setNewProjectName(event.currentTarget.value);
          setSelectedProjectName(null); // Clear selected project name when typing new one
        }}
        disabled={isLoading || (exportStatus !== null && exportStatus.success)}
      />
      <Button
        onClick={handleSubmit}
        fullWidth
        mt="md"
        loading={isLoading}
        disabled={isLoading || (exportStatus !== null && exportStatus.success)}
      >
        Confirm
      </Button>

      {exportStatus && (
        <Flex justify="center" mt="md">
          <Text color={exportStatus.success ? "green" : "red"} weight={500}>
            {exportStatus.message}
          </Text>
        </Flex>
      )}
    </Modal>
  );
};

export default ProjectNameModal;
