import { AlertCircle, Trash2, TriangleAlert } from "lucide-react";
import { memo } from "react";

import {
  AMOUNT_INPUT_CLASS_NAME,
  getImportIncomePreviewRowValidationError,
  STICKY_ACTIONS_CELL_CLASS_NAME,
  TABLE_AMOUNT_INPUT_CLASS_NAME,
  TABLE_SELECT_CLASS_NAME,
} from "@/components/income/import-income-csv-preview-utils";
import { buildChannelOptions, STATUS_OPTIONS } from "@/components/income/reservation-form-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import { PropertyUnitSelectOptions } from "@/components/units/property-unit-select-options";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { formatMoney } from "@/lib/format-money";
import { getIncomeImportPreviewTaxesTotal } from "@/lib/income-import-preview-row";
import { cn } from "@/lib/utils";
import {
  type IIncomeImportParsedRow,
  type IPropertyChannelCommission,
  type IPropertyUnit,
  ReservationStatus,
  type TReservationStatus,
} from "@/packages/shared";

const IMPORT_STATUS_OPTIONS = STATUS_OPTIONS.filter(
  (option) => option.value !== ReservationStatus.ACTIVE
);

const SELECT_CLASS_NAME = "min-w-[10rem]";
const GUEST_INPUT_CLASS_NAME = "min-w-[10rem]";

function formatAmountInputValue(amount: number): string {
  return Number.isFinite(amount) ? String(amount) : "";
}

