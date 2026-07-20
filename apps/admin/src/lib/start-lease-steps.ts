export const START_LEASE_STEPS = ["who", "term", "rent"] as const;

export type TStartLeaseStep = (typeof START_LEASE_STEPS)[number];

export const START_LEASE_STEP_LABELS: Record<TStartLeaseStep, string> = {
  rent: "Rent",
  term: "Term",
  who: "Who",
};

export const START_LEASE_STEP_SUBTITLES: Record<TStartLeaseStep, string> = {
  rent: "Set how often rent is due and enter the amount.",
  term: "Choose the start date and how long the lease runs.",
  who: "Pick the unit and primary tenant.",
};

export function isStartLeaseStep(value: string): value is TStartLeaseStep {
  return (START_LEASE_STEPS as readonly string[]).includes(value);
}

export function parseStartLeaseStep(raw: string | null | undefined): TStartLeaseStep {
  const trimmed = raw?.trim() ?? "";
  return isStartLeaseStep(trimmed) ? trimmed : "who";
}

export function getNextStartLeaseStep(step: TStartLeaseStep): TStartLeaseStep | null {
  const index = START_LEASE_STEPS.indexOf(step);
  if (index < 0 || index >= START_LEASE_STEPS.length - 1) {
    return null;
  }
  return START_LEASE_STEPS[index + 1] ?? null;
}

export function getPreviousStartLeaseStep(step: TStartLeaseStep): TStartLeaseStep | null {
  const index = START_LEASE_STEPS.indexOf(step);
  if (index <= 0) {
    return null;
  }
  return START_LEASE_STEPS[index - 1] ?? null;
}

export function getStartLeaseStepIndex(step: TStartLeaseStep): number {
  return START_LEASE_STEPS.indexOf(step);
}

export function canNavigateToStartLeaseStep(
  target: TStartLeaseStep,
  current: TStartLeaseStep
): boolean {
  return getStartLeaseStepIndex(target) <= getStartLeaseStepIndex(current);
}
