import { useCallback, useMemo, useState } from "react";

import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";

export type TDeleteConfirmationOptions<TTarget> = {
  confirmLabel?: string;
  description: string;
  target: TTarget;
  title: string;
};

type TDeleteFn<TTarget> = (target: TTarget, onDeleted: () => void) => void;

export function useDeleteConfirmation<TTarget>(
  isPending: boolean,
  deleteFn: TDeleteFn<TTarget>
) {
  const [request, setRequest] = useState<TDeleteConfirmationOptions<TTarget> | null>(null);

  const closeDeleteConfirmation = useCallback(() => {
    setRequest(null);
  }, []);

  const requestDelete = useCallback((options: TDeleteConfirmationOptions<TTarget>) => {
    setRequest(options);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isPending) {
        closeDeleteConfirmation();
      }
    },
    [closeDeleteConfirmation, isPending]
  );

  const handleConfirm = useCallback(() => {
    if (!request) {
      return;
    }
    deleteFn(request.target, closeDeleteConfirmation);
  }, [closeDeleteConfirmation, deleteFn, request]);

  const deleteConfirmationDialog = useMemo(
    () => (
      <DeleteConfirmationDialog
        confirmLabel={request?.confirmLabel}
        description={request?.description ?? ""}
        isPending={isPending}
        onConfirm={handleConfirm}
        onOpenChange={handleOpenChange}
        open={request !== null}
        title={request?.title ?? ""}
      />
    ),
    [handleConfirm, handleOpenChange, isPending, request]
  );

  return {
    deleteConfirmationDialog,
    requestDelete,
  };
}
