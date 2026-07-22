import { memo, useMemo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format-money";
import { getLeaseDepositCloseOutCopy, type ILeaseDepositSummary } from "@/packages/shared";

interface LeaseDepositCloseOutDialogProps {
  depositSummary: ILeaseDepositSummary;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

export const LeaseDepositCloseOutDialog = memo(
  ({ depositSummary, onOpenChange, open, propertyId }: LeaseDepositCloseOutDialogProps) => {
    const copy = useMemo(() => getLeaseDepositCloseOutCopy(depositSummary), [depositSummary]);
    const incomePath = `/properties/${encodeURIComponent(propertyId)}/income`;

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>

          <DialogFormFields>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Held / collected
              </p>
              <p className="font-medium">{formatMoney(depositSummary.collected)}</p>
            </div>

            <p className="text-muted-foreground text-xs">
              <strong className="text-foreground font-medium">Refund</strong> returns money to the
              tenant. <strong className="text-foreground font-medium">Withhold</strong> by refunding
              only what you return — or skip refund if you keep the full deposit for damages.
            </p>
          </DialogFormFields>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Later
            </Button>
            <Button asChild type="button">
              <Link onClick={() => onOpenChange(false)} to={incomePath}>
                {copy.incomeCtaLabel}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
LeaseDepositCloseOutDialog.displayName = "LeaseDepositCloseOutDialog";
