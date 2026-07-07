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
    id: "2026.3.0",
    version: "2026.3.0",
    publishedAt: "2026-07-06",
    summary: "Portfolio finances on Home, a smoother support chat, and photo attachments.",
    changes: [
      {
        category: "new",
        description:
          "Your Home page now shows a financial overview — income, expenses, and trends for the last six months across your properties.",
      },
      {
        category: "new",
        description:
          "Attach photos when submitting a support request — drag and drop images or browse your files (up to 5 images).",
      },
      {
        category: "improved",
        description:
          "Support conversations use a cleaner, full-screen chat layout that feels natural on both phone and desktop.",
      },
      {
        category: "improved",
        description:
          "When adding a property phone number, pick your country from a dropdown — the number formats automatically as you type.",
      },
      {
        category: "improved",
        description:
          "Image uploads show progress while sending and let you retry if something goes wrong.",
      },
      {
        category: "fixed",
        description:
          "The message box on support tickets stays visible at the bottom while you scroll through long conversations.",
      },
      {
        category: "fixed",
        description: "Sending a message in support no longer causes a brief flicker on the screen.",
      },
      {
        category: "fixed",
        description:
          "Signing out now fully clears your session so the next person who logs in won't see your data.",
      },
    ],
  },
  {
    id: "2026.2.0",
    version: "2026.2.0",
    publishedAt: "2026-07-06",
    summary: "Support, notifications, and easier navigation on your phone.",
    changes: [
      {
        category: "new",
        description:
          "Use the Support section to submit requests and follow the full conversation on each ticket.",
      },
      {
        category: "new",
        description:
          "Get in-app notifications when something needs your attention — check the bell icon in the header.",
      },
      {
        category: "new",
        description:
          "On your phone, use the bottom bar to switch quickly between Home, Properties, Reports, and Support.",
      },
      {
        category: "improved",
        description:
          "Support requests appear in a clear list — tap any row to open the full conversation.",
      },
      {
        category: "improved",
        description: "Ticket status labels are easier to read with clearer colors.",
      },
      {
        category: "improved",
        description:
          "Guests are notified automatically when you change their support ticket status.",
      },
      {
        category: "improved",
        description:
          "Messages on a ticket update on their own while you're viewing it — no need to refresh.",
      },
      {
        category: "improved",
        description: "A brief popup appears when a new notification arrives.",
      },
      {
        category: "improved",
        description: "Mark all notifications as read with one tap.",
      },
      {
        category: "improved",
        description:
          "The Download button on property reports is now at the top of the page for easier access.",
      },
      {
        category: "fixed",
        description:
          "Fixed an issue where live updates sometimes didn't appear until you refreshed the page.",
      },
    ],
  },
  {
    id: "2026.1.0",
    version: "2026.1.0",
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
    id: "2026.0.0",
    version: "2026.0.0",
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
