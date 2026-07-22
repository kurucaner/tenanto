import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFormFields,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RELEASE_CHANGE_LABELS,
  RELEASE_NOTABLE_LABEL,
  RELEASE_NOTES,
  type ReleaseChange,
  type ReleaseChangeCategory,
  type ReleaseNote,
} from "@/config/release-notes";
import { cn } from "@/lib/utils";

const CATEGORY_BADGE_CLASS: Record<ReleaseChangeCategory, string> = {
  fixed:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  improved:
    "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  new: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
};

function formatPublishedDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Latest release only: float notable items to the top while preserving relative order. */
function orderReleaseChanges(
  changes: ReleaseChange[],
  prioritizeNotable: boolean
): ReleaseChange[] {
  if (!prioritizeNotable) return changes;

  const notable: ReleaseChange[] = [];
  const rest: ReleaseChange[] = [];
  for (const change of changes) {
    if (change.isBreaking) {
      notable.push(change);
    } else {
      rest.push(change);
    }
  }
  return [...notable, ...rest];
}

const ReleaseChangeItem = memo(({ change }: Readonly<{ change: ReleaseChange }>) => {
  if (change.isBreaking) {
    return (
      <li className="rounded-md border-l-2 border-foreground/25 bg-muted/40 px-3 py-2.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            {RELEASE_NOTABLE_LABEL}
          </span>
          <p className="text-sm leading-relaxed text-foreground">{change.description}</p>
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-foreground">
      <Badge
        className={cn(
          "mt-0.5 h-5 shrink-0 px-2 text-[0.65rem] uppercase tracking-wide",
          CATEGORY_BADGE_CLASS[change.category]
        )}
        variant="outline"
      >
        {RELEASE_CHANGE_LABELS[change.category]}
      </Badge>
      <span className="min-w-0 flex-1 pt-px">{change.description}</span>
    </li>
  );
});
ReleaseChangeItem.displayName = "ReleaseChangeItem";

const ReleaseNoteSection = memo(
  ({
    note,
    prioritizeNotable,
  }: Readonly<{ note: ReleaseNote; prioritizeNotable: boolean }>) => {
    const orderedChanges = orderReleaseChanges(note.changes, prioritizeNotable);

    return (
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
              Version {note.version}
            </h3>
            <time className="text-xs text-muted-foreground" dateTime={note.publishedAt}>
              {formatPublishedDate(note.publishedAt)}
            </time>
          </div>
          {note.summary ? <p className="text-sm text-muted-foreground">{note.summary}</p> : null}
        </div>
        <ul className="flex flex-col gap-2.5">
          {orderedChanges.map((change, index) => (
            <ReleaseChangeItem change={change} key={`${note.id}-${change.category}-${index}`} />
          ))}
        </ul>
      </section>
    );
  }
);
ReleaseNoteSection.displayName = "ReleaseNoteSection";

interface WhatsChangedDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const WhatsChangedDialog = memo(({ onOpenChange, open }: WhatsChangedDialogProps) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>What&apos;s changed</DialogTitle>
        <DialogDescription>Recent improvements and fixes to your workspace.</DialogDescription>
      </DialogHeader>
      <DialogFormFields>
        {RELEASE_NOTES.map((note, index) => (
          <div className="flex flex-col gap-6" key={note.id}>
            <ReleaseNoteSection note={note} prioritizeNotable={index === 0} />
            {index < RELEASE_NOTES.length - 1 ? (
              <div aria-hidden className="h-px bg-border/70" />
            ) : null}
          </div>
        ))}
      </DialogFormFields>
    </DialogContent>
  </Dialog>
));
WhatsChangedDialog.displayName = "WhatsChangedDialog";
