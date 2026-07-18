import { useCallback } from "react";

import { useQuickDelete } from "@/hooks/use-quick-delete";

type TPropertySettingsListRow = {
  clientId: string;
  name: string;
};

type TUsePropertySettingsListRowDeleteOptions = {
  entityLabel: string;
  isPending?: boolean;
  onRemove: (clientId: string) => void;
};

export function usePropertySettingsListRowDelete<T extends TPropertySettingsListRow>({
  entityLabel,
  isPending = false,
  onRemove,
}: TUsePropertySettingsListRowDeleteOptions) {
  const deleteFn = useCallback(
    (row: T, onDeleted?: () => void) => {
      onRemove(row.clientId);
      onDeleted?.();
    },
    [onRemove]
  );

  const getConfirmationOptions = useCallback(
    (row: T) => ({
      description: `This will remove "${row.name || entityLabel}" from settings.`,
      target: row,
      title: `Remove ${entityLabel}`,
    }),
    [entityLabel]
  );

  return useQuickDelete<T>({
    deleteFn,
    getConfirmationOptions,
    isPending,
  });
}
