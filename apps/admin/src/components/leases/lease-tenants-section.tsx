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
  getSecondaryPortalActingMembershipId,
  resolveSecondaryPortalMembershipForContact,
} from "@/lib/resolve-secondary-tenant-contacts-for-display";
import {
  type ILeasePrimaryTenantContact,
  type ILeaseSecondaryTenantContact,
  type IPropertyLongStay,
  MAX_SECONDARY_OCCUPANTS,
  PropertyLongStayStatus,
  TenantMembershipRole,
} from "@/packages/shared";

type TLeaseSecondaryTenantDeleteTarget = {
  contact: ILeaseSecondaryTenantContact;
  membershipId: string;
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
  secondaryTenantContacts: ILeaseSecondaryTenantContact[];
}

export const LeaseTenantsSection = memo(
  ({
    canManage,
    lease,
    primaryTenantContact,
    propertyId,
    secondaryTenantContacts,
  }: LeaseTenantsSectionProps) => {
    const queryClient = useQueryClient();
    const [addSecondaryOpen, setAddSecondaryOpen] = useState(false);
    const [editPrimaryOpen, setEditPrimaryOpen] = useState(false);
    const [editingSecondary, setEditingSecondary] = useState<{
      contact: ILeaseSecondaryTenantContact;
      membershipId: string;
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
      mutationFn: (body: {
        invitePrimary?: boolean;
        secondaryIndexes?: number[];
        secondaryMembershipIds?: string[];
      }) => longStayPortalApi.createInvites(propertyId, lease.id, body),
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
        body: {
          invitePrimary?: boolean;
          secondaryIndexes?: number[];
          secondaryMembershipIds?: string[];
        },
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

    const inviteAllTargets = getLeasePortalInviteAllTargets(
      lease,
      memberships,
      secondaryTenantContacts
    );
    const canInviteAll =
      canEditTenants &&
      (inviteAllTargets.invitePrimary || inviteAllTargets.secondaryMembershipIds.length > 0);

    const removeMutation = useMutation({
      mutationFn: (membershipId: string) =>
        longStaysApi.deleteSecondaryOccupant(propertyId, lease.id, membershipId),
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
        removeMutation.mutate(target.membershipId, { onSuccess: onDeleted });
      },
      [removeMutation]
    );

    const getConfirmationOptions = useCallback(
      (target: TLeaseSecondaryTenantDeleteTarget) => ({
        confirmLabel: "Remove",
        description: `Remove "${target.contact.effectiveName}" from this lease?`,
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

    const findSecondaryContact = useCallback(
      (index: number) => secondaryTenantContacts[index] ?? null,
      [secondaryTenantContacts]
    );

    const handleInviteSecondary = useCallback(
      (contact: ILeaseSecondaryTenantContact, _index: number) => {
        if (!contact.membershipId) {
          return;
        }

        const portalMembershipId =
          resolveSecondaryPortalMembershipForContact(contact, memberships)?.id ??
          contact.membershipId;

        void runPortalAction(
          "invite",
          portalMembershipId,
          { secondaryMembershipIds: [contact.membershipId] },
          { kind: "secondary", membershipId: contact.membershipId }
        );
      },
      [memberships, runPortalAction]
    );

    const handleResendSecondary = useCallback(
      (contact: ILeaseSecondaryTenantContact, _index: number) => {
        if (!contact.membershipId) {
          return;
        }

        const portalMembershipId = resolveSecondaryPortalMembershipForContact(
          contact,
          memberships
        )?.id;
        if (!portalMembershipId) {
          return;
        }

        void runPortalAction(
          "resend",
          portalMembershipId,
          {},
          { kind: "secondary", membershipId: contact.membershipId }
        );
      },
      [memberships, runPortalAction]
    );

    const handleRevokeSecondary = useCallback(
      (contact: ILeaseSecondaryTenantContact, _index: number) => {
        if (!contact.membershipId) {
          return;
        }

        const portalMembership = resolveSecondaryPortalMembershipForContact(contact, memberships);
        if (!portalMembership) {
          return;
        }

        requestRevokeConfirmation(portalMembership.id, contact.effectiveName, {
          kind: "secondary",
          membershipId: contact.membershipId,
        });
      },
      [memberships, requestRevokeConfirmation]
    );

    const handleEditSecondary = useCallback(
      (index: number) => {
        const contact = findSecondaryContact(index);
        if (!contact?.membershipId) {
          return;
        }
        setEditingSecondary({ contact, membershipId: contact.membershipId });
      },
      [findSecondaryContact]
    );

    const handleDeleteSecondary = useCallback(
      (index: number, event: MouseEvent<HTMLButtonElement>) => {
        const contact = findSecondaryContact(index);
        if (!contact?.membershipId) {
          return;
        }
        handleDelete({ contact, membershipId: contact.membershipId }, event);
      },
      [findSecondaryContact, handleDelete]
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
          secondaryMembershipIds: inviteAllTargets.secondaryMembershipIds,
        },
        { kind: "invite-all" }
      );
    }, [inviteAllTargets.invitePrimary, inviteAllTargets.secondaryMembershipIds, runPortalAction]);

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

            {secondaryTenantContacts.length > 0 ? (
              <div className="space-y-3 border-t pt-3">
                <p className="text-muted-foreground text-xs">Secondary tenants</p>
                {secondaryTenantContacts.map((contact, index) => {
                  if (!contact.membershipId) {
                    return null;
                  }

                  const membership = resolveSecondaryPortalMembershipForContact(
                    contact,
                    memberships
                  );
                  const rowPortalState = getLeasePortalRowState(
                    membership,
                    Boolean(contact.effectiveEmail?.trim())
                  );

                  const portalRowTarget = {
                    kind: "secondary" as const,
                    membershipId: getSecondaryPortalActingMembershipId(contact),
                  };

                  return (
                    <LeaseSecondaryTenantRow
                      actingAction={actingAction}
                      actingTarget={actingTarget}
                      canEdit={canEditTenants}
                      contact={contact}
                      index={index}
                      isDeletePending={removeMutation.isPending}
                      isQuickDeleteActive={isQuickDeleteActive}
                      key={contact.membershipId}
                      onDelete={handleDeleteSecondary}
                      onEdit={handleEditSecondary}
                      onInvite={handleInviteSecondary}
                      onResend={handleResendSecondary}
                      onRevoke={handleRevokeSecondary}
                      portalMutationPending={portalMutationPending}
                      portalRowTarget={portalRowTarget}
                      portalState={rowPortalState}
                      showDelete={canEditTenants}
                      showPortalRow={showPortalRow}
                    />
                  );
                })}
              </div>
            ) : null}

            {canEditTenants ? (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  className="gap-1.5"
                  disabled={secondaryTenantContacts.length >= MAX_SECONDARY_OCCUPANTS}
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
            primaryTenantEmail={primaryTenantContact.effectiveEmail}
            propertyId={propertyId}
            secondaryOccupantCount={secondaryTenantContacts.length}
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
            key={`${lease.id}-edit-secondary-${editingSecondary.membershipId}`}
            contact={editingSecondary.contact}
            isPortalLinked={editingSecondary.contact.source === "linked_user"}
            lease={lease}
            membershipId={editingSecondary.membershipId}
            onOpenChange={handleEditSecondaryDialogOpenChange}
            open={true}
            primaryTenantEmail={primaryTenantContact.effectiveEmail}
            propertyId={propertyId}
          />
        ) : null}

        {deleteConfirmationDialog}
        {revokeConfirmationDialog}
      </>
    );
  }
);
LeaseTenantsSection.displayName = "LeaseTenantsSection";
