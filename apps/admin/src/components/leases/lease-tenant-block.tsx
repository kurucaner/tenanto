import { Pencil } from "lucide-react";
import { memo, type MouseEvent, useCallback } from "react";

import { LeaseTenantPortalRow } from "@/components/leases/lease-tenant-portal-row";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ILeasePortalRowState,
  type TLeasePortalActingTarget,
  type TLeasePortalRowAction,
} from "@/lib/lease-portal-access-display";
import { formatPhoneDisplay, type IPropertyLongStaySecondaryTenant } from "@/packages/shared";

function TenantContactLine({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (!value) {
    return (
      <p className="text-muted-foreground text-xs">
        <span className="italic">Not set ({label})</span>
      </p>
    );
  }

  const displayValue = label === "phone" ? formatPhoneDisplay(value) : value;
  return <p className="text-muted-foreground text-xs">{displayValue}</p>;
}

interface ILeaseTenantBlockActionsProps {
  actingAction: TLeasePortalRowAction | null;
  actingTarget: TLeasePortalActingTarget | null;
  canEdit: boolean;
  deleteAriaLabel?: string;
  editAriaLabel: string;
  isDeletePending?: boolean;
  isQuickDeleteActive?: boolean;
  onDelete?: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: () => void;
  onInvite: () => void;
  onResend: () => void;
  onRevoke: () => void;
  portalMutationPending: boolean;
  portalState: ILeasePortalRowState;
  rowTarget: TLeasePortalActingTarget;
  showDelete: boolean;
  showPortalRow: boolean;
}

const LeaseTenantBlockActions = memo(function LeaseTenantBlockActions({
  actingAction,
  actingTarget,
  canEdit,
  deleteAriaLabel,
  editAriaLabel,
  isDeletePending,
  isQuickDeleteActive,
  onDelete,
  onEdit,
  onInvite,
  onResend,
  onRevoke,
  portalMutationPending,
  portalState,
  rowTarget,
  showDelete,
  showPortalRow,
}: ILeaseTenantBlockActionsProps) {
  return (
    <div className="flex shrink-0 items-start gap-1">
      {showPortalRow ? (
        <LeaseTenantPortalRow
          actingAction={actingAction}
          actingTarget={actingTarget}
          canManage={canEdit}
          onInvite={onInvite}
          onResend={onResend}
          onRevoke={onRevoke}
          portalMutationPending={portalMutationPending}
          portalState={portalState}
          rowTarget={rowTarget}
        />
      ) : null}
      {canEdit ? (
        <>
          <Button
            aria-label={editAriaLabel}
            onClick={onEdit}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Pencil className="size-3.5" />
          </Button>
          {showDelete && onDelete && deleteAriaLabel ? (
            <QuickDeleteButton
              ariaLabel={deleteAriaLabel}
              disabled={Boolean(isDeletePending)}
              onClick={onDelete}
              quickDeleteActive={Boolean(isQuickDeleteActive)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
});
LeaseTenantBlockActions.displayName = "LeaseTenantBlockActions";

interface ILeasePrimaryTenantBlockProps {
  actingAction: TLeasePortalRowAction | null;
  actingTarget: TLeasePortalActingTarget | null;
  canEdit: boolean;
  editAriaLabel: string;
  email: string | null;
  isPortalLinked: boolean;
  name: string;
  onEdit: () => void;
  onInvite: () => void;
  onResend: () => void;
  onRevoke: () => void;
  phone: string | null;
  portalErrorMessage: string | null;
  portalLoading: boolean;
  portalMutationPending: boolean;
  portalState: ILeasePortalRowState;
  roleLabel: string;
  showPortalRow: boolean;
}

export const LeasePrimaryTenantBlock = memo(function LeasePrimaryTenantBlock({
  actingAction,
  actingTarget,
  canEdit,
  editAriaLabel,
  email,
  isPortalLinked,
  name,
  onEdit,
  onInvite,
  onResend,
  onRevoke,
  phone,
  portalErrorMessage,
  portalLoading,
  portalMutationPending,
  portalState,
  roleLabel,
  showPortalRow,
}: ILeasePrimaryTenantBlockProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">{roleLabel}</p>
          {isPortalLinked ? (
            <Badge className="h-5" variant="secondary">
              Portal account linked
            </Badge>
          ) : null}
        </div>
        <p className="font-medium">{name}</p>
        <TenantContactLine label="email" value={email} />
        <TenantContactLine label="phone" value={phone} />
        {portalLoading ? (
          <p className="text-muted-foreground text-xs">Loading portal status…</p>
        ) : null}
        {portalErrorMessage ? (
          <p className="text-destructive text-xs">{portalErrorMessage}</p>
        ) : null}
      </div>
      <LeaseTenantBlockActions
        actingAction={actingAction}
        actingTarget={actingTarget}
        canEdit={canEdit}
        editAriaLabel={editAriaLabel}
        onEdit={onEdit}
        onInvite={onInvite}
        onResend={onResend}
        onRevoke={onRevoke}
        portalMutationPending={portalMutationPending}
        portalState={portalState}
        rowTarget={{ kind: "primary" }}
        showDelete={false}
        showPortalRow={showPortalRow}
      />
    </div>
  );
});
LeasePrimaryTenantBlock.displayName = "LeasePrimaryTenantBlock";

interface ILeaseSecondaryTenantRowProps {
  actingAction: TLeasePortalRowAction | null;
  actingTarget: TLeasePortalActingTarget | null;
  canEdit: boolean;
  index: number;
  isDeletePending: boolean;
  isQuickDeleteActive: boolean;
  onDelete: (index: number, event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (index: number) => void;
  onInvite: (index: number) => void;
  onResend: (index: number) => void;
  onRevoke: (index: number) => void;
  portalMutationPending: boolean;
  portalState: ILeasePortalRowState;
  showPortalRow: boolean;
  tenant: IPropertyLongStaySecondaryTenant;
}

export const LeaseSecondaryTenantRow = memo(function LeaseSecondaryTenantRow({
  actingAction,
  actingTarget,
  canEdit,
  index,
  isDeletePending,
  isQuickDeleteActive,
  onDelete,
  onEdit,
  onInvite,
  onResend,
  onRevoke,
  portalMutationPending,
  portalState,
  showPortalRow,
  tenant,
}: ILeaseSecondaryTenantRowProps) {
  const handleInvite = useCallback(() => {
    onInvite(index);
  }, [index, onInvite]);

  const handleResend = useCallback(() => {
    onResend(index);
  }, [index, onResend]);

  const handleRevoke = useCallback(() => {
    onRevoke(index);
  }, [index, onRevoke]);

  const handleEdit = useCallback(() => {
    onEdit(index);
  }, [index, onEdit]);

  const handleDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onDelete(index, event);
    },
    [index, onDelete]
  );

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{tenant.name}</p>
        <TenantContactLine label="email" value={tenant.email} />
        <TenantContactLine label="phone" value={tenant.phone} />
      </div>
      <LeaseTenantBlockActions
        actingAction={actingAction}
        actingTarget={actingTarget}
        canEdit={canEdit}
        deleteAriaLabel={`Remove ${tenant.name}`}
        editAriaLabel={`Edit ${tenant.name}`}
        isDeletePending={isDeletePending}
        isQuickDeleteActive={isQuickDeleteActive}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onInvite={handleInvite}
        onResend={handleResend}
        onRevoke={handleRevoke}
        portalMutationPending={portalMutationPending}
        portalState={portalState}
        rowTarget={{ index, kind: "secondary" }}
        showDelete
        showPortalRow={showPortalRow}
      />
    </div>
  );
});
LeaseSecondaryTenantRow.displayName = "LeaseSecondaryTenantRow";
