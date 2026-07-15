import { propertiesDb } from "@/db/properties";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import {
  formatProratedDaysLabel,
  type IPropertyLongStayRentMonth,
  transactionDateToMonth,
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

function formatRentMonthLabelFromMonth(month: string): string {
  return formatRentMonthLabel(`${month}-01`);
}

function buildHoldoverContent(
  contractEndDate: string,
  moveOutDate: string
): { plain: string; section: string } {
  const contractEndLabel = formatPaymentDate(contractEndDate);
  const moveOutLabel = formatPaymentDate(moveOutDate);
  const plain = `Your contract ended on ${contractEndLabel}, and your move-out was recorded on ${moveOutLabel}. Holdover days are included in the final month's prorated rent.`;

  return {
    plain,
    section: `<div class="text-muted" style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: left;">${plain}</div>`,
  };
}

function buildFinalMonthContent(
  finalMonth: IPropertyLongStayRentMonth
): { plain: string; section: string } {
  const monthLabel = formatRentMonthLabelFromMonth(finalMonth.month);
  const amount = moneyFormatter.format(finalMonth.expectedRent);
  const lines = [
    `Final rent month: ${monthLabel}`,
    `Amount: ${amount}`,
  ];

  if (finalMonth.isProrated) {
    lines.push(`Days billed: ${formatProratedDaysLabel(finalMonth.occupiedDays, finalMonth.daysInMonth)}`);
  }

  const plain = lines.join("\n");
  const htmlLines = [
    `<div><strong>Final rent month:</strong> ${monthLabel}</div>`,
    `<div><strong>Amount:</strong> ${amount}</div>`,
  ];

  if (finalMonth.isProrated) {
    htmlLines.push(
      `<div><strong>Days billed:</strong> ${formatProratedDaysLabel(finalMonth.occupiedDays, finalMonth.daysInMonth)}</div>`
    );
  }

  return {
    plain,
    section: `<div class="detail-box" style="${DETAIL_BOX_STYLE}"><div style="font-size: 14px; line-height: 1.8">${htmlLines.join("")}</div></div>`,
  };
}

function buildPaymentStatusLine(finalMonth: IPropertyLongStayRentMonth | undefined): string {
  if (!finalMonth) {
    return "Your lease is closed. If you have questions, contact your property manager.";
  }

  if (finalMonth.isPaid) {
    return "Final month rent is recorded — you're all set.";
  }

  return `Final month rent of ${moneyFormatter.format(finalMonth.expectedRent)} is still outstanding. Please contact your property manager.`;
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

  const [property, unit, rentSchedule] = await Promise.all([
    propertiesDb.findById(params.propertyId),
    propertyUnitsDb.findById(lease.unitId),
    propertyLongStaysDb.getRentSchedule(params.longStayId, actualEndDate),
  ]);

  if (!property) {
    return;
  }

  const unitLabel = unit ? `Unit ${unit.unitNumber}` : "Unit";
  const finalMonth = rentSchedule.find(
    (item) => item.month === transactionDateToMonth(actualEndDate)
  );
  const isHoldover = actualEndDate > lease.leaseEndDate;

  const holdover = isHoldover
    ? buildHoldoverContent(lease.leaseEndDate, actualEndDate)
    : { plain: "", section: "" };
  const finalMonthContent = finalMonth
    ? buildFinalMonthContent(finalMonth)
    : { plain: "", section: "" };

  await sendLeaseEndedEmail(tenantEmail, {
    contractEndDate: formatPaymentDate(lease.leaseEndDate),
    finalMonthPlain: finalMonthContent.plain,
    finalMonthSection: finalMonthContent.section,
    holdoverPlain: holdover.plain,
    holdoverSection: holdover.section,
    leaseStartDate: formatPaymentDate(lease.leaseStartDate),
    moveOutDate: formatPaymentDate(actualEndDate),
    paymentStatusLine: buildPaymentStatusLine(finalMonth),
    propertyName: property.name,
    tenantName: lease.guestName,
    unitLabel,
  });
}
