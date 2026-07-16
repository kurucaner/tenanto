import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

import { AddSecondaryTenantDialog } from "@/components/leases/add-secondary-tenant-dialog";
import { EditPrimaryTenantDialog } from "@/components/leases/edit-primary-tenant-dialog";
import { EditSecondaryTenantDialog } from "@/components/leases/edit-secondary-tenant-dialog";
import { LeaseTenantPortalRow } from "@/components/leases/lease-tenant-portal-row";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { longStayPortalApi, longStaysApi } from "@/lib/api-client";
import {
  invalidatePropertyLongStayCaches,
  invalidatePropertyLongStayPortalCaches,
} from "@/lib/invalidate-property-long-stay-caches";
import {
  findLeasePortalMembership,
  getLeasePortalInviteAllTargets,
  getLeasePortalRowState,
  type TLeasePortalRowAction,
} from "@/lib/lease-portal-access-display";
import { queryKeys } from "@/lib/query-keys";
import {
  formatPhoneDisplay,
  type IPropertyLongStay,
  type IPropertyLongStaySecondaryTenant,
  PropertyLongStayStatus,
  TenantMembershipRole,
} from "@/packages/shared";

const MAX_SECONDARY_TENANTS = 10;

type TLeaseSecondaryTenantDeleteTarget = {
  index: number;
  tenant: IPropertyLongStaySecondaryTenant;
};

type TLeasePortalRevokeTarget = {
  membershipId: string;
  tenantName: string;
};

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

interface LeaseTenantsSectionProps {
  canManage: boolean;
  lease: IPropertyLongStay;
  propertyId: string;
}

