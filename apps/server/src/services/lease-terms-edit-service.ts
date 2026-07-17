import { LongStayNotFoundError, propertyLongStaysDb } from "@/db/property-long-stays";
import {
  deriveLeaseTermsEditability,
  getLeaseTermsEditBlockMessage,
  type IEditPropertyLongStayTermsBody,
  type ILeaseTermsEditability,
  type IPropertyLongStay,
  type TLeaseTermsEditBlockReason,
  validateEditLeaseTerms,
} from "@/packages/shared";

export class LeaseTermsNotEditableError extends Error {
  readonly reason: TLeaseTermsEditBlockReason;

  constructor(reason: TLeaseTermsEditBlockReason) {
    super(getLeaseTermsEditBlockMessage(reason));
    this.name = "LeaseTermsNotEditableError";
    this.reason = reason;
  }
}

export class LeaseTermsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaseTermsValidationError";
  }
}

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
    throw new LongStayNotFoundError();
  }

  const signalResult = await propertyLongStaysDb.getTermsEditSignals(longStayId);
  if (!signalResult) {
    throw new LongStayNotFoundError();
  }

  const editability = deriveLeaseTermsEditability(lease, signalResult.signals);
  if (!editability.editable && editability.reason) {
    throw new LeaseTermsNotEditableError(editability.reason);
  }
}

export async function editLeaseTerms(
  longStayId: string,
  body: IEditPropertyLongStayTermsBody
): Promise<IPropertyLongStay> {
  const lease = await propertyLongStaysDb.findById(longStayId);
  if (!lease) {
    throw new LongStayNotFoundError();
  }

  await assertLeaseTermsEditable(longStayId);

  const validationError = validateEditLeaseTerms(body, lease, getTodayUtcIsoDate());
  if (validationError) {
    throw new LeaseTermsValidationError(validationError);
  }

  return propertyLongStaysDb.updateTerms(longStayId, body);
}
