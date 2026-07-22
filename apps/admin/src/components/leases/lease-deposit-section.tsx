import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canShowRecordLeaseDepositCta,
  formatLeaseDepositBalanceStatusLabel,
  getLeaseDepositBalanceRows,
} from "@/lib/lease-deposit-display";
import {
  type ILeaseDepositSummary,
  type IPropertyLongStay,
  LeaseDepositBalanceStatus,
  needsLeaseDepositCloseOut,
  PropertyLongStayStatus,
} from "@/packages/shared";

interface LeaseDepositSectionProps {
  canManage: boolean;
  depositSummary: ILeaseDepositSummary;
  lease: IPropertyLongStay;
  onRecordDeposit: () => void;
  onSettleDeposit: () => void;
}

function depositStatusBadgeVariant(
  status: ILeaseDepositSummary["status"]
): "default" | "outline" | "secondary" {
  switch (status) {
    case LeaseDepositBalanceStatus.HELD:
      return "default";
    case LeaseDepositBalanceStatus.REFUNDED:
      return "secondary";
    case LeaseDepositBalanceStatus.DUE:
    case LeaseDepositBalanceStatus.PARTIAL:
    case LeaseDepositBalanceStatus.NONE:
      return "outline";
  }
}

export const LeaseDepositSection = memo(
  ({
    canManage,
    depositSummary,
    lease,
    onRecordDeposit,
    onSettleDeposit,
  }: LeaseDepositSectionProps) => {
    const isActive = lease.status === PropertyLongStayStatus.ACTIVE;
    const canRecord = canManage && isActive && canShowRecordLeaseDepositCta(depositSummary);
    const canSettle = canManage && needsLeaseDepositCloseOut(depositSummary);
    const rows = getLeaseDepositBalanceRows(depositSummary);

    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Security deposit
                </p>
                {depositSummary.status !== LeaseDepositBalanceStatus.NONE ? (
                  <Badge variant={depositStatusBadgeVariant(depositSummary.status)}>
                    {formatLeaseDepositBalanceStatusLabel(depositSummary.status)}
                  </Badge>
                ) : null}
              </div>
              <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">Expected</dt>
                <dd className="font-medium">{rows.expectedLabel}</dd>
                <dt className="text-muted-foreground">Collected</dt>
                <dd className="font-medium">{rows.collectedLabel}</dd>
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd className="font-medium">{rows.outstandingLabel}</dd>
              </dl>
            </div>
            {canRecord || canSettle ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {canSettle ? (
                  <Button onClick={onSettleDeposit} type="button" variant="outline">
                    Settle deposit
                  </Button>
                ) : null}
                {canRecord ? (
                  <Button onClick={onRecordDeposit} type="button" variant="outline">
                    Record deposit
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }
);
LeaseDepositSection.displayName = "LeaseDepositSection";
