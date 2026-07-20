import {
  parseStartLeaseStep,
  type TStartLeaseStep,
} from "@/lib/start-lease-steps";

export type TStartLeaseFrom = "leases" | "units";

export function buildPropertyStartLeasePath(
  propertyId: string,
  options?: { from?: TStartLeaseFrom; step?: TStartLeaseStep; unitId?: string }
): string {
  const params = new URLSearchParams();
  if (options?.unitId) {
    params.set("unitId", options.unitId);
  }
  if (options?.from) {
    params.set("from", options.from);
  }
  if (options?.step && options.step !== "who") {
    params.set("step", options.step);
  }
  const search = params.toString();
  return `/properties/${encodeURIComponent(propertyId)}/leases/new${search ? `?${search}` : ""}`;
}

export function parseStartLeaseSearchParams(searchParams: URLSearchParams): {
  from: TStartLeaseFrom;
  step: TStartLeaseStep;
  unitId: string;
} {
  const unitId = searchParams.get("unitId")?.trim() ?? "";
  const fromRaw = searchParams.get("from")?.trim();
  const from: TStartLeaseFrom = fromRaw === "units" ? "units" : "leases";
  const step = parseStartLeaseStep(searchParams.get("step"));
  return { from, step, unitId };
}

export function getStartLeaseBackPath(
  propertyId: string,
  from: TStartLeaseFrom
): { label: string; path: string } {
  if (from === "units") {
    return {
      label: "Back to units",
      path: `/properties/${encodeURIComponent(propertyId)}/units`,
    };
  }
  return {
    label: "Back to leases",
    path: `/properties/${encodeURIComponent(propertyId)}/leases`,
  };
}
