import { memo } from "react";

import { ColoredPill } from "@/components/income/colored-pill";
import { IncomeEntryKind } from "@/packages/shared";

type IncomeEntryTypeBadgeProps =
  | { entryKind: typeof IncomeEntryKind.DEPOSIT }
  | { entryKind: typeof IncomeEntryKind.LONG_TERM }
  | { entryKind: typeof IncomeEntryKind.STAY }
  | { entryKind: typeof IncomeEntryKind.LINE; incomeLineTypeId: string; label: string };

const STAY_CLASS_NAME = "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";

const LONG_TERM_CLASS_NAME = "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400";

const DEPOSIT_CLASS_NAME =
  "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";

const INCOME_TYPE_BADGE_CLASSES = [
  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
] as const;

function getIncomeTypeBadgeClassName(incomeLineTypeId: string): string {
  let hash = 0;
  for (let index = 0; index < incomeLineTypeId.length; index += 1) {
    hash =
      (hash + incomeLineTypeId.charCodeAt(index) * (index + 1)) % INCOME_TYPE_BADGE_CLASSES.length;
  }
  return INCOME_TYPE_BADGE_CLASSES[hash] ?? INCOME_TYPE_BADGE_CLASSES[0];
}

function getIncomeEntryTypeBadgeProps(props: IncomeEntryTypeBadgeProps): {
  className: string;
  label: string;
} {
  if (props.entryKind === IncomeEntryKind.STAY) {
    return { className: STAY_CLASS_NAME, label: "Stay" };
  }

  if (props.entryKind === IncomeEntryKind.LONG_TERM) {
    return { className: LONG_TERM_CLASS_NAME, label: "Long term" };
  }

  if (props.entryKind === IncomeEntryKind.DEPOSIT) {
    return { className: DEPOSIT_CLASS_NAME, label: "Deposit" };
  }

  return {
    className: getIncomeTypeBadgeClassName(props.incomeLineTypeId),
    label: props.label,
  };
}

export const IncomeEntryTypeBadge = memo((props: IncomeEntryTypeBadgeProps) => {
  const { className, label } = getIncomeEntryTypeBadgeProps(props);

  return <ColoredPill className={className}>{label}</ColoredPill>;
});
IncomeEntryTypeBadge.displayName = "IncomeEntryTypeBadge";
