import { getStartLeaseDraftUnitScope, readStartLeaseDraft } from "@/lib/start-lease-draft-storage";
import { getStartLeaseDefaultValues } from "@/lib/start-lease-form-schema";
import { type TStartLeaseStep } from "@/lib/start-lease-steps";

export type TStartLeaseInitialState = {
  step: TStartLeaseStep;
  values: ReturnType<typeof getStartLeaseDefaultValues>;
};

export function resolveStartLeaseInitialState(options: {
  initialStep: TStartLeaseStep;
  lockedUnitId?: string;
  propertyId: string;
  stepFromUrl?: boolean;
}): TStartLeaseInitialState {
  const lockedUnitId = options.lockedUnitId?.trim() ?? "";
  const unitScope = getStartLeaseDraftUnitScope(lockedUnitId || undefined);
  const draft = readStartLeaseDraft(options.propertyId, unitScope, {
    lockedUnitId: lockedUnitId || undefined,
  });

  const defaults = getStartLeaseDefaultValues(lockedUnitId || undefined);
  const values = { ...(draft?.values ?? defaults) };
  if (lockedUnitId) {
    values.unitId = lockedUnitId;
  }

  const step = options.stepFromUrl ? options.initialStep : (draft?.step ?? options.initialStep);

  return { step, values };
}
