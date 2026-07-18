import { propertyLongStaysDb } from "@/db/property-long-stays";
import {
  leaseTermsNotEditableError,
  leaseTermsValidationError,
  longStayNotFoundError,
} from "@/errors/lease-errors";
import {
  deriveLeaseTermsEditability,
  type IEditPropertyLongStayTermsBody,
  type ILeaseTermsEditability,
  type IPropertyLongStay,
  validateEditLeaseTerms,
} from "@/packages/shared";

function getTodayUtcIsoDate(): string {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export async function getLeaseTermsEditability(
  longStayId: string
): Promise<ILeaseTermsEditability | null> {
  const lease = await propertyLongStaysDb.findById(longStayId);
  if (!lease) {
    return null;
  }

  const signalResult = await propertyLongStaysDb.getTermsEditSignals(longStayId);
  if (!signalResult) {
    return null;
  }

  return deriveLeaseTermsEditability(lease, signalResult.signals);
}

export async function assertLeaseTermsEditable(longStayId: string): Promise<void> {
  const lease = await propertyLongStaysDb.findById(longStayId);
  if (!lease) {
    throw longStayNotFoundError();
  }

  const signalResult = await propertyLongStaysDb.getTermsEditSignals(longStayId);
  if (!signalResult) {
    throw longStayNotFoundError();
  }

  const editability = deriveLeaseTermsEditability(lease, signalResult.signals);
  if (!editability.editable && editability.reason) {
    throw leaseTermsNotEditableError(editability.reason);
  }
}

export async function editLeaseTerms(
  longStayId: string,
  body: IEditPropertyLongStayTermsBody
): Promise<IPropertyLongStay> {
  const lease = await propertyLongStaysDb.findById(longStayId);
  if (!lease) {
    throw longStayNotFoundError();
  }

  await assertLeaseTermsEditable(longStayId);

  const validationError = validateEditLeaseTerms(body, lease, getTodayUtcIsoDate());
  if (validationError) {
    throw leaseTermsValidationError(validationError);
  }

  return propertyLongStaysDb.updateTerms(longStayId, body);
}
