import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { AddSecondaryTenantDialog } from "@/components/leases/add-secondary-tenant-dialog";
import { EditPrimaryTenantDialog } from "@/components/leases/edit-primary-tenant-dialog";
import { EditSecondaryTenantDialog } from "@/components/leases/edit-secondary-tenant-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { longStaysApi } from "@/lib/api-client";
import { invalidatePropertyLongStayCaches } from "@/lib/invalidate-property-long-stay-caches";
import {
  formatPhoneDisplay,
  type IPropertyLongStay,
  type IPropertyLongStaySecondaryTenant,
  PropertyLongStayStatus,
} from "@/packages/shared";

const MAX_SECONDARY_TENANTS = 10;

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

    const canEditTenants = canManage && lease.status === PropertyLongStayStatus.ACTIVE;

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
      },
    });

    return (
      <>
        <Card>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-muted-foreground text-xs">Primary tenant</p>
                <p className="font-medium">{lease.guestName}</p>
                <TenantContactLine label="email" value={lease.tenantEmail} />
                <TenantContactLine label="phone" value={lease.tenantPhone} />
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

            {lease.secondaryTenants.length > 0 ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-muted-foreground text-xs">Secondary tenants</p>
                {lease.secondaryTenants.map((tenant, index) => (
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
                disabled={lease.secondaryTenants.length >= MAX_SECONDARY_TENANTS}
                onClick={() => setAddSecondaryOpen(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="size-3.5" />
                Add secondary tenant
              </Button>
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
      </>
    );
  }
);
LeaseTenantsSection.displayName = "LeaseTenantsSection";
