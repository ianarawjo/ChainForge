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
  const [isLoading, setIsLoading] = useState(false); // New loading state
  const [exportStatus, setExportStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null); // New state for export result

  const handleExport = useCallback(
    async (projectName: string) => {
      const flow = rfInstance?.toObject();
      const all_node_ids = nodes.map((n) => n.id);
      setIsLoading(true); // Set loading to true when export starts
      setExportStatus(null); // Reset export status
      const cforge_data = await exportCache(all_node_ids)
        .then(function (cacheData: Dict<Dict>) {
          return {
            flow,
            cache: cacheData,
          };
        })
        .catch(handleError);

      if (!cforge_data) {
        setIsLoading(false); // Stop loading if cforge_data is not available
        setExportStatus({
          success: false,
          message: "Failed to prepare data for export.",
        });
        return;
      }

      try {
        const response = await callExportToWandBBackend(
          cforge_data,
          apiKeys.WandB,
          projectName,
        );
        setExportStatus(response); // Set export status from backend response
      } catch (error) {
        setExportStatus({
          success: false,
          message: `An unexpected error occurred: ${(error as Error).message}`,
        });
      } finally {
        setIsLoading(false); // Always stop loading when the request finishes
      }
    },
    [apiKeys.WandB, rfInstance, nodes, exportCache, handleError],
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
    setExportStatus(null); // Reset status when opening modal
  }, [apiKeys.WandB, showAlert]);

  return {
    handleExportToWandB,
    ProjectNameModal: (
      <ProjectNameModal
        opened={isProjectNameModalOpened}
        onClose={() => setIsProjectNameModalOpened(false)}
        onSubmit={handleExport}
        isLoading={isLoading}
        exportStatus={exportStatus} // Pass exportStatus to the modal
      />
    ),
  };
};
