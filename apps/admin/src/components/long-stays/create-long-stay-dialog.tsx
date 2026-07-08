import { useMutation } from "@tanstack/react-query";
import { memo, useMemo, useState } from "react";
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
import { longStaysApi } from "@/lib/api-client";
import { calculateLeaseEndDate } from "@/lib/lease-date-utils";
import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";
import type { IPropertyUnit } from "@/packages/shared";

const DEFAULT_TERM_MONTHS = "12";

interface CreateLongStayDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
  unit: IPropertyUnit;
}

export const CreateLongStayDialog = memo(
  ({ onOpenChange, open, propertyId, unit }: CreateLongStayDialogProps) => {
    const [guestName, setGuestName] = useState("");
    const [leaseStartDate, setLeaseStartDate] = useState(getTodayLocalIsoDate());
    const [termMonths, setTermMonths] = useState(DEFAULT_TERM_MONTHS);
    const [monthlyRent, setMonthlyRent] = useState("");

    const parsedTermMonths = Number.parseInt(termMonths, 10);
    const parsedMonthlyRent = Number(monthlyRent);

    const leaseEndDate = useMemo(() => {
      if (leaseStartDate === "" || !Number.isInteger(parsedTermMonths) || parsedTermMonths < 1) {
        return null;
      }
      return calculateLeaseEndDate(leaseStartDate, parsedTermMonths);
    }, [leaseStartDate, parsedTermMonths]);

    const mutation = useMutation({
      mutationFn: () =>
        longStaysApi.create(propertyId, {
          guestName: guestName.trim(),
          leaseStartDate,
          monthlyRent: parsedMonthlyRent,
          termMonths: parsedTermMonths,
          unitId: unit.id,
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to create long stay");
      },
      onSuccess: () => {
        toast.success("Long stay created");
        handleClose();
      },
    });

    const handleClose = () => {
      onOpenChange(false);
      setGuestName("");
      setLeaseStartDate(getTodayLocalIsoDate());
      setTermMonths(DEFAULT_TERM_MONTHS);
      setMonthlyRent("");
    };

    const canSubmit =
      guestName.trim() !== "" &&
      leaseStartDate !== "" &&
      Number.isInteger(parsedTermMonths) &&
      parsedTermMonths >= 1 &&
      parsedTermMonths <= 60 &&
      Number.isFinite(parsedMonthlyRent) &&
      parsedMonthlyRent >= 0 &&
      !mutation.isPending;

    return (
      <Dialog onOpenChange={handleClose} open={open}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Long Stay</DialogTitle>
            <DialogDescription>
              Add a lease for unit {unit.unitNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="long-stay-guest-name">Guest Name</Label>
              <Input
                autoFocus
                id="long-stay-guest-name"
                onChange={(e) => setGuestName(e.target.value)}
                value={guestName}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="long-stay-start-date">Lease Start Date</Label>
                <Input
                  id="long-stay-start-date"
                  min={getTodayLocalIsoDate()}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  type="date"
                  value={leaseStartDate}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="long-stay-term-months">Term (Months)</Label>
                <Input
                  id="long-stay-term-months"
                  max={60}
                  min={1}
                  onChange={(e) => setTermMonths(e.target.value)}
                  type="number"
                  value={termMonths}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="long-stay-monthly-rent">Monthly Rent</Label>
              <Input
                id="long-stay-monthly-rent"
                inputMode="decimal"
                onChange={(e) => setMonthlyRent(e.target.value)}
                type="text"
                value={monthlyRent}
              />
            </div>

            {leaseEndDate ? (
              <p className="text-muted-foreground text-xs">
                Lease ends: {new Date(`${leaseEndDate}T00:00:00`).toLocaleDateString()}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={handleClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} type="button">
              {mutation.isPending ? "Creating…" : "Add Long Stay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateLongStayDialog.displayName = "CreateLongStayDialog";
