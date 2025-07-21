import React, { useCallback, useState } from "react";

import useStore, { StoreHandles } from "../store";
import { shallow } from "zustand/shallow";

import {
  exportCache,
  exportToWandB as callExportToWandBBackend,
} from "../backend/backend";
import { Dict } from "../backend/typing";
import ProjectNameModal from "./ProjectNameModal";

interface ExportToWandBProps {
  showAlert: (message: string | Error) => void;
  rfInstance: any;
  nodes: any[];
  handleError: (err: Error | string) => void;
}

export const useExportToWandB = ({
  showAlert,
  rfInstance,
  nodes,
  handleError,
}: ExportToWandBProps) => {
  const { apiKeys } = useStore(
    (state: StoreHandles) => ({ apiKeys: state.apiKeys }),
    shallow,
  );
  const [isProjectNameModalOpened, setIsProjectNameModalOpened] =
    useState(false);

  const handleExport = useCallback(
    async (projectName: string) => {
      const flow = rfInstance?.toObject();
      const all_node_ids = nodes.map((n) => n.id);
      const cforge_data = await exportCache(all_node_ids)
        .then(function (cacheData: Dict<Dict>) {
          return {
            flow,
            cache: cacheData,
          };
        })
        .catch(handleError);

      if (!cforge_data) return;

      try {
        const response = await callExportToWandBBackend(cforge_data, apiKeys.WandB, projectName);
        if (response.success) {
          showAlert(`Success: ${response.message}`);
        } else {
          showAlert(`Error: ${response.message}`);
        }
      } catch (error) {
        showAlert(`An unexpected error occurred: ${(error as Error).message}`);
      }
    },
    [apiKeys.WandB, showAlert, rfInstance, nodes, exportCache, handleError],
  );

  const handleExportToWandB = useCallback(() => {
    if (apiKeys.WandB === undefined || apiKeys.WandB.length === 0) {
      if (showAlert) {
        showAlert(
          "Please provide your Weights & Biases API key in the settings.",
        );
      }
      return;
    }
    setIsProjectNameModalOpened(true);
  }, [apiKeys.WandB, showAlert]);

  return {
    handleExportToWandB,
    ProjectNameModal: (
      <ProjectNameModal
        opened={isProjectNameModalOpened}
        onClose={() => setIsProjectNameModalOpened(false)}
        onSubmit={handleExport}
      />
    ),
  };
};
