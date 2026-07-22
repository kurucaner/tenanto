import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canRecordLeaseSecurityDeposit } from "@/lib/build-lease-record-deposit-prefill";
import { formatLeaseSecurityDepositDisplay } from "@/lib/lease-deposit-display";
import { type IPropertyLongStay, PropertyLongStayStatus } from "@/packages/shared";

interface LeaseDepositSectionProps {
  canManage: boolean;
  lease: IPropertyLongStay;
  onRecordDeposit: () => void;
}

export const LeaseDepositSection = memo(
  ({ canManage, lease, onRecordDeposit }: LeaseDepositSectionProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;
    const canRecord =
      canManage && isActive && canRecordLeaseSecurityDeposit(lease);

    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Security deposit
              </p>
              <p className="text-sm font-medium">
                Expected: {formatLeaseSecurityDepositDisplay(lease.securityDepositAmount)}
              </p>
            </div>
            {canRecord ? (
              <Button onClick={onRecordDeposit} type="button" variant="outline">
                Record deposit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }
);
LeaseDepositSection.displayName = "LeaseDepositSection";
