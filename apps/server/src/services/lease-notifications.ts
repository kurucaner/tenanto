import { propertiesDb } from "@/db/properties";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import { loadLeaseDepositSummary } from "@/lib/lease-deposit-summary";
import {
  findWeeklyPeriodStartContainingDate,
  formatProratedDaysLabel,
  formatRentPeriodLabel,
  getRentSchedulePeriodKey,
  type ILeaseDepositSummary,
  type IPropertyLongStay,
  type IPropertyLongStayRentMonth,
  isWeeklyRentBillingCadence,
  LeaseDepositBalanceStatus,
  transactionDateToMonth,
  type TRentBillingCadence,
} from "@/packages/shared";
import { sendLeaseEndedEmail, sendRentPaymentRecordedEmail } from "@/ses/transactional-emails";

export interface NotifyPrimaryTenantRentRecordedParams {
  amount: number;
  longStayId: string;
  propertyId: string;
  transactionDate: string;
}

export interface NotifyPrimaryTenantLeaseEndedParams {
  longStayId: string;
  propertyId: string;
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

const DETAIL_BOX_STYLE =
  "background: #f7f7f7; border-radius: 8px; padding: 20px 24px; text-align: left; margin-bottom: 24px;";

function parseIsoDateParts(isoDate: string): { day: number; month: number; year: number } {
  const parts = isoDate.split("-").map(Number);
  return {
    day: parts[2] ?? 1,
    month: parts[1] ?? 1,
    year: parts[0] ?? 0,
  };
}

function formatPaymentDate(isoDate: string): string {
  const { day, month, year } = parseIsoDateParts(isoDate);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRentMonthLabel(isoDate: string): string {
  const { month, year } = parseIsoDateParts(isoDate);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getFinalRentPeriodHeading(rentBillingCadence: TRentBillingCadence): string {
  return isWeeklyRentBillingCadence(rentBillingCadence) ? "Final rent week" : "Final rent month";
}

function getFinalRentPaymentStatusHeading(rentBillingCadence: TRentBillingCadence): string {
  return isWeeklyRentBillingCadence(rentBillingCadence) ? "Final week rent" : "Final month rent";
}

function resolveFinalRentSchedulePeriod(
  rentSchedule: readonly IPropertyLongStayRentMonth[],
  actualEndDate: string,
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "rentBillingCadence">
): IPropertyLongStayRentMonth | undefined {
  if (isWeeklyRentBillingCadence(lease.rentBillingCadence)) {
    const schedulePeriods = rentSchedule.map((item) => getRentSchedulePeriodKey(item));
    const periodKey =
      findWeeklyPeriodStartContainingDate(actualEndDate, schedulePeriods) ?? schedulePeriods.at(-1);
    if (!periodKey) {
      return undefined;
    }
    return rentSchedule.find((item) => getRentSchedulePeriodKey(item) === periodKey);
  }

  return rentSchedule.find(
    (item) => getRentSchedulePeriodKey(item) === transactionDateToMonth(actualEndDate)
  );
}

function buildHoldoverContent(
  contractEndDate: string,
  moveOutDate: string,
  rentBillingCadence: TRentBillingCadence
): { plain: string; section: string } {
  const contractEndLabel = formatPaymentDate(contractEndDate);
  const moveOutLabel = formatPaymentDate(moveOutDate);
  const periodLabel = isWeeklyRentBillingCadence(rentBillingCadence) ? "week's" : "month's";
  const plain = `Your contract ended on ${contractEndLabel}, and your move-out was recorded on ${moveOutLabel}. Holdover days are included in the final ${periodLabel} prorated rent.`;

  return {
    plain,
    section: `<div class="text-muted" style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: left;">${plain}</div>`,
  };
}

function buildFinalPeriodContent(
  finalPeriod: IPropertyLongStayRentMonth,
  rentBillingCadence: TRentBillingCadence
): {
  plain: string;
  section: string;
} {
  const periodHeading = getFinalRentPeriodHeading(rentBillingCadence);
  const periodLabel = formatRentPeriodLabel(getRentSchedulePeriodKey(finalPeriod));
  const amount = moneyFormatter.format(finalPeriod.expectedRent);
  const lines = [`${periodHeading}: ${periodLabel}`, `Amount: ${amount}`];

  if (finalPeriod.isProrated) {
    lines.push(
      `Days billed: ${formatProratedDaysLabel(finalPeriod.occupiedDays, finalPeriod.daysInMonth)}`
    );
  }

  const plain = lines.join("\n");
  const htmlLines = [
    `<div><strong>${periodHeading}:</strong> ${periodLabel}</div>`,
    `<div><strong>Amount:</strong> ${amount}</div>`,
  ];

  if (finalPeriod.isProrated) {
    htmlLines.push(
      `<div><strong>Days billed:</strong> ${formatProratedDaysLabel(finalPeriod.occupiedDays, finalPeriod.daysInMonth)}</div>`
    );
  }

  return {
    plain,
    section: `<div class="detail-box" style="${DETAIL_BOX_STYLE}"><div style="font-size: 14px; line-height: 1.8">${htmlLines.join("")}</div></div>`,
  };
}

function buildPaymentStatusLine(
  finalPeriod: IPropertyLongStayRentMonth | undefined,
  rentBillingCadence: TRentBillingCadence
): string {
  if (!finalPeriod) {
    return "Your lease is closed. Someone from our team will be in touch if you have questions.";
  }

  const periodHeading = getFinalRentPaymentStatusHeading(rentBillingCadence);

  if (finalPeriod.isPaid) {
    return `${periodHeading} is recorded — you're all set.`;
  }

  return `${periodHeading} of ${moneyFormatter.format(finalPeriod.expectedRent)} is still outstanding. Someone from our team will contact you.`;
}

function buildDepositContent(summary: ILeaseDepositSummary): { plain: string; section: string } {
  if (summary.collected <= 0) {
    return { plain: "", section: "" };
  }

  const amount = moneyFormatter.format(summary.collected);
  const plain =
    summary.status === LeaseDepositBalanceStatus.REFUNDED
      ? `Security deposit: ${amount} was collected and a refund has been recorded. Someone from our team will be in touch with any questions about the final settlement.`
      : `Security deposit: ${amount} was collected. Someone from our team will settle any refund or amount withheld for damages.`;

  return {
    plain,
    section: `<div class="text-muted" style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: left;">${plain}</div>`,
  };
}

export async function notifyPrimaryTenantRentRecorded(
  params: NotifyPrimaryTenantRentRecordedParams
): Promise<void> {
  const lease = await propertyLongStaysDb.findById(params.longStayId);
  if (!lease || lease.propertyId !== params.propertyId) {
    return;
  }

  const tenantEmail = lease.tenantEmail?.trim();
  if (!tenantEmail) {
    return;
  }

  const [property, unit] = await Promise.all([
    propertiesDb.findById(params.propertyId),
    propertyUnitsDb.findById(lease.unitId),
  ]);

  if (!property) {
    return;
  }

  const unitLabel = unit ? `Unit ${unit.unitNumber}` : "Unit";

  await sendRentPaymentRecordedEmail(tenantEmail, {
    amount: moneyFormatter.format(params.amount),
    paymentDate: formatPaymentDate(params.transactionDate),
    propertyName: property.name,
    rentMonthLabel: formatRentMonthLabel(params.transactionDate),
    tenantName: lease.guestName,
    unitLabel,
  });
}

export async function notifyPrimaryTenantLeaseEnded(
  params: NotifyPrimaryTenantLeaseEndedParams
): Promise<void> {
  const lease = await propertyLongStaysDb.findById(params.longStayId);
  if (!lease || lease.propertyId !== params.propertyId) {
    return;
  }

  const tenantEmail = lease.tenantEmail?.trim();
  if (!tenantEmail) {
    return;
  }

  const actualEndDate = lease.actualEndDate;
  if (!actualEndDate) {
    return;
  }

  const [property, unit, rentSchedule, depositSummary] = await Promise.all([
    propertiesDb.findById(params.propertyId),
    propertyUnitsDb.findById(lease.unitId),
    propertyLongStaysDb.getRentSchedule(params.longStayId, actualEndDate),
    loadLeaseDepositSummary(lease),
  ]);

  if (!property) {
    return;
  }

  const unitLabel = unit ? `Unit ${unit.unitNumber}` : "Unit";
  const finalPeriod = resolveFinalRentSchedulePeriod(rentSchedule, actualEndDate, lease);
  const isHoldover = actualEndDate > lease.leaseEndDate;

  const holdover = isHoldover
    ? buildHoldoverContent(lease.leaseEndDate, actualEndDate, lease.rentBillingCadence)
    : { plain: "", section: "" };
  const finalPeriodContent = finalPeriod
    ? buildFinalPeriodContent(finalPeriod, lease.rentBillingCadence)
    : { plain: "", section: "" };
  const deposit = buildDepositContent(depositSummary);

  await sendLeaseEndedEmail(tenantEmail, {
    contractEndDate: formatPaymentDate(lease.leaseEndDate),
    depositPlain: deposit.plain,
    depositSection: deposit.section,
    finalMonthPlain: finalPeriodContent.plain,
    finalMonthSection: finalPeriodContent.section,
    holdoverPlain: holdover.plain,
    holdoverSection: holdover.section,
    leaseStartDate: formatPaymentDate(lease.leaseStartDate),
    moveOutDate: formatPaymentDate(actualEndDate),
    paymentStatusLine: buildPaymentStatusLine(finalPeriod, lease.rentBillingCadence),
    propertyName: property.name,
    tenantName: lease.guestName,
    unitLabel,
  });
}