function parseAmountInputValue(value: string): number {
  if (value === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatReadOnlyMoney(value: number | undefined): string {
  return value != null ? formatMoney(value) : "—";
}

interface PreviewFieldContext {
  channelCommissions: IPropertyChannelCommission[];
  idPrefix: string;
  onChange: (next: IIncomeImportParsedRow) => void;
  row: IIncomeImportParsedRow;
  units: IPropertyUnit[];
}

function renderGuestInput({ idPrefix, onChange, row }: PreviewFieldContext) {
  return (
    <Input
      className={GUEST_INPUT_CLASS_NAME}
      id={`${idPrefix}-guest`}
      onChange={(e) => onChange({ ...row, guestName: e.target.value })}
      value={row.guestName}
    />
  );
}

function renderUnitSelect(
  { idPrefix, onChange, row, units }: PreviewFieldContext,
  variant: "card" | "table" = "card"
) {
  return (
    <NativeSelect
      className={variant === "table" ? TABLE_SELECT_CLASS_NAME : SELECT_CLASS_NAME}
      id={`${idPrefix}-unit`}
      onChange={(e) => onChange({ ...row, unitId: e.target.value })}
      value={row.unitId}
    >
      <PropertyUnitSelectOptions emptyOptionLabel="Select unit" units={units} />
    </NativeSelect>
  );
}

function renderCheckInInput({ idPrefix, onChange, row }: PreviewFieldContext) {
  return (
    <Input
      id={`${idPrefix}-check-in`}
      onChange={(e) => onChange({ ...row, checkIn: e.target.value })}
      type="date"
      value={row.checkIn}
    />
  );
}

function renderCheckOutInput({ idPrefix, onChange, row }: PreviewFieldContext) {
  return (
    <Input
      id={`${idPrefix}-check-out`}
      onChange={(e) => onChange({ ...row, checkOut: e.target.value })}
      type="date"
      value={row.checkOut}
    />
  );
}

function renderStatusSelect(
  { idPrefix, onChange, row }: PreviewFieldContext,
  variant: "card" | "table" = "card"
) {
  return (
    <NativeSelect
      className={variant === "table" ? TABLE_SELECT_CLASS_NAME : SELECT_CLASS_NAME}
      disabled={row.refunded}
      id={`${idPrefix}-status`}
      onChange={(e) => onChange({ ...row, status: e.target.value as TReservationStatus })}
      options={IMPORT_STATUS_OPTIONS}
      value={row.status}
    />
  );
}

function renderRefundedInput(
  { idPrefix, onChange, row }: PreviewFieldContext,
  variant: "card" | "table" = "card",
  labelClassName = "text-sm"
) {
  const checkbox = (
    <input
      aria-label="Refunded"
      checked={row.refunded}
      id={`${idPrefix}-refunded`}
      onChange={(e) => {
        const refunded = e.target.checked;
        onChange(
          refunded
            ? { ...row, refunded: true, status: ReservationStatus.STAYED }
            : { ...row, refunded: false }
        );
      }}
      type="checkbox"
    />
  );

  if (variant === "table") {
    return <div className="flex justify-center">{checkbox}</div>;
  }

  return (
    <label className={cn("flex items-center gap-2", labelClassName)}>{checkbox} Refunded</label>
  );
}

function renderChannelSelect(
  { channelCommissions, idPrefix, onChange, row }: PreviewFieldContext,
  variant: "card" | "table" = "card"
) {
  return (
    <NativeSelect
      className={variant === "table" ? TABLE_SELECT_CLASS_NAME : SELECT_CLASS_NAME}
      id={`${idPrefix}-channel`}
      onChange={(e) => onChange({ ...row, channelCommissionId: e.target.value })}
      options={buildChannelOptions(channelCommissions)}
      value={row.channelCommissionId}
    />
  );
}

function renderAmountInput(
  { idPrefix, onChange, row }: PreviewFieldContext,
  field: "cleaningFee" | "roomTotal",
  variant: "card" | "table" = "card"
) {
  const value = row[field];
  const fieldId = field === "roomTotal" ? "room-total" : "cleaning-fee";
  const label = field === "roomTotal" ? "Room total" : "Cleaning fee";

  return (
    <Input
      className={variant === "table" ? TABLE_AMOUNT_INPUT_CLASS_NAME : AMOUNT_INPUT_CLASS_NAME}
      id={`${idPrefix}-${fieldId}`}
      inputMode="decimal"
      onChange={(e) => {
        if (!isValidDecimalInput(e.target.value)) {
          return;
        }
        onChange({ ...row, [field]: parseAmountInputValue(e.target.value) });
      }}
      type="text"
      value={formatAmountInputValue(value)}
      aria-label={label}
    />
  );
}

function renderReadOnlyComputedFields(row: IIncomeImportParsedRow) {
  const taxesTotal = getIncomeImportPreviewTaxesTotal(row);

  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Nights</dt>
        <dd className="font-medium tabular-nums">{row.computedNights ?? row.nights}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Commission</dt>
        <dd className="font-medium tabular-nums">{formatReadOnlyMoney(row.channelCommission)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Taxes</dt>
        <dd className="font-medium tabular-nums">
          {taxesTotal != null ? formatMoney(taxesTotal) : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Gross</dt>
        <dd className="font-medium tabular-nums">{formatReadOnlyMoney(row.grossIncome)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Net income</dt>
        <dd className="font-medium tabular-nums">{formatReadOnlyMoney(row.netIncome)}</dd>
      </div>
    </dl>
  );
}

interface ImportIncomeCsvPreviewFieldsProps extends PreviewFieldContext {
  variant: "card";
}

export const ImportIncomeCsvPreviewFields = memo(
  ({
    channelCommissions,
    idPrefix,
    onChange,
    row,
    units,
    variant,
  }: ImportIncomeCsvPreviewFieldsProps) => {
    const context: PreviewFieldContext = { channelCommissions, idPrefix, onChange, row, units };

    if (variant !== "card") {
      return null;
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-guest`}>Guest</Label>
          {renderGuestInput(context)}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-unit`}>Unit</Label>
            {renderUnitSelect(context)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-channel`}>Channel</Label>
            {renderChannelSelect(context)}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-check-in`}>Check-in</FieldLabel>
            {renderCheckInInput(context)}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-check-out`}>Check-out</FieldLabel>
            {renderCheckOutInput(context)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-status`}>Status</Label>
            {renderStatusSelect(context)}
          </div>
          <div className="flex flex-col justify-end gap-1.5">{renderRefundedInput(context)}</div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-room-total`}>Room total</Label>
            {renderAmountInput(context, "roomTotal")}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-cleaning-fee`} optional>
              Cleaning fee
            </FieldLabel>
            {renderAmountInput(context, "cleaningFee")}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">{renderReadOnlyComputedFields(row)}</div>
      </div>
    );
  }
);
ImportIncomeCsvPreviewFields.displayName = "ImportIncomeCsvPreviewFields";

interface ImportIncomeCsvPreviewRowActionsProps {
  duplicateWarning: string | null;
  onRemove: () => void;
  row: IIncomeImportParsedRow;
}

const ImportIncomeCsvPreviewRowActions = memo(
  ({ duplicateWarning, onRemove, row }: ImportIncomeCsvPreviewRowActionsProps) => {
    const validationError = getImportIncomePreviewRowValidationError(row);

    return (
      <div className="flex items-center gap-2">
        {duplicateWarning ? (
          <Badge title={duplicateWarning} variant="outline">
            <TriangleAlert className="size-3 text-amber-600" />
          </Badge>
        ) : null}
        {validationError ? (
          <Badge title={validationError} variant="destructive">
            <AlertCircle className="size-3" />
          </Badge>
        ) : null}
        <Button
          aria-label="Remove row"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    );
  }
);
ImportIncomeCsvPreviewRowActions.displayName = "ImportIncomeCsvPreviewRowActions";

interface ImportIncomeCsvPreviewCardProps {
  channelCommissions: IPropertyChannelCommission[];
  duplicateWarning: string | null;
  idPrefix: string;
  onChange: (next: IIncomeImportParsedRow) => void;
  onRemove: () => void;
  row: IIncomeImportParsedRow;
  units: IPropertyUnit[];
}

export const ImportIncomeCsvPreviewCard = memo(
  ({
    channelCommissions,
    duplicateWarning,
    idPrefix,
    onChange,
    onRemove,
    row,
    units,
  }: ImportIncomeCsvPreviewCardProps) => (
    <article className="space-y-3 rounded-lg border p-4">
      <p className="truncate text-sm font-medium" title={row.sourceFileName}>
        {row.sourceFileName}
      </p>
      <ImportIncomeCsvPreviewFields
        channelCommissions={channelCommissions}
        idPrefix={idPrefix}
        onChange={onChange}
        row={row}
        units={units}
        variant="card"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <ImportIncomeCsvPreviewRowActions
          duplicateWarning={duplicateWarning}
          onRemove={onRemove}
          row={row}
        />
      </div>
    </article>
  )
);
ImportIncomeCsvPreviewCard.displayName = "ImportIncomeCsvPreviewCard";

interface ImportIncomeCsvPreviewTableRowProps {
  channelCommissions: IPropertyChannelCommission[];
  duplicateWarning: string | null;
  idPrefix: string;
  onChange: (next: IIncomeImportParsedRow) => void;
  onRemove: () => void;
  row: IIncomeImportParsedRow;
  units: IPropertyUnit[];
}

export const ImportIncomeCsvPreviewTableRow = memo(
  ({
    channelCommissions,
    duplicateWarning,
    idPrefix,
    onChange,
    onRemove,
    row,
    units,
  }: ImportIncomeCsvPreviewTableRowProps) => {
    const context: PreviewFieldContext = { channelCommissions, idPrefix, onChange, row, units };
    const taxesTotal = getIncomeImportPreviewTaxesTotal(row);

    return (
      <TableRow>
        <TableCell className="max-w-[120px] truncate text-xs" title={row.sourceFileName}>
          {row.sourceFileName}
        </TableCell>
        <TableCell className="whitespace-normal">{renderGuestInput(context)}</TableCell>
        <TableCell className="whitespace-normal">
          <div className="min-w-0">{renderUnitSelect(context, "table")}</div>
        </TableCell>
        <TableCell>{renderCheckInInput(context)}</TableCell>
        <TableCell>{renderCheckOutInput(context)}</TableCell>
        <TableCell className="whitespace-normal">
          <div className="min-w-0">{renderStatusSelect(context, "table")}</div>
        </TableCell>
        <TableCell>{renderRefundedInput(context, "table")}</TableCell>
        <TableCell className="whitespace-normal">
          <div className="min-w-0">{renderChannelSelect(context, "table")}</div>
        </TableCell>
        <TableCell>
          <div className="min-w-0">{renderAmountInput(context, "roomTotal", "table")}</div>
        </TableCell>
        <TableCell>
          <div className="min-w-0">{renderAmountInput(context, "cleaningFee", "table")}</div>
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {row.computedNights ?? row.nights}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatReadOnlyMoney(row.channelCommission)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {taxesTotal != null ? formatMoney(taxesTotal) : "—"}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatReadOnlyMoney(row.grossIncome)}
        </TableCell>
        <TableCell className="text-right text-sm tabular-nums">
          {formatReadOnlyMoney(row.netIncome)}
        </TableCell>
        <TableCell className={STICKY_ACTIONS_CELL_CLASS_NAME}>
          <ImportIncomeCsvPreviewRowActions
            duplicateWarning={duplicateWarning}
            onRemove={onRemove}
            row={row}
          />
        </TableCell>
      </TableRow>
    );
  }
);
ImportIncomeCsvPreviewTableRow.displayName = "ImportIncomeCsvPreviewTableRow";
