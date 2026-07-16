import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { memo, type MouseEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AddSecondaryTenantDialog } from "@/components/leases/add-secondary-tenant-dialog";
import { EditPrimaryTenantDialog } from "@/components/leases/edit-primary-tenant-dialog";
import { EditSecondaryTenantDialog } from "@/components/leases/edit-secondary-tenant-dialog";
import {
  LeasePrimaryTenantBlock,
  LeaseSecondaryTenantRow,
} from "@/components/leases/lease-tenant-block";
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
  type TLeasePortalActingTarget,
  type TLeasePortalRowAction,
} from "@/lib/lease-portal-access-display";
import { queryKeys } from "@/lib/query-keys";
import {
  type ILeasePrimaryTenantContact,
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
  actingTarget: TLeasePortalActingTarget;
  membershipId: string;
  tenantName: string;
};

interface LeaseTenantsSectionProps {
  canManage: boolean;
  lease: IPropertyLongStay;
  primaryTenantContact: ILeasePrimaryTenantContact;
  propertyId: string;
}

export const LeaseTenantsSection = memo(
  ({ canManage, lease, primaryTenantContact, propertyId }: LeaseTenantsSectionProps) => {
    const queryClient = useQueryClient();
    const [addSecondaryOpen, setAddSecondaryOpen] = useState(false);
    const [editPrimaryOpen, setEditPrimaryOpen] = useState(false);
    const [editingSecondary, setEditingSecondary] = useState<{
      index: number;
      tenant: IPropertyLongStaySecondaryTenant;
    } | null>(null);
    const [actingAction, setActingAction] = useState<TLeasePortalRowAction | null>(null);
    const [actingTarget, setActingTarget] = useState<TLeasePortalActingTarget | null>(null);

    const canEditTenants = canManage && lease.status === PropertyLongStayStatus.ACTIVE;

    const portalAccessQuery = useQuery({
      queryFn: () => longStayPortalApi.getAccess(propertyId, lease.id),
      queryKey: queryKeys.propertyLongStayPortalAccess(propertyId, lease.id),
    });

    const memberships = useMemo(
      () => portalAccessQuery.data?.memberships ?? [],
      [portalAccessQuery.data?.memberships]
    );
    const showPortalRow = !portalAccessQuery.isPending && !portalAccessQuery.isError;
    const portalErrorMessage = useMemo(() => {
      if (!portalAccessQuery.isError) {
        return null;
      }
      if (portalAccessQuery.error instanceof Error) {
        return portalAccessQuery.error.message;
      }
      return "Failed to load portal status";
    }, [portalAccessQuery.error, portalAccessQuery.isError]);

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
        body: { invitePrimary?: boolean; secondaryIndexes?: number[] },
        target: TLeasePortalActingTarget
      ) => {
        setActingAction(action);
        setActingTarget(target);
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
          setActingTarget(null);
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
        void runPortalAction("revoke", target.membershipId, {}, target.actingTarget)
          .then(onDeleted)
          .catch(() => undefined);
      },
      [runPortalAction]
    );

    const { deleteConfirmationDialog: revokeConfirmationDialog, requestDelete: requestRevoke } =
      useDeleteConfirmation<TLeasePortalRevokeTarget>(revokeMutation.isPending, revokeFn);

    const requestRevokeConfirmation = useCallback(
      (
        membershipId: string | null | undefined,
        tenantName: string,
        target: TLeasePortalActingTarget
      ) => {
        if (!membershipId) {
          return;
        }
        requestRevoke({
          confirmLabel: "Revoke",
          description: `Revoke portal access for "${tenantName}"? They will no longer be able to access this lease in the tenant portal.`,
          target: { actingTarget: target, membershipId, tenantName },
          title: "Revoke portal access",
        });
      },
      [requestRevoke]
    );

    const handleInvitePrimary = useCallback(() => {
      void runPortalAction(
        "invite",
        primaryMembership?.id ?? null,
        {
          invitePrimary: true,
        },
        { kind: "primary" }
      );
    }, [primaryMembership?.id, runPortalAction]);

    const handleResendPrimary = useCallback(() => {
      void runPortalAction("resend", primaryMembership?.id ?? null, {}, { kind: "primary" });
    }, [primaryMembership?.id, runPortalAction]);

    const handleRevokePrimary = useCallback(() => {
      requestRevokeConfirmation(primaryMembership?.id, lease.guestName, { kind: "primary" });
    }, [lease.guestName, primaryMembership?.id, requestRevokeConfirmation]);

    const handleEditPrimary = useCallback(() => {
      setEditPrimaryOpen(true);
    }, []);

    const findSecondaryMembership = useCallback(
      (index: number) => {
        const tenant = lease.secondaryTenants[index];
        if (!tenant) {
          return { membership: null, tenant: null };
        }
        return {
          membership: findLeasePortalMembership(
            memberships,
            TenantMembershipRole.SECONDARY,
            tenant.email
          ),
          tenant,
        };
      },
      [lease.secondaryTenants, memberships]
    );

    const handleInviteSecondary = useCallback(
      (index: number) => {
        const { membership } = findSecondaryMembership(index);
        void runPortalAction(
          "invite",
          membership?.id ?? null,
          {
            secondaryIndexes: [index],
          },
          { index, kind: "secondary" }
        );
      },
      [findSecondaryMembership, runPortalAction]
    );

    const handleResendSecondary = useCallback(
      (index: number) => {
        const { membership } = findSecondaryMembership(index);
        void runPortalAction("resend", membership?.id ?? null, {}, { index, kind: "secondary" });
      },
      [findSecondaryMembership, runPortalAction]
    );

    const handleRevokeSecondary = useCallback(
      (index: number) => {
        const { membership, tenant } = findSecondaryMembership(index);
        if (!tenant) {
          return;
        }
        requestRevokeConfirmation(membership?.id, tenant.name, {
          index,
          kind: "secondary",
        });
      },
      [findSecondaryMembership, requestRevokeConfirmation]
    );

    const handleEditSecondary = useCallback(
      (index: number) => {
        const { tenant } = findSecondaryMembership(index);
        if (!tenant) {
          return;
        }
        setEditingSecondary({ index, tenant });
      },
      [findSecondaryMembership]
    );

    const handleDeleteSecondary = useCallback(
      (index: number, event: MouseEvent<HTMLButtonElement>) => {
        const { tenant } = findSecondaryMembership(index);
        if (!tenant) {
          return;
        }
        handleDelete({ index, tenant }, event);
      },
      [findSecondaryMembership, handleDelete]
    );

    const handleOpenAddSecondary = useCallback(() => {
      setAddSecondaryOpen(true);
    }, []);

    const handleInviteAll = useCallback(() => {
      void runPortalAction(
        "invite",
        null,
        {
          invitePrimary: inviteAllTargets.invitePrimary ? true : undefined,
          secondaryIndexes: inviteAllTargets.secondaryIndexes,
        },
        { kind: "invite-all" }
      );
    }, [inviteAllTargets.invitePrimary, inviteAllTargets.secondaryIndexes, runPortalAction]);

    const handleEditSecondaryDialogOpenChange = useCallback((nextOpen: boolean) => {
      if (!nextOpen) {
        setEditingSecondary(null);
      }
    }, []);

    const portalMutationPending =
      inviteMutation.isPending || resendMutation.isPending || revokeMutation.isPending;

    return (
      <>
        <Card>
          <CardContent className="space-y-3 p-6">
            <LeasePrimaryTenantBlock
              actingAction={actingAction}
              actingTarget={actingTarget}
              canEdit={canEditTenants}
              editAriaLabel="Edit primary tenant"
              email={primaryTenantContact.effectiveEmail}
              isPortalLinked={primaryTenantContact.source === "linked_user"}
              name={primaryTenantContact.effectiveName}
              onEdit={handleEditPrimary}
              onInvite={handleInvitePrimary}
              onResend={handleResendPrimary}
              onRevoke={handleRevokePrimary}
              phone={primaryTenantContact.effectivePhone}
              portalErrorMessage={portalErrorMessage}
              portalLoading={portalAccessQuery.isPending}
              portalMutationPending={portalMutationPending}
              portalState={primaryPortalState}
              roleLabel="Primary tenant"
              showPortalRow={showPortalRow}
            />

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
                    <LeaseSecondaryTenantRow
                      actingAction={actingAction}
                      actingTarget={actingTarget}
                      canEdit={canEditTenants}
                      index={index}
                      isDeletePending={removeMutation.isPending}
                      isQuickDeleteActive={isQuickDeleteActive}
                      key={`${tenant.name}-${index}`}
                      onDelete={handleDeleteSecondary}
                      onEdit={handleEditSecondary}
                      onInvite={handleInviteSecondary}
                      onResend={handleResendSecondary}
                      onRevoke={handleRevokeSecondary}
                      portalMutationPending={portalMutationPending}
                      portalState={rowPortalState}
                      showPortalRow={showPortalRow}
                      tenant={tenant}
                    />
                  );
                })}
              </div>
            ) : null}

            {canEditTenants ? (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  className="gap-1.5"
                  disabled={lease.secondaryTenants.length >= MAX_SECONDARY_TENANTS}
                  onClick={handleOpenAddSecondary}
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
                    onClick={handleInviteAll}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {actingTarget?.kind === "invite-all" ? "Inviting…" : "Invite all"}
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
            primaryTenantContact={primaryTenantContact}
            propertyId={propertyId}
          />
        ) : null}

        {editingSecondary ? (
          <EditSecondaryTenantDialog
            key={`${lease.id}-edit-secondary-${editingSecondary.index}`}
            lease={lease}
            onOpenChange={handleEditSecondaryDialogOpenChange}
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
