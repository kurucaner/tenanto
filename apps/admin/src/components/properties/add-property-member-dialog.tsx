import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserCheck } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi, propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { PropertyRole, type TPropertyRole } from "@/packages/shared";

const ROLE_OPTIONS: { label: string; value: TPropertyRole }[] = [
  { label: "Owner", value: PropertyRole.OWNER },
  { label: "Manager", value: PropertyRole.MANAGER },
  { label: "Accountant", value: PropertyRole.ACCOUNTANT },
];

const SEARCH_DEBOUNCE_MS = 300;

interface AddPropertyMemberDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const AddPropertyMemberDialog = memo(
  ({ onOpenChange, open, propertyId }: AddPropertyMemberDialogProps) => {
    const queryClient = useQueryClient();
    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [role, setRole] = useState<TPropertyRole>(PropertyRole.OWNER);

    useEffect(() => {
      const id = setTimeout(
        () => setDebouncedSearch(searchInput.trim()),
        SEARCH_DEBOUNCE_MS
      );
      return () => clearTimeout(id);
    }, [searchInput]);

    useEffect(() => {
      setSelectedUserId(null);
    }, [debouncedSearch]);

    const usersQuery = useQuery({
      enabled: debouncedSearch.length > 0,
      queryFn: () => adminApi.listUsers({ limit: 8, q: debouncedSearch }),
      queryKey: ["admin", "users-search", debouncedSearch],
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
      setDebouncedSearch("");
      setSelectedUserId(null);
      setRole(PropertyRole.OWNER);
    };

    const selectedUser = usersQuery.data?.users.find((u) => u.id === selectedUserId);
    const showResults = debouncedSearch.length > 0;

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Search for a user and assign them a role on this property.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-member-search">User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9"
                  id="add-member-search"
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name or email…"
                  value={searchInput}
                />
              </div>

              {showResults ? (
                <div className="flex max-h-44 flex-col overflow-y-auto rounded-lg border border-border">
                  {usersQuery.isPending ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
                  ) : null}
                  {!usersQuery.isPending && usersQuery.data?.users.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No users found.</p>
                  ) : null}
                  {!usersQuery.isPending && (usersQuery.data?.users.length ?? 0) > 0
                    ? usersQuery.data?.users.map((user) => (
                        <button
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                            selectedUserId === user.id && "bg-muted"
                          )}
                          key={user.id}
                          onClick={() => setSelectedUserId(user.id)}
                          type="button"
                        >
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{user.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                          {selectedUserId === user.id ? (
                            <UserCheck className="size-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                      ))
                    : null}
                </div>
              ) : null}

              {selectedUser ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserCheck className="size-3.5 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">{selectedUser.name}</span>
                    {" "}({selectedUser.email})
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-member-role">Role</Label>
              <select
                className={cn(
                  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "dark:bg-input/30"
                )}
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
