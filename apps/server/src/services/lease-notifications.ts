import { propertiesDb } from "@/db/properties";
import { propertyLongStaysDb } from "@/db/property-long-stays";
import { propertyUnitsDb } from "@/db/property-units";
import { sendRentPaymentRecordedEmail } from "@/ses/transactional-emails";

export interface NotifyPrimaryTenantRentRecordedParams {
  amount: number;
  longStayId: string;
  propertyId: string;
  transactionDate: string;
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

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
