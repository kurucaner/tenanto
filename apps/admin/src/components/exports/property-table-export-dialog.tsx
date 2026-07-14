import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { propertyExportsApi } from "@/lib/api-client";
import { formatExpenseExportFilterSummary } from "@/lib/property-export-utils";
import { queryKeys } from "@/lib/query-keys";
import { type TSelectOption } from "@/lib/select-option-types";
import { showPropertyExportQueuedToast } from "@/lib/show-property-export-queued-toast";
import {
  ExportFormat,
  ExportResourceType,
  type TExportFormat,
  type TPropertyExpensesListFilters,
} from "@/packages/shared";

interface IPropertyTableExportDialogProps {
  categoryOptions: readonly TSelectOption[];
  filters: TPropertyExpensesListFilters;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const PropertyTableExportDialog = memo(
  ({
    categoryOptions,
    filters,
    onOpenChange,
    open,
    propertyId,
  }: IPropertyTableExportDialogProps) => {
    const queryClient = useQueryClient();
    const filterSummaryId = useId();
    const [format, setFormat] = useState<TExportFormat>(ExportFormat.CSV);

    useEffect(() => {
      if (!open) {
        return;
      }
      setFormat(ExportFormat.CSV);
    }, [open]);

    const filterSummary = formatExpenseExportFilterSummary(filters, categoryOptions);

    const createMutation = useMutation({
      mutationFn: () =>
        propertyExportsApi.create(propertyId, {
          filters,
          format: ExportFormat.CSV,
          resourceType: ExportResourceType.EXPENSES,
        }),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to queue export");
      },
      onSuccess: (response) => {
        onOpenChange(false);
        showPropertyExportQueuedToast(propertyId, response.jobId);
        queryClient.invalidateQueries({
          queryKey: queryKeys.propertyExports(propertyId),
        });
        queryClient.prefetchQuery({
          queryFn: () => propertyExportsApi.get(propertyId, response.jobId),
          queryKey: queryKeys.propertyExport(propertyId, response.jobId),
        });
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen && createMutation.isPending) {
          return;
        }
        onOpenChange(nextOpen);
      },
      [createMutation.isPending, onOpenChange]
    );

    const handleFormatChange = useCallback((nextValue: string) => {
      setFormat(nextValue as TExportFormat);
    }, []);

    const handlePrepare = useCallback(() => {
      if (format !== ExportFormat.CSV) {
        toast.error("Excel export is not available yet");
        return;
      }
      createMutation.mutate();
    }, [createMutation, format]);

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Export table</DialogTitle>
            <DialogDescription>
              Prepare a file using your current filters. You can download it from the Exports tab
              when it is ready.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="bg-muted/40 space-y-1 rounded-md border p-3">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Filters
              </p>
              <p className="text-sm" id={filterSummaryId}>
                {filterSummary}
              </p>
            </div>

            <RadioGroupFieldset
              aria-describedby={filterSummaryId}
              legend="Format"
              onValueChange={handleFormatChange}
              value={format}
            >
              <RadioOption label="CSV" value={ExportFormat.CSV} />
              <RadioOption disabled label="Excel (coming soon)" value={ExportFormat.XLSX} />
            </RadioGroupFieldset>
          </div>

          <DialogFooter>
            <Button
              disabled={createMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={createMutation.isPending} onClick={handlePrepare} type="button">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Preparing…
                </>
              ) : (
                "Prepare"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
PropertyTableExportDialog.displayName = "PropertyTableExportDialog";
