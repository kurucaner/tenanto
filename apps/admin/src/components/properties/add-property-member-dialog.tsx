import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi, propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { PropertyRole, type TPropertyRole } from "@/packages/shared";

const ROLE_OPTIONS: { label: string; value: TPropertyRole }[] = [
  { label: "Owner", value: PropertyRole.OWNER },
  { label: "Manager", value: PropertyRole.MANAGER },
  { label: "Accountant", value: PropertyRole.ACCOUNTANT },
];

interface AddPropertyMemberDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const AddPropertyMemberDialog = memo(
  ({ onOpenChange, open, propertyId }: AddPropertyMemberDialogProps) => {
    const queryClient = useQueryClient();
    const [searchInput, setSearchInput] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [role, setRole] = useState<TPropertyRole>(PropertyRole.OWNER);

    const usersQuery = useQuery({
      enabled: appliedSearch.trim().length > 0,
      queryFn: () => adminApi.listUsers({ limit: 10, q: appliedSearch.trim() }),
      queryKey: ["admin", "users-search", appliedSearch],
    });

    const mutation = useMutation({
      mutationFn: () => {
        if (!selectedUserId) throw new Error("No user selected");
        return propertiesApi.addMember(propertyId, { role, userId: selectedUserId });
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to add member");
      },
      onSuccess: () => {
        toast.success("Member added");
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.propertyDetail(propertyId),
        });
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setSearchInput("");
      setAppliedSearch("");
      setSelectedUserId(null);
      setRole(PropertyRole.OWNER);
    };

    const selectedUser = usersQuery.data?.users.find((u) => u.id === selectedUserId);

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Search User</Label>
              <div className="flex gap-2">
                <Input
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setAppliedSearch(searchInput.trim());
                      setSelectedUserId(null);
                    }
                  }}
                  placeholder="Search by name or email…"
                  value={searchInput}
                />
                <Button
                  onClick={() => {
                    setAppliedSearch(searchInput.trim());
                    setSelectedUserId(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Search
                </Button>
              </div>
            </div>

            {usersQuery.isPending && appliedSearch && (
              <p className="text-muted-foreground text-sm">Searching…</p>
            )}

            {usersQuery.data && (
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-1">
                {usersQuery.data.users.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-sm">No users found.</p>
                ) : (
                  usersQuery.data.users.map((user) => (
                    <button
                      className={`flex flex-col rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                        selectedUserId === user.id ? "bg-accent font-medium" : ""
                      }`}
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      type="button"
                    >
                      <span>{user.name}</span>
                      <span className="text-muted-foreground text-xs">{user.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedUser && (
              <p className="text-sm">
                Selected:{" "}
                <span className="font-medium">
                  {selectedUser.name} ({selectedUser.email})
                </span>
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="add-member-role">Role</Label>
              <select
                className="border-input bg-background h-9 rounded-lg border px-3 text-sm"
                id="add-member-role"
                onChange={(e) => setRole(e.target.value as TPropertyRole)}
                value={role}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button disabled={mutation.isPending} onClick={handleClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={mutation.isPending || !selectedUserId}
              onClick={() => mutation.mutate()}
              type="button"
            >
              {mutation.isPending ? "Adding…" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
AddPropertyMemberDialog.displayName = "AddPropertyMemberDialog";
