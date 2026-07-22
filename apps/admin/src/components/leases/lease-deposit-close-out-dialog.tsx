import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

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
import { RadioGroupFieldset, RadioOption } from "@/components/ui/radio-option";
import { Skeleton } from "@/components/ui/skeleton";
import { incomeLinesApi } from "@/lib/api-client";
import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import { formatMoney } from "@/lib/format-money";
import { invalidatePropertyIncomeCaches } from "@/lib/invalidate-property-income-caches";
import { queryKeys } from "@/lib/query-keys";
import {
  getIncomeLineRefundableCap,
  getLeaseDepositCloseOutCopy,
  type ILeaseDepositSummary,
  IncomeRefundFilter,
  type IPropertyIncomeLine,
  isDepositIncomeLine,
} from "@/packages/shared";

type TCloseOutStep = "explain" | "pickLine" | "refund";

interface LeaseDepositCloseOutDialogProps {
  depositSummary: ILeaseDepositSummary;
  longStayId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  propertyId: string;
}

function isRefundableDepositLine(line: IPropertyIncomeLine): boolean {
  return isDepositIncomeLine(line) && line.refundedAt === null;
}

function formatDepositLineLabel(line: IPropertyIncomeLine): string {
  return `${formatIsoDateDisplay(line.transactionDate)} · ${formatMoney(line.amount)}`;
}

function getStepHeader(
  step: TCloseOutStep,
  copy: ReturnType<typeof getLeaseDepositCloseOutCopy>
): { description: string; title: string } {
  if (step === "pickLine") {
    return {
      description:
        "This lease has more than one security deposit collection. Select which line to refund.",
      title: "Choose deposit to refund",
    };
  }
  if (step === "refund") {
    return {
      description:
        "Return part or all of the held deposit to the tenant. Any amount you don't refund stays withheld (for example, for damages).",
      title: "Refund security deposit",
    };
  }
  return { description: copy.body, title: copy.title };
}

const CloseOutLoadingBody = memo(function CloseOutLoadingBody() {
  return (
    <DialogFormFields>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-16 w-full" />
    </DialogFormFields>
  );
});

const CloseOutErrorBody = memo(function CloseOutErrorBody({ message }: { message: string }) {
  return (
    <DialogFormFields>
      <p className="text-destructive text-sm">{message}</p>
    </DialogFormFields>
  );
});

const CloseOutExplainBody = memo(function CloseOutExplainBody({
  collected,
  hasNoRefundableLines,
}: {
  collected: number;
  hasNoRefundableLines: boolean;
}) {
  return (
    <DialogFormFields>
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Held / collected
        </p>
        <p className="font-medium">{formatMoney(collected)}</p>
      </div>

      {hasNoRefundableLines ? (
        <p className="text-muted-foreground text-sm">
          No refundable security deposit lines were found for this lease. Close and try again later
          if a deposit was collected.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground font-medium">Refund</strong> returns money to the
          tenant. <strong className="text-foreground font-medium">Withhold</strong> by refunding
          only what you return — or by not refunding if you keep the full deposit for damages.
        </p>
      )}
    </DialogFormFields>
  );
});

const CloseOutPickLineBody = memo(function CloseOutPickLineBody({
  lines,
  onSelect,
  selectedLineId,
}: {
  lines: IPropertyIncomeLine[];
  onSelect: (lineId: string) => void;
  selectedLineId: string | null;
}) {
  return (
    <DialogFormFields>
      <RadioGroupFieldset
        legend="Deposit line"
        onValueChange={onSelect}
        value={selectedLineId ?? undefined}
      >
        {lines.map((line) => (
          <RadioOption key={line.id} label={formatDepositLineLabel(line)} value={line.id} />
        ))}
      </RadioGroupFieldset>
    </DialogFormFields>
  );
});

interface CloseOutRefundBodyProps {
  cap: number;
  line: IPropertyIncomeLine;
  mode: ReturnType<typeof useRefundEntryForm>["mode"];
  onModeChange: ReturnType<typeof useRefundEntryForm>["setMode"];
  onPartialAmountChange: ReturnType<typeof useRefundEntryForm>["setPartialAmount"];
  partialAmount: string;
}

