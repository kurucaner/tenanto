import { type MouseEvent, useCallback } from "react";

import {
  type TDeleteConfirmationOptions,
  useDeleteConfirmation,
} from "@/hooks/use-delete-confirmation";
import { usePrimaryModifierHeld } from "@/hooks/use-primary-modifier-held";
import { isPrimaryModifierHeld } from "@/lib/primary-modifier-key";

type TQuickDeleteOptions<TTarget> = {
  deleteFn: (target: TTarget, onDeleted?: () => void) => void;
  getConfirmationOptions: (target: TTarget) => TDeleteConfirmationOptions<TTarget>;
  isPending: boolean;
};

export function useQuickDelete<TTarget>({
  deleteFn,
  getConfirmationOptions,
  isPending,
}: TQuickDeleteOptions<TTarget>) {
  const isQuickDeleteActive = usePrimaryModifierHeld();
  const { deleteConfirmationDialog, requestDelete } = useDeleteConfirmation(isPending, deleteFn);

  const handleDelete = useCallback(
    (target: TTarget, event?: MouseEvent) => {
      const skipConfirmation =
        isQuickDeleteActive || (event !== undefined && isPrimaryModifierHeld(event));

      if (skipConfirmation) {
        deleteFn(target);
        return;
      }

      requestDelete(getConfirmationOptions(target));
    },
    [deleteFn, getConfirmationOptions, isQuickDeleteActive, requestDelete]
  );

  return {
    deleteConfirmationDialog,
    handleDelete,
    isQuickDeleteActive,
  };
}
