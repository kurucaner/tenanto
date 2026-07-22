import { memo, useCallback } from "react";

import { RefundEntryFields } from "@/components/income/refund-entry-fields";
import {
  type TRefundEntryConfirmPayload,
  useRefundEntryForm,
} from "@/components/income/use-refund-entry-form";
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

export type {
  TRefundEntryConfirmPayload,
  TRefundEntryMode,
} from "@/components/income/use-refund-entry-form";

interface RefundEntryDialogProps {
  cap: number;
  confirmLabel?: string;
  description: string;
  fullOptionLabel?: string;
  isPending?: boolean;
  onConfirm: (payload: TRefundEntryConfirmPayload) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  partialOptionLabel?: string;
  title: string;
}

export const RefundEntryDialog = memo(
  ({
    cap,
    confirmLabel = "Refund",
    description,
    fullOptionLabel = "Full refund",
    isPending = false,
    onConfirm,
    onOpenChange,
    open,
    partialOptionLabel = "Partial refund",
    title,
  }: RefundEntryDialogProps) => {
    const { canSubmit, confirm, mode, partialAmount, setMode, setPartialAmount } =
      useRefundEntryForm({
        cap,
        onConfirm,
        resetToken: open,
      });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen && isPending) {
          return;
        }
        onOpenChange(nextOpen);
      },
      [isPending, onOpenChange]
    );

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogFormFields>
            <RefundEntryFields
              cap={cap}
              fullOptionLabel={fullOptionLabel}
              mode={mode}
              onModeChange={setMode}
              onPartialAmountChange={setPartialAmount}
              partialAmount={partialAmount}
              partialOptionLabel={partialOptionLabel}
            />
          </DialogFormFields>

          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending || !canSubmit} onClick={confirm} type="button">
              {isPending ? "Refund…" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
RefundEntryDialog.displayName = "RefundEntryDialog";
