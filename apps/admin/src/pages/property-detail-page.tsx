import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { memo, type MouseEvent, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AddPropertyMemberDialog } from "@/components/properties/add-property-member-dialog";
import { EditPropertyDialog } from "@/components/properties/edit-property-dialog";
import { PropertyMemberInviteStatusBadge } from "@/components/properties/property-member-invite-status-badge";
import { PropertyRoleBadge } from "@/components/properties/property-role-badge";
import { QuickDeleteButton } from "@/components/table/quick-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePropertyShell } from "@/hooks/use-property-shell";
import { usePropertyShellActions } from "@/hooks/use-property-shell-actions";
import { useQuickDelete } from "@/hooks/use-quick-delete";
import { propertiesApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  formatPhoneDisplay,
  type IPropertyInvite,
  type IPropertyMember,
  type IPropertyMemberUser,
  PropertyRole,
  type TPropertyRole,
} from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const ROLE_OPTIONS: { label: string; value: TPropertyRole }[] = [
  { label: "Owner", value: PropertyRole.OWNER },
  { label: "Manager", value: PropertyRole.MANAGER },
  { label: "Accountant", value: PropertyRole.ACCOUNTANT },
];

const MemberTableRow = memo(
  ({
    canManageMembers,
    creatorUserId,
    isQuickDeleteActive,
    isRemovePending,
    member,
    onChangeRole,
    onRemove,
    showActionsColumn,
    showStatusColumn,
  }: {
    canManageMembers: boolean;
    creatorUserId: string;
    isQuickDeleteActive: boolean;
    isRemovePending: boolean;
    member: IPropertyMember;
    onChangeRole: (userId: string, role: TPropertyRole) => void;
    onRemove: (member: IPropertyMember, event?: MouseEvent<HTMLButtonElement>) => void;
    showActionsColumn: boolean;
    showStatusColumn: boolean;
  }) => {
    const canEditMember = canManageMembers && member.userId !== creatorUserId;

    return (
      <TableRow>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{member.user.name}</span>
            <span className="text-muted-foreground text-xs">{member.user.email}</span>
          </div>
        </TableCell>
        <TableCell>
          <PropertyRoleBadge role={member.role} />
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {new Date(member.createdAt).toLocaleString()}
        </TableCell>
        {showStatusColumn ? <TableCell /> : null}
        {showActionsColumn ? (
          <TableCell>
            {canEditMember ? (
              <div className="flex items-center gap-2">
                <NativeSelect
                  className="h-7 w-auto px-2 text-xs"
                  onChange={(e) => onChangeRole(member.userId, e.target.value as TPropertyRole)}
                  options={ROLE_OPTIONS}
                  value={member.role}
                />
                <QuickDeleteButton
                  ariaLabel="Remove member"
                  disabled={isRemovePending}
                  onClick={(event) => onRemove(member, event)}
                  quickDeleteActive={isQuickDeleteActive}
                />
              </div>
            ) : null}
          </TableCell>
        ) : null}
      </TableRow>
    );
  }
);
MemberTableRow.displayName = "MemberTableRow";

const CreatorTableRow = memo(
  ({
    createdAt,
    creator,
    isCurrentUser,
    showActionsColumn,
    showStatusColumn,
  }: {
    createdAt: string;
    creator: IPropertyMemberUser;
    isCurrentUser: boolean;
    showActionsColumn: boolean;
    showStatusColumn: boolean;
  }) => (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">
            {creator.name}
            {isCurrentUser ? (
              <span className="text-muted-foreground ml-1.5 text-xs font-normal">(You)</span>
            ) : null}
          </span>
          <span className="text-muted-foreground text-xs">{creator.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          Owner
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(createdAt).toLocaleString()}
      </TableCell>
      {showStatusColumn ? <TableCell /> : null}
      {showActionsColumn ? <TableCell /> : null}
    </TableRow>
  )
);
CreatorTableRow.displayName = "CreatorTableRow";

const InviteTableRow = memo(
  ({ invite, showActionsColumn }: { invite: IPropertyInvite; showActionsColumn: boolean }) => (
    <TableRow className="bg-muted/20">
      <TableCell>
        <div className="flex flex-col">
          <span className="text-muted-foreground font-medium italic">{invite.email}</span>
          <span className="text-muted-foreground text-xs">Invite pending</span>
        </div>
      </TableCell>
      <TableCell>
        <PropertyRoleBadge role={invite.role} />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(invite.invitedAt).toLocaleString()}
      </TableCell>
      <TableCell>
        <PropertyMemberInviteStatusBadge invite={invite} />
      </TableCell>
      {showActionsColumn ? <TableCell /> : null}
    </TableRow>
  )
);
InviteTableRow.displayName = "InviteTableRow";

