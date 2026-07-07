import { memo } from "react";

import { ColoredPill } from "@/components/income/colored-pill";
import { formatIncomeLineTypeLabel } from "@/components/income/income-line-form-options";
import {
  IncomeEntryKind,
  IncomeLineType,
  type TIncomeLineType,
} from "@/packages/shared";

type IncomeEntryTypeBadgeProps =
  | { entryKind: typeof IncomeEntryKind.STAY }
  | { entryKind: typeof IncomeEntryKind.LINE; lineType: TIncomeLineType };

const LINE_TYPE_CLASS_NAMES: Record<TIncomeLineType, string> = {
  [IncomeLineType.BEACH_EQUIPMENT_RENTAL]:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  [IncomeLineType.CLEANING_ONLY]:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  [IncomeLineType.EXTRA_CLEANING]:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  [IncomeLineType.EXTRA_SERVICE]:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const STAY_CLASS_NAME =
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";

function getIncomeEntryTypeBadgeProps(props: IncomeEntryTypeBadgeProps): {
  className: string;
  label: string;
} {
  if (props.entryKind === IncomeEntryKind.STAY) {
    return { className: STAY_CLASS_NAME, label: "Stay" };
  }

  return {
    className: LINE_TYPE_CLASS_NAMES[props.lineType],
    label: formatIncomeLineTypeLabel(props.lineType),
  };
}

export const IncomeEntryTypeBadge = memo((props: IncomeEntryTypeBadgeProps) => {
  const { className, label } = getIncomeEntryTypeBadgeProps(props);

  return <ColoredPill className={className}>{label}</ColoredPill>;
});
IncomeEntryTypeBadge.displayName = "IncomeEntryTypeBadge";
