import { useQuery } from "@tanstack/react-query";
import { memo, useCallback, useMemo, type ChangeEvent } from "react";

import {
  INCOME_LINE_TYPE_OPTIONS,
  incomeLineSelectClassName,
} from "@/components/income/income-line-form-options";
import { LinkToStayField, LockedStaySummary } from "@/components/income/link-to-stay-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IncomeUnitSelectOptions } from "@/components/units/income-unit-select-options";
import { unitsApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  isAmenityUnit,
  type IPropertyReservation,
  type IPropertyUnit,
  type TIncomeLineType,
} from "@/packages/shared";

const EMPTY_UNITS: IPropertyUnit[] = [];

interface FieldIdPrefixProps {
  fieldIdPrefix: string;
}

interface IncomeLineTypeFieldProps extends FieldIdPrefixProps {
  onChange: (lineType: TIncomeLineType) => void;
  value: TIncomeLineType;
}

export const IncomeLineTypeField = memo(
  ({ fieldIdPrefix, onChange, value }: IncomeLineTypeFieldProps) => {
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value as TIncomeLineType);
      },
      [onChange]
    );

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-type`}>Income type</Label>
        <select
          className={incomeLineSelectClassName}
          id={`${fieldIdPrefix}-type`}
          onChange={handleChange}
          value={value}
        >
          {INCOME_LINE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);
IncomeLineTypeField.displayName = "IncomeLineTypeField";

interface IncomeLineAmountDateFieldsProps extends FieldIdPrefixProps {
  amount: string;
  autoFocusAmount?: boolean;
  onAmountChange: (amount: string) => void;
  onDateChange: (transactionDate: string) => void;
  transactionDate: string;
}

export const IncomeLineAmountDateFields = memo(
  ({
    amount,
    autoFocusAmount = false,
    fieldIdPrefix,
    onAmountChange,
    onDateChange,
    transactionDate,
  }: IncomeLineAmountDateFieldsProps) => {
    const handleAmountChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        onAmountChange(e.target.value);
      },
      [onAmountChange]
    );

    const handleDateChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        onDateChange(e.target.value);
      },
      [onDateChange]
    );

    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldIdPrefix}-amount`}>Amount</Label>
          <Input
            autoFocus={autoFocusAmount}
            id={`${fieldIdPrefix}-amount`}
            inputMode="decimal"
            onChange={handleAmountChange}
            type="text"
            value={amount}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldIdPrefix}-date`}>Date</Label>
          <Input
            id={`${fieldIdPrefix}-date`}
            onChange={handleDateChange}
            type="date"
            value={transactionDate}
          />
        </div>
      </div>
    );
  }
);
IncomeLineAmountDateFields.displayName = "IncomeLineAmountDateFields";

interface IncomeLineGuestFieldProps extends FieldIdPrefixProps {
  onChange: (guestName: string) => void;
  value: string;
}

export const IncomeLineGuestField = memo(
  ({ fieldIdPrefix, onChange, value }: IncomeLineGuestFieldProps) => {
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-guest`}>Guest name (optional)</Label>
        <Input id={`${fieldIdPrefix}-guest`} onChange={handleChange} value={value} />
      </div>
    );
  }
);
IncomeLineGuestField.displayName = "IncomeLineGuestField";

interface IncomeLineDescriptionFieldProps extends FieldIdPrefixProps {
  onChange: (description: string) => void;
  value: string;
}

export const IncomeLineDescriptionField = memo(
  ({ fieldIdPrefix, onChange, value }: IncomeLineDescriptionFieldProps) => {
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldIdPrefix}-description`}>Description (optional)</Label>
        <Input id={`${fieldIdPrefix}-description`} onChange={handleChange} value={value} />
      </div>
    );
  }
);
IncomeLineDescriptionField.displayName = "IncomeLineDescriptionField";

interface IncomeLineUnitSectionProps extends FieldIdPrefixProps {
  includeReservationId?: string;
  lockedStay?: IPropertyReservation | null;
  onReservationIdChange: (reservationId: string) => void;
  onUnitChange: (unitId: string) => void;
  propertyId: string;
  reservationId: string;
  transactionDate: string;
  unitId: string;
  units?: IPropertyUnit[];
}

export const IncomeLineUnitSection = memo(
  ({
    fieldIdPrefix,
    includeReservationId,
    lockedStay,
    onReservationIdChange,
    onUnitChange,
    propertyId,
    reservationId,
    transactionDate,
    unitId,
    units: unitsProp,
  }: IncomeLineUnitSectionProps) => {
    const unitsQuery = useQuery({
      enabled: unitsProp == null,
      queryFn: () => unitsApi.list(propertyId),
      queryKey: adminQueryKeys.propertyUnits(propertyId),
    });

    const units = unitsProp ?? unitsQuery.data?.units ?? EMPTY_UNITS;

    const selectedUnit = useMemo(
      () => units.find((unit) => unit.id === unitId),
      [units, unitId]
    );
    const forAmenityUnit = selectedUnit != null && isAmenityUnit(selectedUnit);

    const handleUnitChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        onUnitChange(e.target.value);
      },
      [onUnitChange]
    );

    return (
      <>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldIdPrefix}-unit`}>Unit</Label>
          <select
            className={incomeLineSelectClassName}
            disabled={Boolean(lockedStay)}
            id={`${fieldIdPrefix}-unit`}
            onChange={handleUnitChange}
            value={unitId}
          >
            <IncomeUnitSelectOptions
              emptyOptionLabel={unitsProp == null ? "Select unit…" : undefined}
              units={units}
            />
          </select>
        </div>

        {lockedStay ? (
          <LockedStaySummary stay={lockedStay} />
        ) : (
          <LinkToStayField
            forAmenityUnit={forAmenityUnit}
            id={`${fieldIdPrefix}-reservation`}
            includeReservationId={includeReservationId}
            onReservationIdChange={onReservationIdChange}
            propertyId={propertyId}
            reservationId={reservationId}
            transactionDate={transactionDate}
            unitId={unitId}
          />
        )}
      </>
    );
  }
);
IncomeLineUnitSection.displayName = "IncomeLineUnitSection";
