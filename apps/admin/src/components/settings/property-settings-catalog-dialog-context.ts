import { createContext, useContext } from "react";

/**
 * `undefined` = closed, `null` = add, `TRow` = edit.
 */
export type TPropertySettingsCatalogDialogRow<TRow> = TRow | null | undefined;

export interface IPropertySettingsCatalogDialogApi<TRow> {
  openAdd: () => void;
  openEdit: (row: TRow) => void;
}

export const PropertySettingsCatalogDialogContext =
  createContext<IPropertySettingsCatalogDialogApi<unknown> | null>(null);

export function usePropertySettingsCatalogDialog<TRow>(): IPropertySettingsCatalogDialogApi<TRow> {
  const context = useContext(PropertySettingsCatalogDialogContext);
  if (context === null) {
    throw new Error(
      "usePropertySettingsCatalogDialog must be used within PropertySettingsCatalogDialogScope"
    );
  }
  return context as IPropertySettingsCatalogDialogApi<TRow>;
}