const CloseOutRefundBody = memo(function CloseOutRefundBody({
  cap,
  line,
  mode,
  onModeChange,
  onPartialAmountChange,
  partialAmount,
}: CloseOutRefundBodyProps) {
  return (
    <DialogFormFields>
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Selected line
        </p>
        <p className="font-medium">
          {formatIsoDateDisplay(line.transactionDate)} · {formatMoney(cap)} refundable
        </p>
      </div>
      <RefundEntryFields
        cap={cap}
        fullOptionLabel="Full refund (return entire remaining amount)"
        mode={mode}
        onModeChange={onModeChange}
        onPartialAmountChange={onPartialAmountChange}
        partialAmount={partialAmount}
        partialOptionLabel="Partial refund (return some; remainder withheld)"
      />
    </DialogFormFields>
  );
});

interface CloseOutBodyProps {
  collected: number;
  hasNoRefundableLines: boolean;
  isLoading: boolean;
  loadError: boolean;
  loadErrorMessage: string;
  refundableLines: IPropertyIncomeLine[];
  refundBody: CloseOutRefundBodyProps | null;
  selectedLineId: string | null;
  setSelectedLineId: (lineId: string) => void;
  step: TCloseOutStep;
}

const CloseOutBody = memo(function CloseOutBody({
  collected,
  hasNoRefundableLines,
  isLoading,
  loadError,
  loadErrorMessage,
  refundableLines,
  refundBody,
  selectedLineId,
  setSelectedLineId,
  step,
}: CloseOutBodyProps) {
  if (isLoading) {
    return <CloseOutLoadingBody />;
  }
  if (loadError) {
    return <CloseOutErrorBody message={loadErrorMessage} />;
  }
  if (step === "explain") {
    return (
      <CloseOutExplainBody collected={collected} hasNoRefundableLines={hasNoRefundableLines} />
    );
  }
  if (step === "pickLine") {
    return (
      <CloseOutPickLineBody
        lines={refundableLines}
        onSelect={setSelectedLineId}
        selectedLineId={selectedLineId}
      />
    );
  }
  if (step === "refund" && refundBody) {
    return <CloseOutRefundBody {...refundBody} />;
  }
  return null;
});

interface CloseOutFooterProps {
  canSubmit: boolean;
  hasSelectedLine: boolean;
  isPending: boolean;
  onBackFromPick: () => void;
  onBackFromRefund: () => void;
  onBeginRefund: () => void;
  onClose: () => void;
  onConfirmRefund: () => void;
  onContinueToRefund: () => void;
  refundCtaLabel: string;
  selectedLineId: string | null;
  showLaterOnly: boolean;
  step: TCloseOutStep;
}

const CloseOutFooter = memo(function CloseOutFooter({
  canSubmit,
  hasSelectedLine,
  isPending,
  onBackFromPick,
  onBackFromRefund,
  onBeginRefund,
  onClose,
  onConfirmRefund,
  onContinueToRefund,
  refundCtaLabel,
  selectedLineId,
  showLaterOnly,
  step,
}: CloseOutFooterProps) {
  if (showLaterOnly) {
    return (
      <DialogFooter>
        <Button onClick={onClose} type="button" variant="outline">
          Later
        </Button>
      </DialogFooter>
    );
  }

  if (step === "explain") {
    return (
      <DialogFooter>
        <Button onClick={onClose} type="button" variant="outline">
          Later
        </Button>
        <Button onClick={onBeginRefund} type="button">
          {refundCtaLabel}
        </Button>
      </DialogFooter>
    );
  }

  if (step === "pickLine") {
    return (
      <DialogFooter>
        <Button onClick={onBackFromPick} type="button" variant="outline">
          Back
        </Button>
        <Button disabled={!selectedLineId} onClick={onContinueToRefund} type="button">
          Continue
        </Button>
      </DialogFooter>
    );
  }

  return (
    <DialogFooter>
      <Button disabled={isPending} onClick={onBackFromRefund} type="button" variant="outline">
        Back
      </Button>
      <Button
        disabled={isPending || !canSubmit || !hasSelectedLine}
        onClick={onConfirmRefund}
        type="button"
      >
        {isPending ? "Refund…" : "Refund deposit"}
      </Button>
    </DialogFooter>
  );
});

