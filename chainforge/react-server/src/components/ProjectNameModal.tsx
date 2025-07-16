import React, { useState, useEffect, useCallback } from "react";
import { Modal, TextInput, Button, Select, Box } from "@mantine/core";
import StorageCache from "../backend/cache";

interface ProjectNameModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (projectName: string) => void;
}

const WANDB_PROJECT_NAMES_CACHE_KEY = "chainforge-wandb-project-names";

const ProjectNameModal: React.FC<ProjectNameModalProps> = ({
  opened,
  onClose,
  onSubmit,
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
      onSubmit(finalProjectName);
      onClose();
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
      />
      <Button onClick={handleSubmit} fullWidth mt="md">
        Confirm
      </Button>
    </Modal>
  );
};

export default ProjectNameModal;
