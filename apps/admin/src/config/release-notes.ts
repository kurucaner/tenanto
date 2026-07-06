/**
 * Release notes shown in the admin sidebar "What's changed" dialog.
 *
 * Writing guidelines (keep copy non-technical):
 * - Write like you're emailing a property manager — focus on what they can do or notice.
 * - Avoid jargon: API, cache, migration, refactor, endpoint, etc.
 * - Use short, active sentences: "You can now…", "Fixed an issue where…"
 * - Group each item as new | improved | fixed.
 * - Add newest releases at the TOP of RELEASE_NOTES with a unique `id` (use the version string).
 * - Bump `version` using simple numbering: 1.0.0, 1.1.0, 1.2.0, etc.
 */

export type ReleaseChangeCategory = "new" | "improved" | "fixed";

export type ReleaseChange = {
  category: ReleaseChangeCategory;
  description: string;
};

export type ReleaseNote = {
  id: string;
  version: string;
  publishedAt: string;
  summary?: string;
  changes: ReleaseChange[];
};

export const RELEASE_CHANGE_LABELS: Record<ReleaseChangeCategory, string> = {
  fixed: "Fixed",
  improved: "Improved",
  new: "New",
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: "1.1.0",
    version: "1.1.0",
    publishedAt: "2026-07-05",
    summary: "Portfolio reports and a clearer property workspace.",
    changes: [
      {
        category: "new",
        description: "View portfolio reports with filters for date range and rental type.",
      },
      {
        category: "new",
        description: "Download a summary report of your properties as a spreadsheet.",
      },
      {
        category: "improved",
        description: "Each property now has one place for units, income, expenses, reports, and settings.",
      },
      {
        category: "fixed",
        description: "Report totals stay consistent when you change the date range.",
      },
    ],
  },
  {
    id: "1.0.0",
    version: "1.0.0",
    publishedAt: "2026-06-15",
    summary: "Track income and expenses for each property.",
    changes: [
      {
        category: "new",
        description: "Add rooms (units) to each property with layout and rental type.",
      },
      {
        category: "new",
        description: "Record guest stays and other income with automatic tax and fee calculations.",
      },
      {
        category: "new",
        description: "Log property expenses by category and date.",
      },
      {
        category: "new",
        description: "Set tax and booking commission rates in each property's settings.",
      },
      {
        category: "improved",
        description: "Property overview shows your role and who else has access.",
      },
    ],
  },
];

export const LATEST_RELEASE_ID = RELEASE_NOTES[0]?.id ?? null;