export const PropertyDetailPage = memo(() => {
  const { permissions, property, propertyId } = usePropertyShell();
  const { canManageMembers, canManageStructure } = permissions;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const memberRows = useMemo(
    () => property.members.filter((member) => member.userId !== property.createdBy),
    [property.createdBy, property.members]
  );

  const inviteRows = useMemo(() => property.invites ?? [], [property.invites]);
  const showStatusColumn = inviteRows.length > 0;
  const showActionsColumn = canManageMembers;

  const deleteMutation = useMutation({
    mutationFn: () => propertiesApi.delete(propertyId),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete property");
    },
    onSuccess: () => {
      toast.success("Property deleted");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      navigate("/properties");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ role, userId }: { role: TPropertyRole; userId: string }) =>
      propertiesApi.updateMember(propertyId, userId, { role }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyDetail(propertyId) });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => propertiesApi.removeMember(propertyId, userId),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to remove member");
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyDetail(propertyId) });
    },
  });

  const {
    deleteConfirmationDialog,
    handleDelete: handleRemoveMember,
    isQuickDeleteActive,
  } = useQuickDelete<IPropertyMember>({
    deleteFn: (member, onDeleted) =>
      removeMemberMutation.mutate(member.userId, { onSuccess: onDeleted }),
    getConfirmationOptions: (member) => ({
      confirmLabel: "Remove",
      description: `Remove ${member.user.name} from this property?`,
      target: member,
      title: "Remove member",
    }),
    isPending: removeMemberMutation.isPending,
  });

  const handleDelete = useCallback(() => {
    if (!globalThis.confirm("Delete this property? This cannot be undone.")) return;
    deleteMutation.mutate();
  }, [deleteMutation]);

  const headerActions = useMemo(
    () =>
      canManageStructure ? (
        <>
          <Button
            className="gap-1.5"
            onClick={() => setEditOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            className="gap-1.5"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
            size="sm"
            type="button"
            variant="destructive"
          >
            <Trash2 className="size-3.5" />
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </>
      ) : null,
    [canManageStructure, deleteMutation.isPending, handleDelete]
  );

  usePropertyShellActions(headerActions);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>Property information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {property.name}
            </p>
            <p>
              <span className="text-muted-foreground">Legal name:</span> {property.legalName ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Address:</span> {property.address}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span>{" "}
              {formatPhoneDisplay(property.phoneNumber)}
            </p>
            <p>
              <span className="text-muted-foreground">Created:</span>{" "}
              {new Date(property.createdAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Total members:</span> {memberRows.length + 1}
            </p>
            <p>
              <span className="text-muted-foreground">Total units:</span> {property.unitCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>
              Users assigned to this property and pending email invites.
            </CardDescription>
          </div>
          {canManageMembers ? (
            <Button
              className="gap-1.5"
              onClick={() => setAddMemberOpen(true)}
              size="sm"
              type="button"
            >
              <Plus className="size-3.5" />
              Add Member
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Added</TableHead>
                {showStatusColumn ? <TableHead>Status</TableHead> : null}
                {showActionsColumn ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              <CreatorTableRow
                createdAt={property.createdAt}
                creator={property.creator}
                isCurrentUser={currentUser?.id === property.createdBy}
                showActionsColumn={showActionsColumn}
                showStatusColumn={showStatusColumn}
              />
              {memberRows.map((member) => (
                <MemberTableRow
                  canManageMembers={canManageMembers}
                  creatorUserId={property.createdBy}
                  isQuickDeleteActive={isQuickDeleteActive}
                  isRemovePending={removeMemberMutation.isPending}
                  key={member.id}
                  member={member}
                  onChangeRole={(userId, role) => updateRoleMutation.mutate({ role, userId })}
                  onRemove={handleRemoveMember}
                  showActionsColumn={showActionsColumn}
                  showStatusColumn={showStatusColumn}
                />
              ))}
              {inviteRows.map((invite) => (
                <InviteTableRow
                  invite={invite}
                  key={invite.id}
                  showActionsColumn={showActionsColumn}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {deleteConfirmationDialog}

      <EditPropertyDialog onOpenChange={setEditOpen} open={editOpen} property={property} />
      <AddPropertyMemberDialog
        onOpenChange={setAddMemberOpen}
        open={addMemberOpen}
        propertyId={propertyId}
      />
    </>
  );
});
PropertyDetailPage.displayName = "PropertyDetailPage";
