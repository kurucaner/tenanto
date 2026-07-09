import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleDollarSign, Pencil, Plus, X } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { AddSecondaryTenantDialog } from "@/components/leases/add-secondary-tenant-dialog";
import { EditPrimaryTenantDialog } from "@/components/leases/edit-primary-tenant-dialog";
import { EditSecondaryTenantDialog } from "@/components/leases/edit-secondary-tenant-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { longStaysApi } from "@/lib/api-client";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  formatPhoneDisplay,
  type IPropertyLongStay,
  type IPropertyLongStaySecondaryTenant,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeaseDetailSheetProps {
  canManage: boolean;
  lease: IPropertyLongStay | null;
  onOpenChange: (open: boolean) => void;
  onRecordRent: (lease: IPropertyLongStay, month?: string) => void;
  open: boolean;
  propertyId: string;
  unitLabelById: Map<string, string>;
}

const MAX_SECONDARY_TENANTS = 10;

function formatMonthLabel(month: string): string {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthNum = parts[1] ?? 1;
  return new Date(year, monthNum - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function TenantContactLine({ label, value }: { label: string; value: string | null }) {
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

export const LeaseDetailSheet = memo(
  ({
    canManage,
    lease,
    onOpenChange,
    onRecordRent,
    open,
    propertyId,
    unitLabelById,
  }: LeaseDetailSheetProps) => {
    const queryClient = useQueryClient();
    const [addSecondaryOpen, setAddSecondaryOpen] = useState(false);
    const [editPrimaryOpen, setEditPrimaryOpen] = useState(false);
    const [editingSecondary, setEditingSecondary] = useState<{
      index: number;
      tenant: IPropertyLongStaySecondaryTenant;
    } | null>(null);

    const detailQuery = useQuery({
      enabled: open && lease != null,
      queryFn: () => longStaysApi.get(propertyId, lease!.id),
      queryKey: adminQueryKeys.propertyLongStay(propertyId, lease?.id ?? ""),
    });

    const removeMutation = useMutation({
      mutationFn: (tenantIndex: number) => {
        const displayLease = detailQuery.data?.longStay ?? lease;
        if (!displayLease) {
          throw new Error("Lease not found");
        }
        const nextTenants = displayLease.secondaryTenants.filter((_, index) => index !== tenantIndex);
        return longStaysApi.update(propertyId, displayLease.id, {
          secondaryTenants: nextTenants,
        });
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to remove secondary tenant");
      },
      onSuccess: () => {
        toast.success("Secondary tenant removed");
        invalidatePropertyLongStayCaches(queryClient, propertyId);
      },
    });

    const detail = detailQuery.data;
    const displayLease = detail?.longStay ?? lease;
    const rentSchedule = detail?.rentSchedule ?? [];
    const canEditTenants =
      canManage && displayLease?.status === PropertyLongStayStatus.ACTIVE;

    return (
      <>
        <Sheet onOpenChange={onOpenChange} open={open}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            {displayLease ? (
              <>
                <SheetHeader>
                  <SheetTitle>{displayLease.guestName}</SheetTitle>
                  <SheetDescription>
                    Unit {unitLabelById.get(displayLease.unitId) ?? displayLease.unitId}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 flex flex-col gap-6 px-4 pb-6">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        displayLease.status === PropertyLongStayStatus.ACTIVE
                          ? "default"
                          : "secondary"
                      }
                    >
                      {displayLease.status === PropertyLongStayStatus.ACTIVE ? "Active" : "Ended"}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      {formatMoney(displayLease.monthlyRent)}/mo
                    </span>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-medium">Tenants</h3>
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-muted-foreground text-xs">Primary tenant</p>
                          <p className="font-medium">{displayLease.guestName}</p>
                          <TenantContactLine label="email" value={displayLease.tenantEmail} />
                          <TenantContactLine label="phone" value={displayLease.tenantPhone} />
                        </div>
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

                      {displayLease.secondaryTenants.length > 0 ? (
                        <div className="space-y-2 border-t pt-3">
                          <p className="text-muted-foreground text-xs">Secondary tenants</p>
                          {displayLease.secondaryTenants.map((tenant, index) => (
                            <div
                              className="flex items-start justify-between gap-2"
                              key={`${tenant.name}-${index}`}
                            >
                              <div>
                                <p className="text-sm font-medium">{tenant.name}</p>
                                <TenantContactLine label="email" value={tenant.email} />
                                <TenantContactLine label="phone" value={tenant.phone} />
                              </div>
                              {canEditTenants ? (
                                <div className="flex items-center">
                                  <Button
                                    aria-label={`Edit ${tenant.name}`}
                                    onClick={() => setEditingSecondary({ index, tenant })}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    aria-label={`Remove ${tenant.name}`}
                                    disabled={removeMutation.isPending}
                                    onClick={() => removeMutation.mutate(index)}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {canEditTenants ? (
                        <Button
                          className="gap-1.5"
                          disabled={displayLease.secondaryTenants.length >= MAX_SECONDARY_TENANTS}
                          onClick={() => setAddSecondaryOpen(true)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Plus className="size-3.5" />
                          Add secondary tenant
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Lease period</dt>
                      <dd className="font-medium">
                        {new Date(`${displayLease.leaseStartDate}T00:00:00`).toLocaleDateString()} →{" "}
                        {new Date(
                          `${displayLease.actualEndDate ?? displayLease.leaseEndDate}T00:00:00`
                        ).toLocaleDateString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Term</dt>
                      <dd className="font-medium">{displayLease.termMonths} months</dd>
                    </div>
                  </dl>

                  {displayLease.status === PropertyLongStayStatus.ACTIVE ? (
                    <Button
                      className="gap-1.5"
                      onClick={() => onRecordRent(displayLease)}
                      type="button"
                    >
                      <CircleDollarSign className="size-3.5" />
                      Record Rent
                    </Button>
                  ) : null}

                  <div>
                    <h3 className="mb-3 text-sm font-medium">Rent Schedule</h3>
                    {detailQuery.isPending ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : rentSchedule.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No rent months in this lease.</p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {rentSchedule.map((item) => (
                          <li
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                            key={item.month}
                          >
                            <div className="flex items-center gap-2">
                              {item.isPaid ? (
                                <Check className="size-4 text-green-600" />
                              ) : (
                                <span className="inline-block size-4 rounded-full border" />
                              )}
                              <span className="text-sm">{formatMonthLabel(item.month)}</span>
                            </div>
                            {item.isPaid ? (
                              <Badge variant="secondary">Paid</Badge>
                            ) : displayLease.status === PropertyLongStayStatus.ACTIVE ? (
                              <Button
                                onClick={() => onRecordRent(displayLease, item.month)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Record
                              </Button>
                            ) : (
                              <Badge variant="outline">Missing</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>

        {displayLease && addSecondaryOpen ? (
          <AddSecondaryTenantDialog
            key={`${displayLease.id}-add-secondary`}
            lease={displayLease}
            onOpenChange={setAddSecondaryOpen}
            open={true}
            propertyId={propertyId}
          />
        ) : null}

        {displayLease && editPrimaryOpen ? (
          <EditPrimaryTenantDialog
            key={`${displayLease.id}-edit-primary`}
            lease={displayLease}
            onOpenChange={setEditPrimaryOpen}
            open={true}
            propertyId={propertyId}
          />
        ) : null}

        {displayLease && editingSecondary ? (
          <EditSecondaryTenantDialog
            key={`${displayLease.id}-edit-secondary-${editingSecondary.index}`}
            lease={displayLease}
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
      </>
    );
  }
);
LeaseDetailSheet.displayName = "LeaseDetailSheet";
