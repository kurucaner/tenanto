import { Sparkles } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface ImportCsvUploadFooterProps {
  isLoadingMock?: boolean;
  onCancel: () => void;
  onGenerateMockData?: () => void;
  onSmartRead: () => void;
  parsePending?: boolean;
  selectedFileCount: number;
  showMockDataButton?: boolean;
  smartReadDisabled?: boolean;
  smartReadDisabledReason?: string;
}

export const ImportCsvUploadFooter = memo(
  ({
    isLoadingMock = false,
    onCancel,
    onGenerateMockData,
    onSmartRead,
    parsePending = false,
    selectedFileCount,
    showMockDataButton = false,
    smartReadDisabled = false,
    smartReadDisabledReason,
  }: ImportCsvUploadFooterProps) => {
    const actionsPending = parsePending || isLoadingMock;
    const smartReadTitle = smartReadDisabled ? smartReadDisabledReason : undefined;

    return (
      <DialogFooter>
        <Button disabled={actionsPending} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        {showMockDataButton && onGenerateMockData ? (
          <Button
            disabled={isLoadingMock || parsePending}
            onClick={onGenerateMockData}
            type="button"
            variant="secondary"
          >
            {isLoadingMock ? "Generating…" : "Generate mock data"}
          </Button>
        ) : null}
        <Button
          className="gap-1.5"
          disabled={smartReadDisabled || selectedFileCount === 0 || parsePending || isLoadingMock}
          onClick={onSmartRead}
          title={smartReadTitle}
          type="button"
        >
          <Sparkles className="size-3.5" />
          {parsePending ? "Smart reading…" : "Smart read"}
        </Button>
      </DialogFooter>
    );
  }
);
ImportCsvUploadFooter.displayName = "ImportCsvUploadFooter";
