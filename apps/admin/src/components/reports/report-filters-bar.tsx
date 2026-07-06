import { Download } from "lucide-react";
import { memo } from "react";

import {
  CHANNEL_OPTIONS,
  reservationSelectClassName,
} from "@/components/income/reservation-form-options";
import { RENTAL_TYPE_FILTER_OPTIONS } from "@/components/reports/report-form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { IPropertyUnit } from "@/packages/shared";

const reportSelectClassName = cn(reservationSelectClassName, "bg-background");

export interface ReportFiltersBarProps {
  channel?: string;
  from: string;
  isExportDisabled?: boolean;
  isExporting?: boolean;
  onChannelChange?: (value: string) => void;
  onExport?: () => void;
  onFromChange: (value: string) => void;
  onRentalTypeChange: (value: string) => void;
  onToChange: (value: string) => void;
  onUnitChange?: (value: string) => void;
  rentalType: string;
  showChannelFilter?: boolean;
  showExport?: boolean;
  showUnitFilter?: boolean;
  to: string;
  unitId?: string;
  units?: IPropertyUnit[];
}

export const ReportFiltersBar = memo(
  ({
    channel = "",
    from,
    isExportDisabled = false,
    isExporting = false,
    onChannelChange,
    onExport,
    onFromChange,
    onRentalTypeChange,
    onToChange,
    onUnitChange,
    rentalType,
    showChannelFilter = false,
    showExport = false,
    showUnitFilter = false,
    to,
    unitId = "",
    units = [],
  }: ReportFiltersBarProps) => {
    const filterCount =
      2 + (showUnitFilter ? 1 : 0) + (showChannelFilter ? 1 : 0) + 1 + (showExport ? 0 : 0);
    const gridClass =
      filterCount >= 5
        ? "md:grid-cols-2 lg:grid-cols-5"
        : filterCount >= 4
          ? "md:grid-cols-2 lg:grid-cols-4"
          : "md:grid-cols-2 lg:grid-cols-3";

    return (
      <div className="space-y-4">
        <div className={cn("grid gap-3", gridClass)}>
          <div className="space-y-1.5">
            <Label htmlFor="report-from">From</Label>
            <Input
              id="report-from"
              onChange={(e) => onFromChange(e.target.value)}
              type="date"
              value={from}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-to">To</Label>
            <Input
              id="report-to"
              onChange={(e) => onToChange(e.target.value)}
              type="date"
              value={to}
            />
          </div>
          {showUnitFilter ? (
            <div className="space-y-1.5">
              <Label htmlFor="report-unit">Unit</Label>
              <select
                className={reportSelectClassName}
                id="report-unit"
                onChange={(e) => onUnitChange?.(e.target.value)}
                value={unitId}
              >
                <option value="">All units</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {showChannelFilter ? (
            <div className="space-y-1.5">
              <Label htmlFor="report-channel">Channel</Label>
              <select
                className={reportSelectClassName}
                id="report-channel"
                onChange={(e) => onChannelChange?.(e.target.value)}
                value={channel}
              >
                <option value="">All channels</option>
                {CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="report-rental-type">Rental type</Label>
            <select
              className={reportSelectClassName}
              id="report-rental-type"
              onChange={(e) => onRentalTypeChange(e.target.value)}
              value={rentalType}
            >
              {RENTAL_TYPE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || "both"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {showExport ? (
            <div className="flex items-end">
              <Button
                className="w-full gap-1.5"
                disabled={isExportDisabled || isExporting}
                onClick={() => onExport?.()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Download className="size-3.5" />
                {isExporting ? "Downloading…" : "Download CSV"}
              </Button>
            </div>
          ) : null}
        </div>

        {rentalType ? (
          <p className="text-muted-foreground text-xs">
            Expenses are property-wide and included when the property has units of the selected
            rental type.
          </p>
        ) : null}
      </div>
    );
  }
);
ReportFiltersBar.displayName = "ReportFiltersBar";
