import semver from "semver";

import { IAdminPatchAppConfigBody } from "@/packages/shared";

const MIN_APP_VERSION_MAX_LEN = 20;

type FieldStepResult = { error?: string; touched?: true };

function validateMinAppVersion(fieldLabel: string, value: string): string | undefined {
  if (value.length > MIN_APP_VERSION_MAX_LEN) {
    return `${fieldLabel} must be at most ${MIN_APP_VERSION_MAX_LEN} characters`;
  }
  const coerced = semver.coerce(value);
  if (!coerced || !semver.valid(coerced)) {
    return `${fieldLabel} must be a valid semantic version (e.g. 1.0.0)`;
  }
  return undefined;
}

function parseOptionalUrlField(
  raw: unknown,
  fieldLabel: string
): { error: string } | { ok: true; value: string | null } | { skip: true } {
  if (raw === undefined) return { skip: true };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { error: `${fieldLabel} must be a string or null` };
  }
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { error: `${fieldLabel} must be an http(s) URL` };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { error: `${fieldLabel} must be a valid URL` };
  }
}

function parseMinAppVersionIfPresent(
  o: Record<string, unknown>,
  key: "minAndroidAppVersion" | "minIosAppVersion",
  patch: IAdminPatchAppConfigBody
): FieldStepResult {
  if (!Object.hasOwn(o, key)) return {};
  const v = o[key];
  if (typeof v !== "string") {
    return { error: `${key} must be a string` };
  }
  const err = validateMinAppVersion(key, v);
  if (err) return { error: err };
  patch[key] = v.trim();
  return { touched: true };
}

function parseMaintenanceModeIfPresent(
  o: Record<string, unknown>,
  patch: IAdminPatchAppConfigBody
): FieldStepResult {
  if (!Object.hasOwn(o, "maintenanceMode")) return {};
  const v = o.maintenanceMode;
  if (typeof v !== "boolean") {
    return { error: "maintenanceMode must be a boolean" };
  }
  patch.maintenanceMode = v;
  return { touched: true };
}

function parseStoreUrlIfPresent(
  o: Record<string, unknown>,
  key: "appStoreUrl" | "playStoreUrl",
  patch: IAdminPatchAppConfigBody
): FieldStepResult {
  if (!Object.hasOwn(o, key)) return {};
  const r = parseOptionalUrlField(o[key], key);
  if ("error" in r) return { error: r.error, touched: true };
  if ("ok" in r && r.ok) patch[key] = r.value;
  return { touched: true };
}

export function parsePatchAppConfigBody(
  body: unknown
): { error: string; ok: false } | { ok: true; patch: IAdminPatchAppConfigBody } {
  if (body === null || typeof body !== "object") {
    return { error: "Body must be a JSON object", ok: false };
  }
  const o = body as Record<string, unknown>;
  const patch: IAdminPatchAppConfigBody = {};

  const fieldSteps: (() => FieldStepResult)[] = [
    () => parseMinAppVersionIfPresent(o, "minIosAppVersion", patch),
    () => parseMinAppVersionIfPresent(o, "minAndroidAppVersion", patch),
    () => parseMaintenanceModeIfPresent(o, patch),
    () => parseStoreUrlIfPresent(o, "appStoreUrl", patch),
    () => parseStoreUrlIfPresent(o, "playStoreUrl", patch),
  ];

  let anyField = false;
  for (const step of fieldSteps) {
    const r = step();
    if (r.error !== undefined) return { error: r.error, ok: false };
    if (r.touched) anyField = true;
  }

  if (!anyField) {
    return { error: "At least one field is required", ok: false };
  }

  return { ok: true, patch };
}