export const LeaseDepositCloseOutDialog = memo(
  ({
    depositSummary,
    longStayId,
    onOpenChange,
    open,
    propertyId,
  }: LeaseDepositCloseOutDialogProps) => {
    const queryClient = useQueryClient();
    const copy = getLeaseDepositCloseOutCopy(depositSummary);
    const [step, setStep] = useState<TCloseOutStep>("explain");
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
    const [wasOpen, setWasOpen] = useState(open);

    if (open !== wasOpen) {
      setWasOpen(open);
      if (!open) {
        setStep("explain");
        setSelectedLineId(null);
      }
    }

    const linesQuery = useQuery({
      enabled: open,
      queryFn: () =>
        incomeLinesApi.list(propertyId, {
          limit: 100,
          longStayId,
          refundStatus: IncomeRefundFilter.NOT_REFUNDED,
        }),
      queryKey: queryKeys.propertyIncomeLines(propertyId, {
        longStayId,
        refundStatus: IncomeRefundFilter.NOT_REFUNDED,
      }),
    });

    const refundableLines = (linesQuery.data?.incomeLines ?? []).filter(isRefundableDepositLine);
    const selectedLine =
      refundableLines.find((line) => line.id === selectedLineId) ?? refundableLines[0] ?? null;
    const refundCap = selectedLine ? getIncomeLineRefundableCap(selectedLine) : 0;

    const refundMutation = useMutation({
      mutationFn: ({ amount, line }: { amount?: number; line: IPropertyIncomeLine }) =>
        incomeLinesApi.refund(propertyId, line.id, amount !== undefined ? { amount } : undefined),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to refund deposit");
      },
      onSuccess: (_, { amount }) => {
        toast.success(amount !== undefined ? "Deposit partially refunded" : "Deposit refunded");
        invalidatePropertyIncomeCaches(queryClient, propertyId, { longStayId });
        onOpenChange(false);
      },
    });

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        if (!nextOpen && refundMutation.isPending) {
          return;
        }
        onOpenChange(nextOpen);
      },
      [onOpenChange, refundMutation.isPending]
    );

    const beginRefundFlow = useCallback(() => {
      const firstLine = refundableLines[0];
      if (!firstLine) {
        return;
      }
      if (refundableLines.length === 1) {
        setSelectedLineId(firstLine.id);
        setStep("refund");
        return;
      }
      setSelectedLineId(firstLine.id);
      setStep("pickLine");
    }, [refundableLines]);

    const handleRefundConfirm = useCallback(
      (payload: TRefundEntryConfirmPayload) => {
        if (!selectedLine) {
          return;
        }
        if (payload.mode === "full") {
          refundMutation.mutate({ line: selectedLine });
          return;
        }
        refundMutation.mutate({ amount: payload.amount, line: selectedLine });
      },
      [refundMutation, selectedLine]
    );

    const { canSubmit, confirm, mode, partialAmount, setMode, setPartialAmount } =
      useRefundEntryForm({
        cap: refundCap,
        onConfirm: handleRefundConfirm,
        resetToken: `${open}:${step}:${selectedLine?.id ?? ""}`,
      });

    const isLoading = linesQuery.isLoading;
    const loadError = linesQuery.isError;
    const hasNoRefundableLines = !isLoading && !loadError && refundableLines.length === 0;
    const showLaterOnly = isLoading || loadError || hasNoRefundableLines;
    const { description, title } = getStepHeader(step, copy);
    const loadErrorMessage =
      linesQuery.error instanceof Error
        ? linesQuery.error.message
        : "Failed to load deposit income lines.";

    return (
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-[440px]" showCloseButton={!refundMutation.isPending}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <CloseOutBody
            collected={depositSummary.collected}
            hasNoRefundableLines={hasNoRefundableLines}
            isLoading={isLoading}
            loadError={loadError}
            loadErrorMessage={loadErrorMessage}
            refundBody={
              selectedLine
                ? {
                    cap: refundCap,
                    line: selectedLine,
                    mode,
                    onModeChange: setMode,
                    onPartialAmountChange: setPartialAmount,
                    partialAmount,
                  }
                : null
            }
            refundableLines={refundableLines}
            selectedLineId={selectedLineId}
            setSelectedLineId={setSelectedLineId}
            step={step}
          />

          <CloseOutFooter
            canSubmit={canSubmit}
            hasSelectedLine={selectedLine != null}
            isPending={refundMutation.isPending}
            onBackFromPick={() => setStep("explain")}
            onBackFromRefund={() => setStep(refundableLines.length > 1 ? "pickLine" : "explain")}
            onBeginRefund={beginRefundFlow}
            onClose={() => handleOpenChange(false)}
            onConfirmRefund={confirm}
            onContinueToRefund={() => setStep("refund")}
            refundCtaLabel={copy.refundCtaLabel}
            selectedLineId={selectedLineId}
            showLaterOnly={showLaterOnly}
            step={step}
          />
        </DialogContent>
      </Dialog>
    );
  }
);
LeaseDepositCloseOutDialog.displayName = "LeaseDepositCloseOutDialog";
