import { memo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteConfirmationDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isPending?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export const DeleteConfirmationDialog = memo(
  ({
    cancelLabel = "Cancel",
    confirmLabel = "Delete",
    description,
    isPending = false,
    onConfirm,
    onOpenChange,
    open,
    title,
  }: DeleteConfirmationDialogProps) => {
    const handleOpenChange = (nextOpen: boolean) => {
      if (!nextOpen && isPending) {
        return;
      }
      onOpenChange(nextOpen);
    };

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              {cancelLabel}
            </Button>
            <Button disabled={isPending} onClick={onConfirm} type="button" variant="destructive">
              {isPending ? `${confirmLabel}…` : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
DeleteConfirmationDialog.displayName = "DeleteConfirmationDialog";