export const LeaseTenantsSection = memo(
  ({ canManage, lease, propertyId }: LeaseTenantsSectionProps) => {
    const queryClient = useQueryClient();
    const [addSecondaryOpen, setAddSecondaryOpen] = useState(false);
    const [editPrimaryOpen, setEditPrimaryOpen] = useState(false);
    const [editingSecondary, setEditingSecondary] = useState<{
      index: number;
      tenant: IPropertyLongStaySecondaryTenant;
    } | null>(null);
    const [actingAction, setActingAction] = useState<TLeasePortalRowAction | null>(null);
    const [actingMembershipId, setActingMembershipId] = useState<string | null>(null);

    const canEditTenants = canManage && lease.status === PropertyLongStayStatus.ACTIVE;

    const portalAccessQuery = useQuery({
      queryFn: () => longStayPortalApi.getAccess(propertyId, lease.id),
      queryKey: queryKeys.propertyLongStayPortalAccess(propertyId, lease.id),
    });

    const memberships = portalAccessQuery.data?.memberships ?? [];

    const invalidatePortalCaches = useCallback(() => {
      invalidatePropertyLongStayPortalCaches(queryClient, propertyId, lease.id);
    }, [lease.id, propertyId, queryClient]);

    const handlePortalMutationSuccess = useCallback(
      (message: string, emailSent?: boolean, emailError?: string) => {
        invalidatePortalCaches();
        if (emailSent === false && emailError) {
          toast.error(emailError);
          return;
        }
        toast.success(message);
      },
      [invalidatePortalCaches]
    );

    const inviteMutation = useMutation({
      mutationFn: (body: { invitePrimary?: boolean; secondaryIndexes?: number[] }) =>
        longStayPortalApi.createInvites(propertyId, lease.id, body),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to send portal invite");
      },
      onSuccess: (response) => {
        const firstResult = response.results[0];
        handlePortalMutationSuccess(
          response.results.length === 1 ? "Portal invite sent" : "Portal invites sent",
          firstResult?.emailSent,
          firstResult?.emailError
        );
      },
    });

    const resendMutation = useMutation({
      mutationFn: (membershipId: string) =>
        longStayPortalApi.resendInvite(propertyId, lease.id, membershipId),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to resend portal invite");
      },
      onSuccess: (response) => {
        handlePortalMutationSuccess(
          "Portal invite resent",
          response.emailSent,
          response.emailError
        );
      },
    });

    const revokeMutation = useMutation({
      mutationFn: (membershipId: string) =>
        longStayPortalApi.revokeInvite(propertyId, lease.id, membershipId),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to revoke portal access");
      },
      onSuccess: () => {
        handlePortalMutationSuccess("Portal access revoked");
      },
    });

    const runPortalAction = useCallback(
      async (
        action: TLeasePortalRowAction,
        membershipId: string | null,
        body: { invitePrimary?: boolean; secondaryIndexes?: number[] }
      ) => {
        setActingAction(action);
        setActingMembershipId(membershipId);
        try {
          if (action === "invite") {
            await inviteMutation.mutateAsync(body);
            return;
          }
          if (!membershipId) {
            return;
          }
          if (action === "resend") {
            await resendMutation.mutateAsync(membershipId);
            return;
          }
          await revokeMutation.mutateAsync(membershipId);
        } finally {
          setActingAction(null);
          setActingMembershipId(null);
        }
      },
      [inviteMutation, resendMutation, revokeMutation]
    );

    const primaryMembership = findLeasePortalMembership(
      memberships,
      TenantMembershipRole.PRIMARY,
      lease.tenantEmail
    );
    const primaryPortalState = getLeasePortalRowState(
      primaryMembership,
      Boolean(lease.tenantEmail?.trim())
    );

    const inviteAllTargets = getLeasePortalInviteAllTargets(lease, memberships);
    const canInviteAll =
      canEditTenants &&
      (inviteAllTargets.invitePrimary || inviteAllTargets.secondaryIndexes.length > 0);

    const removeMutation = useMutation({
      mutationFn: (tenantIndex: number) => {
        const nextTenants = lease.secondaryTenants.filter((_, index) => index !== tenantIndex);
        return longStaysApi.update(propertyId, lease.id, {
          secondaryTenants: nextTenants,
        });
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to remove secondary tenant");
      },
      onSuccess: () => {
        toast.success("Secondary tenant removed");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
        invalidatePortalCaches();
      },
    });

    const deleteFn = useCallback(
      (target: TLeaseSecondaryTenantDeleteTarget, onDeleted?: () => void) => {
        removeMutation.mutate(target.index, { onSuccess: onDeleted });
      },
      [removeMutation]
    );

    const getConfirmationOptions = useCallback(
      (target: TLeaseSecondaryTenantDeleteTarget) => ({
        confirmLabel: "Remove",
        description: `Remove "${target.tenant.name}" from this lease?`,
        target,
        title: "Remove secondary tenant",
      }),
      []
    );

    const { deleteConfirmationDialog, handleDelete, isQuickDeleteActive } =
      useQuickDelete<TLeaseSecondaryTenantDeleteTarget>({
        deleteFn,
        getConfirmationOptions,
        isPending: removeMutation.isPending,
      });

    const revokeFn = useCallback(
      (target: TLeasePortalRevokeTarget, onDeleted: () => void) => {
        void runPortalAction("revoke", target.membershipId, {})
          .then(onDeleted)
          .catch(() => undefined);
      },
      [runPortalAction]
    );

    const { deleteConfirmationDialog: revokeConfirmationDialog, requestDelete: requestRevoke } =
      useDeleteConfirmation<TLeasePortalRevokeTarget>(revokeMutation.isPending, revokeFn);

    const requestRevokeConfirmation = useCallback(
      (membershipId: string | null | undefined, tenantName: string) => {
        if (!membershipId) {
          return;
        }
        requestRevoke({
          confirmLabel: "Revoke",
          description: `Revoke portal access for "${tenantName}"? They will no longer be able to access this lease in the tenant portal.`,
          target: { membershipId, tenantName },
          title: "Revoke portal access",
        });
      },
      [requestRevoke]
    );

    const portalMutationPending =
      inviteMutation.isPending || resendMutation.isPending || revokeMutation.isPending;

    return (
      <>
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-muted-foreground text-xs">Primary tenant</p>
                <p className="font-medium">{lease.guestName}</p>
                <TenantContactLine label="email" value={lease.tenantEmail} />
                <TenantContactLine label="phone" value={lease.tenantPhone} />
                {portalAccessQuery.isPending ? (
                  <p className="text-muted-foreground text-xs">Loading portal status…</p>
                ) : null}
                {portalAccessQuery.isError ? (
                  <p className="text-destructive text-xs">
                    {portalAccessQuery.error instanceof Error
                      ? portalAccessQuery.error.message
                      : "Failed to load portal status"}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-start gap-1">
                {!portalAccessQuery.isPending && !portalAccessQuery.isError ? (
                  <LeaseTenantPortalRow
                    actingAction={actingAction}
                    actingMembershipId={actingMembershipId}
                    canManage={canEditTenants}
                    onInvite={() =>
                      void runPortalAction("invite", primaryMembership?.id ?? null, {
                        invitePrimary: true,
                      })
                    }
                    onResend={() =>
                      void runPortalAction("resend", primaryMembership?.id ?? null, {})
                    }
                    onRevoke={() =>
                      requestRevokeConfirmation(primaryMembership?.id, lease.guestName)
                    }
                    portalState={primaryPortalState}
                  />
                ) : null}
                {canEditTenants ? (
                  <Button
                    aria-label="Edit primary tenant"
                    onClick={() => setEditPrimaryOpen(true)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>

            {lease.secondaryTenants.length > 0 ? (
              <div className="space-y-3 border-t pt-3">
                <p className="text-muted-foreground text-xs">Secondary tenants</p>
                {lease.secondaryTenants.map((tenant, index) => {
                  const rowMembership = findLeasePortalMembership(
                    memberships,
                    TenantMembershipRole.SECONDARY,
                    tenant.email
                  );
                  const rowPortalState = getLeasePortalRowState(
                    rowMembership,
                    Boolean(tenant.email?.trim())
                  );

                  return (
                    <div
                      className="flex items-start justify-between gap-3"
                      key={`${tenant.name}-${index}`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium">{tenant.name}</p>
                        <TenantContactLine label="email" value={tenant.email} />
                        <TenantContactLine label="phone" value={tenant.phone} />
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        {!portalAccessQuery.isPending && !portalAccessQuery.isError ? (
                          <LeaseTenantPortalRow
                            actingAction={actingAction}
                            actingMembershipId={actingMembershipId}
                            canManage={canEditTenants}
                            onInvite={() =>
                              void runPortalAction("invite", rowMembership?.id ?? null, {
                                secondaryIndexes: [index],
                              })
                            }
                            onResend={() =>
                              void runPortalAction("resend", rowMembership?.id ?? null, {})
                            }
                            onRevoke={() =>
                              requestRevokeConfirmation(rowMembership?.id, tenant.name)
                            }
                            portalState={rowPortalState}
                          />
                        ) : null}
                        {canEditTenants ? (
                          <>
                            <Button
                              aria-label={`Edit ${tenant.name}`}
                              onClick={() => setEditingSecondary({ index, tenant })}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <QuickDeleteButton
                              ariaLabel={`Remove ${tenant.name}`}
                              disabled={removeMutation.isPending}
                              onClick={(event) => handleDelete({ index, tenant }, event)}
                              quickDeleteActive={isQuickDeleteActive}
                            />
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {canEditTenants ? (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  className="gap-1.5"
                  disabled={lease.secondaryTenants.length >= MAX_SECONDARY_TENANTS}
                  onClick={() => setAddSecondaryOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="size-3.5" />
                  Add secondary tenant
                </Button>
                {canInviteAll ? (
                  <Button
                    disabled={portalMutationPending}
                    onClick={() =>
                      runPortalAction("invite", null, {
                        invitePrimary: inviteAllTargets.invitePrimary ? true : undefined,
                        secondaryIndexes: inviteAllTargets.secondaryIndexes,
                      })
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {actingAction === "invite" && actingMembershipId === null
                      ? "Inviting…"
                      : "Invite all"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {addSecondaryOpen ? (
          <AddSecondaryTenantDialog
            key={`${lease.id}-add-secondary`}
            lease={lease}
            onOpenChange={setAddSecondaryOpen}
            open={true}
            propertyId={propertyId}
          />
        ) : null}

        {editPrimaryOpen ? (
          <EditPrimaryTenantDialog
            key={`${lease.id}-edit-primary`}
            lease={lease}
            onOpenChange={setEditPrimaryOpen}
            open={true}
            propertyId={propertyId}
          />
        ) : null}

        {editingSecondary ? (
          <EditSecondaryTenantDialog
            key={`${lease.id}-edit-secondary-${editingSecondary.index}`}
            lease={lease}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setEditingSecondary(null);
              }
            }}
            open={true}
            propertyId={propertyId}
            tenant={editingSecondary.tenant}
            tenantIndex={editingSecondary.index}
          />
        ) : null}

        {deleteConfirmationDialog}
        {revokeConfirmationDialog}
      </>
    );
  }
);
LeaseTenantsSection.displayName = "LeaseTenantsSection";
