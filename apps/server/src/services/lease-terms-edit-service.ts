import { LongStayNotFoundError, propertyLongStaysDb } from "@/db/property-long-stays";
import {
  deriveLeaseTermsEditability,
  getLeaseTermsEditBlockMessage,
  type ILeaseTermsEditability,
  type TLeaseTermsEditBlockReason,
} from "@/packages/shared";

export class LeaseTermsNotEditableError extends Error {
  readonly reason: TLeaseTermsEditBlockReason;

  constructor(reason: TLeaseTermsEditBlockReason) {
    super(getLeaseTermsEditBlockMessage(reason));
    this.name = "LeaseTermsNotEditableError";
    this.reason = reason;
  }
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
