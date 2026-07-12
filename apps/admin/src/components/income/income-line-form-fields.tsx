import { useQuery } from "@tanstack/react-query";
import { type ChangeEvent, memo, useCallback, useMemo } from "react";

import { type IncomeLineTypeOption } from "@/components/income/income-line-form-options";
import {
  LinkToStayField,
  LockedLeaseSummary,
  LockedStaySummary,
} from "@/components/income/link-to-stay-field";
import { FieldLabel } from "@/components/ui/field-label";
import { FormSelectField } from "@/components/ui/form-select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IncomeUnitSelectOptions } from "@/components/units/income-unit-select-options";
import { unitsApi } from "@/lib/api-client";
import { isValidDecimalInput } from "@/lib/decimal-input-utils";
import { isPropertyAmenityUnit } from "@/lib/property-amenity-unit";
import { adminQueryKeys } from "@/lib/query-keys";
import {
  type IPropertyLongStay,
  type IPropertyReservation,
  type IPropertyUnit,
} from "@/packages/shared";

const EMPTY_UNITS: IPropertyUnit[] = [];

interface FieldIdPrefixProps {
  fieldIdPrefix: string;
}

interface IncomeLineTypeFieldProps extends FieldIdPrefixProps {
  onChange: (incomeLineTypeId: string) => void;
  options: IncomeLineTypeOption[];
  value: string;
}

export const IncomeLineTypeField = memo(
  ({ fieldIdPrefix, onChange, options, value }: IncomeLineTypeFieldProps) => {
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    return (
      <FormSelectField
        disabled={options.length === 0}
        id={`${fieldIdPrefix}-type`}
        label="Income type"
        onChange={handleChange}
        options={
          options.length === 0 ? [{ label: "No income types configured", value: "" }] : options
        }
        value={value}
      />
    );
  }
);
IncomeLineTypeField.displayName = "IncomeLineTypeField";

interface IncomeLineAmountDateFieldsProps extends FieldIdPrefixProps {
  amount: string;
  autoFocusAmount?: boolean;
  maxDate?: string;
  onAmountChange: (amount: string) => void;
  onDateChange: (transactionDate: string) => void;
  transactionDate: string;
}

export const IncomeLineAmountDateFields = memo(
  ({
    amount,
    autoFocusAmount = false,
    fieldIdPrefix,
    maxDate,
    onAmountChange,
    onDateChange,
    transactionDate,
  }: IncomeLineAmountDateFieldsProps) => {
    const handleAmountChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (isValidDecimalInput(e.target.value)) onAmountChange(e.target.value);
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
            max={maxDate}
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
        <FieldLabel htmlFor={`${fieldIdPrefix}-guest`} optional>
          Guest name
        </FieldLabel>
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
        <FieldLabel htmlFor={`${fieldIdPrefix}-description`} optional>
          Description
        </FieldLabel>
        <Input id={`${fieldIdPrefix}-description`} onChange={handleChange} value={value} />
      </div>
    );
  }
);
IncomeLineDescriptionField.displayName = "IncomeLineDescriptionField";

interface IncomeLineUnitSectionProps extends FieldIdPrefixProps {
  includePropertyAmenityOption?: boolean;
  includeReservationId?: string;
  lockedLease?: IPropertyLongStay | null;
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
    includePropertyAmenityOption,
    includeReservationId,
    lockedLease,
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
      queryKey: adminQueryKeys.propertyUnitsPicker(propertyId),
    });

    const units = useMemo(() => {
      const source = unitsProp ?? unitsQuery.data?.units ?? EMPTY_UNITS;
      if (unitsProp != null) return source;
      return source.filter((unit) => !unit.isDeleted);
    }, [unitsProp, unitsQuery.data?.units]);

    const handleUnitChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        onUnitChange(e.target.value);
      },
      [onUnitChange]
    );

    let stayLinkSection = null;
    if (lockedLease) {
      stayLinkSection = <LockedLeaseSummary lease={lockedLease} />;
    } else if (lockedStay) {
      stayLinkSection = <LockedStaySummary stay={lockedStay} />;
    } else if (!isPropertyAmenityUnit(unitId)) {
      stayLinkSection = (
        <LinkToStayField
          id={`${fieldIdPrefix}-reservation`}
          includeReservationId={includeReservationId}
          onReservationIdChange={onReservationIdChange}
          propertyId={propertyId}
          reservationId={reservationId}
          transactionDate={transactionDate}
          unitId={unitId}
        />
      );
    }

    return (
      <>
        <FormSelectField
          disabled={Boolean(lockedStay || lockedLease)}
          id={`${fieldIdPrefix}-unit`}
          label="Unit"
          onChange={handleUnitChange}
          value={unitId}
        >
          <IncomeUnitSelectOptions
            emptyOptionLabel={unitsProp == null ? "Select unit…" : undefined}
            includePropertyAmenityOption={includePropertyAmenityOption}
            units={units}
          />
        </FormSelectField>

        {stayLinkSection}
      </>
    );
  }
);
IncomeLineUnitSection.displayName = "IncomeLineUnitSection";
