import { memo } from "react";

import { type TPropertyRole } from "@/packages/shared";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export interface IInvitePropertySummaryCardProps {
  inviterEmail: string;
  inviterName: string;
  propertyAddress: string;
  propertyName: string;
  role: TPropertyRole;
  roleLabel: string;
}

export const InvitePropertySummaryCard = memo(function InvitePropertySummaryCard({
  inviterEmail,
  inviterName,
  propertyAddress,
  propertyName,
  roleLabel,
}: IInvitePropertySummaryCardProps) {
  return (
    <Card className="rounded-xl border-border/80 bg-card/85 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-xl font-semibold tracking-tight">
          {propertyName}
        </CardTitle>
        <CardDescription>
          {propertyAddress} · {roleLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Invited by</span>
          <span className="text-end font-medium text-foreground">
            {inviterName}
            <span className="text-muted-foreground block text-xs font-normal">{inviterEmail}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
InvitePropertySummaryCard.displayName = "InvitePropertySummaryCard";
