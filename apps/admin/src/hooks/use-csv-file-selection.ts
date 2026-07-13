import { type ChangeEvent, type DragEvent, useCallback, useState } from "react";
import { toast } from "sonner";

import {
  formatCsvRejections,
  type ICsvImportLimits,
  type ISelectedCsvFile,
  processCsvIncomingFiles,
} from "@/lib/csv-file-import";

interface UseCsvFileSelectionOptions {
  limits: ICsvImportLimits;
}

export function useCsvFileSelection({ limits }: UseCsvFileSelectionOptions) {
  const [selectedFiles, setSelectedFiles] = useState<ISelectedCsvFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const reset = useCallback(() => {
    setSelectedFiles([]);
    setIsDragOver(false);
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const picked = Array.from(incoming);
      if (picked.length === 0) {
        return;
      }

      setSelectedFiles((current) => {
        const { files, rejections } = processCsvIncomingFiles(current, picked, limits);
        const message = formatCsvRejections(rejections, limits.maxFiles);
        if (message) {
          toast.error(message);
        }
        return files;
      });
    },
    [limits]
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        addFiles(event.target.files);
      }
      event.target.value = "";
    },
    [addFiles]
  );

  const removeFile = useCallback((fileId: string) => {
    setSelectedFiles((files) => files.filter((file) => file.id !== fileId));
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      if (event.dataTransfer.files.length > 0) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  return {
    addFiles,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
    isDragOver,
    removeFile,
    reset,
    selectedFiles,
  };
}
