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
    changes: [
      {
        category: "improved",
        description:
          "Starting a lease is now a short three-step flow — who, term, then rent — with a clean full-page layout and a live recap before you confirm.",
      },
      {
        category: "improved",
        description:
          "If you refresh after moving to the next step while starting a lease, your progress is kept until you finish, cancel, or sign out.",
      },
      {
        category: "fixed",
        description:
          "Start lease no longer rejects a valid tenant name or shows empty fields after refresh — the form stays in sync with what you type.",
      },
      {
        category: "fixed",
        description:
          "If required lease fields were missing when starting a lease, you now get a clear message and the page scrolls to what needs fixing.",
      },
    ],
    id: "2026.15.0",
    publishedAt: "2026-07-20",
    summary: "Start lease is a three-step wizard that remembers your progress if you refresh.",
    version: "2026.15.0",
  },
  {
    changes: [
      {
        category: "new",
        description:
          "Lease rent shows in the Income table as its own Long term type — filter by Long term to see rent payments separate from short stays and other income lines.",
      },
      {
        category: "improved",
        description:
          "Property Settings lists for income types, expense categories, tax rates, and channel commissions use searchable catalogs with add and edit dialogs instead of inline rows.",
      },
      {
        category: "improved",
        description:
          "Recording rent from a lease no longer asks you to pick an income type — the amount and date are enough.",
      },
      {
        category: "improved",
        description:
          "Stripe Connect in Settings shows a clearer not connected, in progress, or connected layout, and you can switch between Express and Standard while setup is still incomplete.",
      },
      {
        category: "improved",
        description:
          "The cash-expense checkbox is now labeled Paid in cash, and the Expenses table shows a Cash badge for those entries.",
      },
      {
        category: "fixed",
        description:
          "Your recently viewed properties list clears when you sign out so the next person on the same browser does not see your history.",
      },
    ],
    id: "2026.14.0",
    publishedAt: "2026-07-19",
    summary:
      "Long-term rent in Income, cleaner property Settings catalogs, and clearer rent recording and Stripe Connect setup.",
    version: "2026.14.0",
  },
  {
    changes: [
      {
        category: "new",
        description:
          "Tenants get their own portal — sign in with email, Google, Apple, or a phone code; view active and past leases; and accept portal invites from a dedicated page.",
      },
      {
        category: "new",
        description:
          "Tenants can pay rent online when a property is connected to Stripe — from home or the lease view, with partial payments and monthly balance tracked on the lease.",
      },
      {
        category: "new",
        description:
          "Connect a property to Stripe from Settings — choose Express onboarding or link an existing Standard account.",
      },
      {
        category: "new",
        description:
          "Invite teammates to a property with a personal link — they accept or decline on their own page, including signup if they are new.",
      },
      {
        category: "new",
        description:
          "Add secondary occupants on a lease, invite them to the portal, and include them in tenant email campaigns.",
      },
      {
        category: "new",
        description:
          "Edit lease terms from the lease detail Terms tab before rent has started — dates, rent, deposit, and related fields.",
      },
      {
        category: "improved",
        description:
          "Lease proration when starting, ending, or holding over — rent due for partial months is calculated automatically in admin and reflected on the lease.",
      },
      {
        category: "improved",
        description:
          "Property reports use the same date presets and filter toolbar as Income and Expenses; the leases list defaults to active status.",
      },
      {
        category: "improved",
        description:
          "Mobile property navigation opens as a bottom sheet for quicker section switching on small screens.",
      },
      {
        category: "improved",
        description:
          "Portal invites on the Tenants tab and lease detail — clearer status, confirm before revoking access, and single-use invite links.",
      },
      {
        category: "improved",
        description:
          "When a lease starts with a primary tenant email, a portal invite sends automatically; lease-ended emails include holdover and final rent details.",
      },
      {
        category: "improved",
        description:
          "Tenants can opt in to SMS updates from their settings; standard STOP and HELP replies are supported.",
      },
      {
        category: "improved",
        description:
          "Extend and end lease actions moved to the lease detail toolbar; recording rent removed from the lease header to reduce confusion.",
      },
      {
        category: "fixed",
        description:
          "Recording income defaults the payment date to today; empty property exports are blocked with a clear message.",
      },
    ],
    id: "2026.13.0",
    publishedAt: "2026-07-18",
    summary:
      "Tenant portal with online rent payments, team and co-tenant invites, lease term edits, and Stripe Connect.",
    version: "2026.13.0",
  },
  {
    changes: [
      {
        category: "new",
        description:
          "Each property has an Exports tab — download income, expenses, or leases as CSV or Excel, track past exports, and get a notification when a large export is ready.",
      },
      {
        category: "new",
        description:
          "Send email updates to tenants from a property's Communications tab — watch live send progress, review past campaigns, and open a finished send from your notifications.",
      },
      {
        category: "new",
        description:
          "You can refund part of a stay or other income line, not only the full amount — partial refunds show clearly in the Income table and stay out of your reports.",
      },
      {
        category: "new",
        description:
          "Filter the Units table by rental type, occupancy, move-in dates, and search — same compact toolbar style as Income and Expenses.",
      },
      {
        category: "new",
        description:
          "Search the Income table by guest, unit, channel, and other fields; filter by refund status and use quick date presets such as this month or year to date.",
      },
      {
        category: "improved",
        description:
          "Income, Expenses, and Properties use a tighter filter bar so you can scan and clear filters faster.",
      },
      {
        category: "improved",
        description:
          "Income, Expenses, and Units tables keep showing your rows while filters update instead of flashing empty.",
      },
      {
        category: "improved",
        description:
          "Export actions on Income, Expenses, and Leases live in the More menu; the Exports tab supports sorting, search, and date filters.",
      },
      {
        category: "fixed",
        description:
          "Search boxes accept spaces, stop flickering while the page catches up, and unit filter menus no longer list “All” twice.",
      },
    ],
    id: "2026.12.0",
    publishedAt: "2026-07-14",
    summary:
      "Property exports, tenant email campaigns, partial refunds, and a smoother notifications inbox.",
    version: "2026.12.0",
  },
  {
    changes: [
      {
        category: "new",
        description:
          "Star properties on the Properties list to mark favorites — they stay at the top so you can jump back to them quickly.",
      },
      {
        category: "new",
        description:
          "You can import stays from a CSV export (such as Hotel Tax Calculator) — upload your file, review and edit each row, then save them in one step.",
      },
      {
        category: "new",
        description:
          "You can mark a stay or other income line as refunded from the Income table; refunded items are excluded from your reports.",
      },
      {
        category: "new",
        description:
          "Property Reports include a profit trend chart so you can see how net income changes month to month.",
      },
      {
        category: "improved",
        description:
          "You can sort the Income table by date, guest, unit, channel, amounts, and other columns.",
      },
      {
        category: "improved",
        description:
          "Search the Expenses table by description or category, and the Properties list by name or address.",
      },
      {
        category: "improved",
        description:
          "The Units table loads more rows as you scroll and can be sorted by rental type.",
      },
      {
        category: "improved",
        description:
          "Filter bars on Expenses, Income, and Properties share a consistent layout; table action buttons show helpful tooltips on hover.",
      },
    ],
    id: "2026.11.0",
    publishedAt: "2026-07-13",
    summary:
      "Favorite properties, import income from CSV, refund stays and lines, and a faster sortable Income table.",
    version: "2026.11.0",
  },
  {
    changes: [
      {
        category: "new",
        description:
          "Hold Shift and click the trash icon to delete expenses, stays, other income, units, or property settings rows without a confirmation step.",
      },
      {
        category: "new",
        description:
          "Password fields include a show/hide control so you can check what you typed when signing in or resetting your password.",
      },
      {
        category: "new",
        description:
          "You can set up your own booking channels and commission rules in Property Settings instead of using a fixed list.",
      },
      {
        category: "new",
        description:
          "Property Settings lets you save tax rates, expense categories, channels, and income types one section at a time.",
      },
      {
        category: "new",
        description:
          "The primary tenant on a lease receives an email when rent is recorded for their unit.",
      },
      {
        category: "improved",
        description:
          "Expenses, Income, Units, and Leases tables share a cleaner, more consistent layout.",
      },
      {
        category: "improved",
        description:
          "Long lists — including the expense CSV import preview — scroll more smoothly on large properties.",
      },
      {
        category: "improved",
        description:
          "Property Settings lists stay within a fixed height with sticky column headers as you scroll.",
      },
      {
        category: "improved",
        description:
          "Adding or editing a unit uses a clearer Short Term / Long Term picker instead of a dropdown.",
      },
      {
        category: "improved",
        description: "The Google sign-in button displays correctly in dark mode.",
      },
      {
        category: "fixed",
        description:
          "The main content area scrolls correctly on desktop instead of the whole page shifting.",
      },
      {
        category: "fixed",
        description:
          "Removing a property team member follows the same delete confirmation as other lists.",
      },
      {
        category: "fixed",
        description: "Support reply emails show formatted content again instead of plain text.",
      },
    ],
    id: "2026.10.0",
    publishedAt: "2026-07-12",
    summary:
      "Shift-click quick delete, show/hide passwords, customizable booking channels, and smoother tables across the app.",
    version: "2026.10.0",
  },
  {
    changes: [
      {
        category: "new",
        description:
          "You can create an account with email or sign in with Google, and reset your password if you forget it.",
      },
      {
        category: "new",
        description:
          "You can extend an active lease and optionally update the monthly rent when the new term starts.",
      },
      {
        category: "new",
        description:
          "Lease details are organized into Overview, Tenants, Payments, and Terms tabs on their own page.",
      },
      {
        category: "new",
        description:
          "You can add, rename, and remove expense categories in Property Settings so they match how you track costs.",
      },
      {
        category: "new",
        description: "You can close your own support tickets when your question is resolved.",
      },
      {
        category: "improved",
        description:
          "Expenses and Leases lists load more records as you scroll instead of showing everything at once.",
      },
      {
        category: "improved",
        description:
          "Expense CSV import now includes check transactions from bank exports, not just card charges.",
      },
      {
        category: "improved",
        description:
          "The Units table shows how many units you have of each type at the bottom of the list.",
      },
      {
        category: "improved",
        description:
          "Click anywhere in the support attachment area to add a file — you no longer need to hit the small button.",
      },
      {
        category: "improved",
        description:
          "Property invite emails show your role and include a Register now link for new team members.",
      },
      {
        category: "fixed",
        description:
          "You can record reservations with past check-in dates when adding historical stays.",
      },
      {
        category: "fixed",
        description: "Ending a lease now accepts valid move-out dates within the lease period.",
      },
      {
        category: "fixed",
        description:
          "The phone number field no longer drops keystrokes when you first start typing.",
      },
      {
        category: "fixed",
        description:
          "Property team members no longer disappear from the list after you edit property details.",
      },
    ],
    id: "2026.9.0",
    publishedAt: "2026-07-11",
    summary:
      "Sign up and sign in with Google, extend leases, customize expense categories, and smoother expense and lease lists.",
    version: "2026.9.0",
  },
  {
    changes: [
      {
        category: "new",
        description:
          "You can import expenses from bank or card CSV files — upload your files, review suggested amounts and categories, edit anything you need, then save them in one step.",
      },
      {
        category: "new",
        description:
          "Property Reports include a monthly chart comparing gross income and expenses so you can spot trends at a glance.",
      },
      {
        category: "new",
        description:
          "Property Reports include a chart showing how much booking commission you paid by channel for the selected period.",
      },
      {
        category: "improved",
        description:
          "Deleting a unit, stay, income line, expense, or team member now asks you to confirm before it is removed.",
      },
      {
        category: "fixed",
        description:
          "Income and reservation lists now refresh correctly after you add or change records.",
      },
    ],
    id: "2026.8.0",
    publishedAt: "2026-07-09",
    summary:
      "Import expenses from bank CSVs with Smart read, new income and commission charts on Reports, and clearer delete confirmations.",
    version: "2026.8.0",
  },
  {
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
    id: "2026.7.0",
    publishedAt: "2026-07-09",
    summary:
      "Manage long-term leases and rent, add secondary tenants, edit tenant contact details, and clearer forms across Units, Income, and Expenses.",
    version: "2026.7.0",
  },
  {
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
    id: "2026.6.0",
    publishedAt: "2026-07-08",
    summary:
      "Switch properties from the header, clearer report charts, soft delete with restore, and filters that stay put when you refresh.",
    version: "2026.6.0",
  },
  {
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
    id: "2026.5.0",
    publishedAt: "2026-07-08",
    summary:
      "Long-term stays, a clearer Income table with a new Net Payout column, tax-free expenses, and property-wide income.",
    version: "2026.5.0",
  },
  {
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
    id: "2026.4.0",
    publishedAt: "2026-07-07",
    summary: "More control over taxes and income types, amenity units, and a clearer income table.",
    version: "2026.4.0",
  },
  {
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
    id: "2026.3.0",
    publishedAt: "2026-07-06",
    summary: "Portfolio finances on Home, a smoother support chat, and photo attachments.",
    version: "2026.3.0",
  },
  {
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
    id: "2026.2.0",
    publishedAt: "2026-07-06",
    summary: "Support, notifications, and easier navigation on your phone.",
    version: "2026.2.0",
  },
  {
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
    id: "2026.1.0",
    publishedAt: "2026-07-05",
    summary: "Portfolio reports and a clearer property workspace.",
    version: "2026.1.0",
  },
  {
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
    id: "2026.0.0",
    publishedAt: "2026-06-15",
    summary: "Track income and expenses for each property.",
    version: "2026.0.0",
  },
];

export const LATEST_RELEASE_ID = RELEASE_NOTES[0]?.id ?? null;
