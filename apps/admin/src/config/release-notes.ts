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
    id: "2026.7.0",
    version: "2026.7.0",
    publishedAt: "2026-07-09",
    summary:
      "Manage long-term leases and rent, add secondary tenants, edit tenant contact details, and clearer forms across Units, Income, and Expenses.",
    changes: [
      {
        category: "new",
        description:
          "You can manage long-term leases from a new Leases tab — start and end a lease from a unit, see the rent schedule, and record monthly rent as income.",
      },
      {
        category: "new",
        description:
          "Add secondary tenants (partners or roommates) to an active lease from the lease details panel.",
      },
      {
        category: "improved",
        description:
          "Edit a primary or secondary tenant’s name, email, and phone on an active lease after move-in, even if you skipped contact details when starting the lease.",
      },
      {
        category: "improved",
        description:
          "Tenant phone fields use the same country-aware phone input as when you create a property.",
      },
      {
        category: "improved",
        description:
          "The Units page lists short-term units before long-term ones, and you can sort by Type from the column header.",
      },
      {
        category: "improved",
        description:
          "Creating a unit, reservation, income line, or lease now shows clearer validation messages next to the fields that need attention.",
      },
      {
        category: "improved",
        description: "Support requests can be refreshed from the table without reloading the page.",
      },
      {
        category: "fixed",
        description:
          "Expense forms show validation errors inline, and the date is required when you add a new expense.",
      },
      {
        category: "fixed",
        description:
          "The expense breakdown chart now includes every category and scrolls when the list is long.",
      },
      {
        category: "fixed",
        description: "Tables show a subtle loading indicator while data is refreshing.",
      },
      {
        category: "fixed",
        description:
          "Date filters on Income and related pages lay out more cleanly on phones and tablets.",
      },
    ],
  },
  {
    id: "2026.6.0",
    version: "2026.6.0",
    publishedAt: "2026-07-08",
    summary:
      "Switch properties from the header, clearer report charts, soft delete with restore, and filters that stay put when you refresh.",
    changes: [
      {
        category: "new",
        description:
          "You can switch properties from the header — search by name or pick from your recently visited properties without going back to the list.",
      },
      {
        category: "new",
        description:
          "On Income, open Details on a stay to see how commission, gross income, and net payout were calculated.",
      },
      {
        category: "new",
        description:
          "Reports and your Home overview now show a profit trend chart — operational net income over time with profit margin — instead of a simple income vs expenses bar chart.",
      },
      {
        category: "improved",
        description:
          "Property reports include an income composition chart (long-term, short-term, and other income) and a chart for your other income types.",
      },
      {
        category: "improved",
        description:
          "Filters and table sort on Income, Expenses, Reports, and list pages stay in the address bar, so refreshing or sharing a link keeps your view.",
      },
      {
        category: "improved",
        description:
          "Stays now store the room total for the booking; Expedia commission is based on the room total and does not include the cleaning fee.",
      },
      {
        category: "improved",
        description:
          "The Income table separates taxes and fees more clearly, and the report summary card label now reads Net Payout.",
      },
      {
        category: "fixed",
        description:
          "The commission Details breakdown no longer treats the cleaning fee as part of the commission calculation when it shouldn't be.",
      },
    ],
  },
  {
    id: "2026.5.0",
    version: "2026.5.0",
    publishedAt: "2026-07-08",
    summary:
      "Long-term stays, a clearer Income table with a new Net Payout column, tax-free expenses, and property-wide income.",
    changes: [
      {
        category: "new",
        description:
          "You can now record long-term stays. Add the guest, lease start date, term in months, and monthly rent — the lease end date is worked out for you.",
      },
      {
        category: "new",
        description:
          "The Income table has a new Net Payout column — what you keep after the booking channel's commission but before taxes.",
      },
      {
        category: "new",
        description:
          "Hover the info icon on an Income column header to see, in plain words, how that amount is worked out.",
      },
      {
        category: "new",
        description:
          "You can now mark an expense as tax-free, and see which expenses are tax-free at a glance in the list.",
      },
      {
        category: "new",
        description:
          "When adding other income, choose Property Amenity for money that isn't tied to a specific room — such as a pool, parking, or vending machine.",
      },
      {
        category: "new",
        description:
          "Each stay's booking channel commission now appears in its taxes and fees breakdown.",
      },
      {
        category: "improved",
        description:
          "The Income table's Net column is now called Net Income, so its meaning is clearer.",
      },
      {
        category: "improved",
        description:
          "Adding a stay is now called Add Short Stay and only lists your short-term rooms, keeping short and long-term stays separate.",
      },
      {
        category: "improved",
        description:
          "Money fields — rent, room rate, cleaning fee, and amounts — now accept numbers only, with up to two decimal places.",
      },
      {
        category: "improved",
        description: "The sidebar now remembers whether you left it open or collapsed.",
      },
      {
        category: "fixed",
        description:
          "Check-in and check-out dates on stays now follow sensible rules, so you can't pick dates that don't make sense.",
      },
      {
        category: "fixed",
        description: "Dates on other income and expenses can no longer be set in the future.",
      },
    ],
  },
  {
    id: "2026.4.0",
    version: "2026.4.0",
    publishedAt: "2026-07-07",
    summary: "More control over taxes and income types, amenity units, and a clearer income table.",
    changes: [
      {
        category: "new",
        description: "You can now set up your own tax names and rates in each property's Settings.",
      },
      {
        category: "new",
        description:
          "You can choose which other income types appear when you add income — Extra cleaning and Beach equipment rental are included by default, and you can add or rename your own.",
      },
      {
        category: "new",
        description:
          "You can add amenity units (such as a pool or parking) separately from rentable rooms.",
      },
      {
        category: "new",
        description:
          "You can record other income on an amenity and link it to a guest's stay when needed.",
      },
      {
        category: "new",
        description: "Property managers can now add, edit, and remove units and amenities.",
      },
      {
        category: "new",
        description: "You can add an optional legal name on the property overview.",
      },
      {
        category: "new",
        description: "You can attach photos when you reply to a support ticket.",
      },
      {
        category: "new",
        description: "Tap column headers on Income and Reports to sort the table.",
      },
      {
        category: "new",
        description:
          "Income rows now use color-coded labels for type, booking channel, and stay status.",
      },
      {
        category: "new",
        description: "You can see a taxes and fees breakdown for each stay on the Income page.",
      },
      {
        category: "improved",
        description: "The Add Other Income form responds faster when you change the unit.",
      },
      {
        category: "improved",
        description:
          "Property tabs and notifications stay steady while you're working in a dialog.",
      },
      {
        category: "improved",
        description: "Support photo uploads are more reliable.",
      },
      {
        category: "improved",
        description:
          "On your phone, bottom navigation labels are fully readable and stay on screen.",
      },
      {
        category: "fixed",
        description: "Property tabs on small screens wrap instead of forcing sideways scrolling.",
      },
      {
        category: "fixed",
        description: "You now get a clear message if a unit or amenity name is already in use.",
      },
      {
        category: "fixed",
        description:
          "You now get a clear message if a unit can't be deleted because it still has stays or income.",
      },
      {
        category: "fixed",
        description: "Deleting an income entry or stay now works reliably.",
      },
      {
        category: "fixed",
        description: "Support reply buttons now show the expected click cursor.",
      },
    ],
  },
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
        description:
          "Each property now has one place for units, income, expenses, reports, and settings.",
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
