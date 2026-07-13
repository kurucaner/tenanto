import { memo, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImportCsvDialogShellProps {
  bodyClassName?: string;
  children: ReactNode;
  description: string;
  footer: ReactNode;
  /**
   * Called when the dialog body mount changes. Pass this to VirtualizedTableBody /
   * VirtualizedList as scrollElement — it is the element with overflow-y-auto.
   */
  onBodyElementReady?: (element: HTMLDivElement | null) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export const ImportCsvDialogShell = memo(
  ({
    bodyClassName,
    children,
    description,
    footer,
    onBodyElementReady,
    onOpenChange,
    open,
    title,
  }: ImportCsvDialogShellProps) => (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col sm:max-w-[min(1100px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div
          className={bodyClassName ?? "min-h-0 flex-1 overflow-y-auto px-6 py-5"}
          ref={onBodyElementReady}
        >
          {children}
        </div>

        {footer}
      </DialogContent>
    </Dialog>
  )
);
ImportCsvDialogShell.displayName = "ImportCsvDialogShell";
