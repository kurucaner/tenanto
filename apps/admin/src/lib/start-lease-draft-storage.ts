import {
  getStartLeaseDefaultValues,
  type TStartLeaseFormValues,
} from "@/lib/start-lease-form-schema";
import { isStartLeaseStep, type TStartLeaseStep } from "@/lib/start-lease-steps";

export const START_LEASE_DRAFT_KEY_PREFIX = "propertyos:start-lease-draft:v1:";
export const START_LEASE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type TStartLeaseDraftUnitScope = string;

export type TStartLeaseDraft = {
  step: TStartLeaseStep;
  updatedAt: number;
  values: TStartLeaseFormValues;
};

export function getStartLeaseDraftUnitScope(lockedUnitId?: string): TStartLeaseDraftUnitScope {
  const trimmed = lockedUnitId?.trim() ?? "";
  return trimmed || "any";
}

export function buildStartLeaseDraftStorageKey(
  propertyId: string,
  unitScope: TStartLeaseDraftUnitScope
): string {
  return `${START_LEASE_DRAFT_KEY_PREFIX}${propertyId}:${unitScope}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDraftValues(raw: unknown, lockedUnitId?: string): TStartLeaseFormValues {
  const defaults = getStartLeaseDefaultValues(lockedUnitId);
  if (!isRecord(raw)) {
    return defaults;
  }

  return {
    guestName: typeof raw.guestName === "string" ? raw.guestName : defaults.guestName,
    leaseEndDate: typeof raw.leaseEndDate === "string" ? raw.leaseEndDate : defaults.leaseEndDate,
    leaseStartDate:
      typeof raw.leaseStartDate === "string" && raw.leaseStartDate !== ""
        ? raw.leaseStartDate
        : defaults.leaseStartDate,
    monthlyRent: typeof raw.monthlyRent === "string" ? raw.monthlyRent : defaults.monthlyRent,
    tenantEmail: typeof raw.tenantEmail === "string" ? raw.tenantEmail : defaults.tenantEmail,
    tenantPhone: typeof raw.tenantPhone === "string" ? raw.tenantPhone : defaults.tenantPhone,
    termMode:
      raw.termMode === "customEnd" || raw.termMode === "months" ? raw.termMode : defaults.termMode,
    termMonths: typeof raw.termMonths === "string" ? raw.termMonths : defaults.termMonths,
    unitId:
      lockedUnitId && lockedUnitId.trim() !== ""
        ? lockedUnitId
        : typeof raw.unitId === "string"
          ? raw.unitId
          : defaults.unitId,
  };
}

export function readStartLeaseDraft(
  propertyId: string,
  unitScope: TStartLeaseDraftUnitScope,
  options?: { lockedUnitId?: string; now?: number }
): TStartLeaseDraft | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const key = buildStartLeaseDraftStorageKey(propertyId, unitScope);
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      sessionStorage.removeItem(key);
      return null;
    }

    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0;
    const now = options?.now ?? Date.now();
    if (!updatedAt || now - updatedAt > START_LEASE_DRAFT_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    const stepRaw = typeof parsed.step === "string" ? parsed.step : "who";
    const step = isStartLeaseStep(stepRaw) ? stepRaw : "who";
    const values = mergeDraftValues(parsed.values, options?.lockedUnitId);

    return { step, updatedAt, values };
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    return null;
  }
}

export function writeStartLeaseDraft(
  propertyId: string,
  unitScope: TStartLeaseDraftUnitScope,
  draft: Omit<TStartLeaseDraft, "updatedAt"> & { updatedAt?: number }
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  const payload: TStartLeaseDraft = {
    step: draft.step,
    updatedAt: draft.updatedAt ?? Date.now(),
    values: draft.values,
  };

  try {
    sessionStorage.setItem(
      buildStartLeaseDraftStorageKey(propertyId, unitScope),
      JSON.stringify(payload)
    );
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearStartLeaseDraft(
  propertyId: string,
  unitScope: TStartLeaseDraftUnitScope
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(buildStartLeaseDraftStorageKey(propertyId, unitScope));
  } catch {
    // ignore
  }
}

export function clearAllStartLeaseDrafts(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(START_LEASE_DRAFT_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
