import { type ReactNode, useCallback, useMemo, useState } from "react";

import {
  type IPropertySettingsCatalogDialogApi,
  PropertySettingsCatalogDialogContext,
  type TPropertySettingsCatalogDialogRow,
} from "@/components/settings/property-settings-catalog-dialog-context";

export interface IPropertySettingsCatalogDialogScopeProps<TRow> {
  children: ReactNode;
  isPending: boolean;
  onUpsertRow: (row: TRow) => void;
  renderDialog: (props: {
    isPending: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (row: TRow) => void;
    open: boolean;
    row: TRow | null;
  }) => ReactNode;
}

export function PropertySettingsCatalogDialogScope<TRow>({
  children,
  isPending,
  onUpsertRow,
  renderDialog,
}: IPropertySettingsCatalogDialogScopeProps<TRow>) {
  const [dialogRow, setDialogRow] = useState<TPropertySettingsCatalogDialogRow<TRow>>(undefined);

  const openAdd = useCallback(() => {
    setDialogRow(null);
  }, []);

  const openEdit = useCallback((row: TRow) => {
    setDialogRow(row);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDialogRow(undefined);
    }
  }, []);

  const handleSubmit = useCallback(
    (row: TRow) => {
      onUpsertRow(row);
      setDialogRow(undefined);
    },
    [onUpsertRow]
  );

  const api = useMemo(
    () => ({ openAdd, openEdit }) satisfies IPropertySettingsCatalogDialogApi<TRow>,
    [openAdd, openEdit]
  );

  return (
    <PropertySettingsCatalogDialogContext.Provider
      value={api as IPropertySettingsCatalogDialogApi<unknown>}
    >
      {children}
      {renderDialog({
        isPending,
        onOpenChange: handleOpenChange,
        onSubmit: handleSubmit,
        open: dialogRow !== undefined,
        row: dialogRow ?? null,
      })}
    </PropertySettingsCatalogDialogContext.Provider>
  );
}
