import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, UserMinus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AddPropertyMemberDialog } from "@/components/properties/add-property-member-dialog";
import { EditPropertyDialog } from "@/components/properties/edit-property-dialog";
import { PropertyRoleBadge } from "@/components/properties/property-role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { formatPhoneDisplay, type IPropertyMember, type IPropertyMemberUser, PropertyRole, type TPropertyRole } from "@/packages/shared";
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
    member,
    onChangeRole,
    onRemove,
  }: {
    canManageMembers: boolean;
    creatorUserId: string;
    member: IPropertyMember;
    onChangeRole: (userId: string, role: TPropertyRole) => void;
    onRemove: (userId: string) => void;
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
        <TableCell>
          {canEditMember ? (
            <div className="flex items-center gap-2">
              <select
                className="border-input bg-background h-7 rounded border px-2 text-xs"
                onChange={(e) => onChangeRole(member.userId, e.target.value as TPropertyRole)}
                value={member.role}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button
                aria-label="Remove member"
                onClick={() => onRemove(member.userId)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <UserMinus className="size-4" />
              </Button>
            </div>
          ) : null}
        </TableCell>
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
  }: {
    createdAt: string;
    creator: IPropertyMemberUser;
    isCurrentUser: boolean;
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
      <TableCell />
    </TableRow>
  )
);
CreatorTableRow.displayName = "CreatorTableRow";

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

  const deleteMutation = useMutation({
    mutationFn: () => propertiesApi.delete(propertyId),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete property");
    },
    onSuccess: () => {
      toast.success("Property deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "properties"] });
      navigate("/properties");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { role: TPropertyRole; userId: string }) =>
      propertiesApi.updateMember(propertyId, userId, { role }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.propertyDetail(propertyId) });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => propertiesApi.removeMember(propertyId, userId),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to remove member");
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.propertyDetail(propertyId) });
    },
  });

  const handleDelete = useCallback(() => {
    if (!globalThis.confirm("Delete this property? This cannot be undone.")) return;
    deleteMutation.mutate();
  }, [deleteMutation]);

  const handleRemoveMember = (userId: string) => {
    if (!globalThis.confirm("Remove this member from the property?")) return;
    removeMemberMutation.mutate(userId);
  };

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
              <span className="text-muted-foreground">Phone:</span> {formatPhoneDisplay(property.phoneNumber)}
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
            <CardDescription>Users assigned to this property with their roles.</CardDescription>
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
                {canManageMembers ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              <CreatorTableRow
                createdAt={property.createdAt}
                creator={property.creator}
                isCurrentUser={currentUser?.id === property.createdBy}
              />
              {memberRows.map((member) => (
                <MemberTableRow
                  canManageMembers={canManageMembers}
                  creatorUserId={property.createdBy}
                  key={member.id}
                  member={member}
                  onChangeRole={(userId, role) => updateRoleMutation.mutate({ role, userId })}
                  onRemove={handleRemoveMember}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
