/** Applied to a soft-deleted `<TableRow>` to visually de-emphasize it. */
export const deletedRowClassName = "opacity-55";

/** Applied to a refunded (non-deleted) `<TableRow>` to visually de-emphasize it. */
export const refundedRowClassName = "opacity-80";

export function ledgerEntryRowClassName(
  isDeleted: boolean,
  refundedAt: string | null
): string | undefined {
  if (isDeleted) return deletedRowClassName;
  if (refundedAt) return refundedRowClassName;
  return undefined;
}
