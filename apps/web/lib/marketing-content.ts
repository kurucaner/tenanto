import { APP_NAME } from "@/packages/shared";

export type TMarketingLink = {
  href: string;
  label: string;
};

export type TFeatureItem = {
  accent: "ember" | "glow" | "mint";
  body: string;
  icon: string;
  title: string;
};

export type TMarketingSection = {
  body?: string;
  eyebrow: string;
  features?: TFeatureItem[];
  title: string;
};

export type TMarketingPageContent = {
  description: string;
  headline: string;
  headlineAccent?: string;
  relatedLinks?: TMarketingLink[];
  sections: TMarketingSection[];
  slug: string;
  subhead: string;
  title: string;
  eyebrow?: string;
};

export const MARQUEE_ITEMS = [
  "Airbnb",
  "Booking.com",
  "Expedia",
  "Direct",
  "Leases",
  "Amenity income",
  "AI expense import",
  "Tax breakdown",
  "Portfolio reports",
  "CSV export",
  "Team roles",
] as const;

export const OTA_CHANNELS = ["Airbnb", "Booking.com", "Expedia", "Direct"] as const;

export const FEATURE_NAV_LINKS: TMarketingLink[] = [
  { href: "/short-term-rentals", label: "Short-term rentals" },
  { href: "/long-term-leases", label: "Long-term leases" },
  { href: "/income", label: "Income" },
  { href: "/expenses", label: "Expenses" },
  { href: "/reports", label: "Reports" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/team", label: "Team" },
];

export const PRIMARY_NAV_LINKS: TMarketingLink[] = [
  { href: "/platform", label: "Platform" },
  { href: "/pricing", label: "Pricing" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/contact", label: "Contact" },
];

export const FOOTER_COLUMNS = [
  {
    links: [
      { href: "/platform", label: "Platform" },
      { href: "/short-term-rentals", label: "Short-term rentals" },
      { href: "/long-term-leases", label: "Long-term leases" },
      { href: "/income", label: "Income" },
      { href: "/expenses", label: "Expenses" },
      { href: "/reports", label: "Reports" },
    ],
    title: "Product",
  },
  {
    links: [
      { href: "/portfolio", label: "Portfolio" },
      { href: "/team", label: "Team" },
      { href: "/security", label: "Security" },
      { href: "/reliability", label: "Reliability" },
    ],
    title: "Platform",
  },
  {
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/contact", label: "Contact" },
    ],
    title: "Company",
  },
  {
    links: [
      { href: "/privacy-policy", label: "Privacy" },
      { href: "/terms-of-service", label: "Terms" },
      { href: "/delete-account", label: "Delete account" },
    ],
    title: "Legal",
  },
] as const;

export const HOME_FEATURE_LINKS: TFeatureItem[] = [
  {
    accent: "ember",
    body: "Airbnb, Booking.com, Expedia, and Direct stays with channel commissions and tax math built in.",
    icon: "🏨",
    title: "Channel-aware stays",
  },
  {
    accent: "glow",
    body: "Terms, rent schedules, extensions, and secondary tenants — without spreadsheet drift.",
    icon: "🗝️",
    title: "Leases that stay current",
  },
  {
    accent: "mint",
    body: "Stays, amenity revenue, and custom income types in one unified ledger.",
    icon: "💰",
    title: "Every dollar accounted",
  },
  {
    accent: "ember",
    body: "Charts, KPIs, occupancy, ADR, and CSV exports your accountant will love.",
    icon: "📊",
    title: "Reports that close the books",
  },
];

export const HOME_FEATURE_HREFS = [
  "/short-term-rentals",
  "/long-term-leases",
  "/income",
  "/reports",
] as const;

export const CAPABILITY_STATS = [
  { label: "OTA channels supported", suffix: "", value: 4 },
  { label: "Expense categories", suffix: "", value: 23 },
  { label: "Property team roles", suffix: "", value: 3 },
  { label: "Configurable tax rates", suffix: "+", value: 2 },
] as const;

export const PILOT_TAGLINE = "14-day pilot · white-glove migration included";

export function pageMetadata(title: string, description: string) {
  return {
    description,
    title: `${title} — ${APP_NAME}`,
  };
}

export const MARKETING_PAGES: Record<string, TMarketingPageContent> = {
  platform: {
    description: `How ${APP_NAME} connects properties, units, income, expenses, and portfolio reports.`,
    eyebrow: "Platform",
    headline: "The operating layer",
    headlineAccent: "for rental finance.",
    relatedLinks: [
      { href: "/short-term-rentals", label: "Short-term rentals" },
      { href: "/portfolio", label: "Portfolio" },
    ],
    sections: [
      {
        body: "Each property holds units tagged as short-term or long-term. Income and expenses roll up into property reports, then portfolio-wide analytics.",
        eyebrow: "Architecture",
        title: "Property → Units → Ledger → Reports → Portfolio",
      },
      {
        body: "Run Airbnb units alongside annual leases on the same property. Filters and reports respect rental type everywhere.",
        eyebrow: "Dual rental types",
        features: [
          {
            accent: "ember",
            body: "Reservations with channel-specific commission rules and tax snapshots.",
            icon: "🏨",
            title: "Short-term units",
          },
          {
            accent: "glow",
            body: "Lease terms, rent schedules, extensions, and payment tracking.",
            icon: "🗝️",
            title: "Long-term units",
          },
        ],
        title: "STR and LTR on one property",
      },
      {
        body: `${APP_NAME} computes gross income, net payout, commissions, and taxes identically on server and client — so dashboards, exports, and drill-downs always agree.`,
        eyebrow: "Shared math",
        title: "One source of financial truth",
      },
      {
        body: "Owners, managers, and accountants each get scoped access. Invite by email and manage roles per property.",
        eyebrow: "Teams",
        title: "Built for operators and bookkeepers",
      },
    ],
    slug: "platform",
    subhead: `${APP_NAME} connects every property, unit, income line, and expense into portfolio reports operators trust.`,
    title: "Platform",
  },
  "short-term-rentals": {
    description: `Track Airbnb, Booking.com, Expedia, and Direct stays with commissions and taxes — ${APP_NAME}.`,
    eyebrow: "Short-term rentals",
    headline: "Stays from Airbnb, Booking.com,",
    headlineAccent: "and beyond.",
    relatedLinks: [{ href: "/reports", label: "Reports" }],
    sections: [
      {
        eyebrow: "Channels",
        features: [
          {
            accent: "ember",
            body: "Default 15.5% commission with resort tax adjustment on gross.",
            icon: "🏠",
            title: "Airbnb",
          },
          {
            accent: "glow",
            body: "15% commission on room + cleaning fee base.",
            icon: "🌐",
            title: "Booking.com",
          },
          {
            accent: "mint",
            body: "15% commission calculated on room total only.",
            icon: "✈️",
            title: "Expedia",
          },
          {
            accent: "ember",
            body: "3.5% default commission for direct bookings.",
            icon: "📞",
            title: "Direct",
          },
        ],
        title: "Four channels, configurable rates",
      },
      {
        body: "Track reservations from booking through stay completion — Active, Stayed, Canceled, or No Show — with guest name, dates, unit, and reservation number.",
        eyebrow: "Lifecycle",
        title: "Every stay, every status",
      },
      {
        body: "Gross income, net payout, channel commission, tax breakdown, nights, and ADR — calculated automatically and available in drill-down detail.",
        eyebrow: "Income math",
        title: "Commissions and taxes included",
      },
    ],
    slug: "short-term-rentals",
    subhead: "Channel-aware stay income with commission rules and tax breakdown built in.",
    title: "Short-term rentals",
  },
  "long-term-leases": {
    description: `Long-term lease and tenant management with rent schedules — ${APP_NAME}.`,
    eyebrow: "Long-term leases",
    headline: "Long-term tenant management",
    headlineAccent: "without spreadsheet drift.",
    relatedLinks: [{ href: "/income", label: "Income" }],
    sections: [
      {
        body: "Tenant contact info, unit assignment, term length (1–60 months), and monthly rent — all in one record.",
        eyebrow: "Lease records",
        title: "Everything about the tenancy",
      },
      {
        body: "See expected rent per month with paid or missing status. Know exactly where collections stand.",
        eyebrow: "Rent schedule",
        title: "Expected vs. paid, month by month",
      },
      {
        body: "Extend terms with optional rent changes, end leases with actual move-out dates, and add up to 10 secondary tenants.",
        eyebrow: "Operations",
        title: "Extend, end, and co-tenants",
      },
      {
        body: "Record a rent payment and it flows into the unified income ledger with full tax context.",
        eyebrow: "Ledger sync",
        title: "Payments become income lines",
      },
    ],
    slug: "long-term-leases",
    subhead: "Leases, rent schedules, extensions, and tenant records that stay current.",
    title: "Long-term leases",
  },
  income: {
    description: `Unified income ledger for stays, amenity revenue, and custom income types — ${APP_NAME}.`,
    eyebrow: "Income",
    headline: "Stays, amenity revenue,",
    headlineAccent: "and every other line.",
    relatedLinks: [{ href: "/reports", label: "Reports" }],
    sections: [
      {
        body: "The income page merges reservation stays and manual income lines into one searchable, sortable ledger.",
        eyebrow: "Unified ledger",
        title: "Stays and lines in one view",
      },
      {
        body: "Record property-level amenity revenue without assigning a unit — pool passes, parking, equipment rental, and more.",
        eyebrow: "Amenity income",
        title: "Property-level revenue",
      },
      {
        body: "Default types include rent, extra cleaning, and beach equipment — plus custom types configurable per property.",
        eyebrow: "Income types",
        title: "Configurable categories",
      },
      {
        body: "Sales tax, resort tax, and custom rates snapshotted onto each line so historical reports stay accurate.",
        eyebrow: "Taxes",
        title: "Per-line tax breakdown",
      },
    ],
    slug: "income",
    subhead: "One ledger for stays, amenity revenue, and every other income line.",
    title: "Income",
  },
  expenses: {
    description: `Track 23 expense categories with AI CSV import — ${APP_NAME}.`,
    eyebrow: "Expenses",
    headline: "Track every cost.",
    headlineAccent: "Import hundreds in minutes.",
    relatedLinks: [{ href: "/reports", label: "Reports" }],
    sections: [
      {
        body: "Utilities, maintenance, insurance, salaries, OTA commissions, property tax, and more — 23 categories with smart metadata.",
        eyebrow: "Categories",
        title: "Every cost type covered",
      },
      {
        body: "Upload CSV files, let AI auto-categorize rows, review suggestions, and commit in bulk — up to 5 files and 2,000 rows.",
        eyebrow: "AI import",
        title: "From spreadsheet to ledger",
      },
      {
        body: "Mark expenses as tax-free when they are pass-through or non-deductible. Annual categories like property tax and insurance get special handling.",
        eyebrow: "Flexibility",
        title: "Tax-free flag and category intelligence",
      },
    ],
    slug: "expenses",
    subhead: "23 expense categories with AI-powered CSV import and smart categorization.",
    title: "Expenses",
  },
  reports: {
    description: `Property and portfolio reports with charts, KPIs, and CSV export — ${APP_NAME}.`,
    eyebrow: "Reports",
    headline: "Charts, KPIs, and CSV exports",
    headlineAccent: "your accountant will love.",
    relatedLinks: [{ href: "/portfolio", label: "Portfolio" }],
    sections: [
      {
        body: "Gross income, net payout, total expenses, and operational net — at a glance for any date range.",
        eyebrow: "Summary KPIs",
        title: "The numbers that matter",
      },
      {
        body: "Income composition, channel revenue, commission by channel, tax summary, revenue vs. expense trend, profit trend, and expenses by category.",
        eyebrow: "Charts",
        title: "Visual financial storytelling",
      },
      {
        body: "Occupancy %, ADR, booked and available nights — per unit, filterable by channel and rental type.",
        eyebrow: "Unit performance",
        title: "Per-unit occupancy and ADR",
      },
      {
        body: "Download property or portfolio reports as CSV for your accountant or external BI tools.",
        eyebrow: "Export",
        title: "CSV export at every level",
      },
    ],
    slug: "reports",
    subhead: "Per-property and portfolio analytics with charts, tables, and CSV export.",
    title: "Reports",
  },
  portfolio: {
    description: `Multi-property dashboard and portfolio-wide financial reports — ${APP_NAME}.`,
    eyebrow: "Portfolio",
    headline: "See the whole portfolio —",
    headlineAccent: "not property by property.",
    relatedLinks: [{ href: "/reports", label: "Reports" }],
    sections: [
      {
        body: "Searchable property list with infinite scroll. Jump into any property's ledger or reports in one click.",
        eyebrow: "Properties",
        title: "Every door in one list",
      },
      {
        body: "Aggregate KPIs across all properties you can access — with the same filters as property-level reports.",
        eyebrow: "Portfolio reports",
        title: "Roll-up analytics",
      },
      {
        body: "The home dashboard shows a 6-month financial overview across your entire portfolio.",
        eyebrow: "Dashboard",
        title: "Six-month trend at a glance",
      },
    ],
    slug: "portfolio",
    subhead: "Multi-property management with portfolio-wide reports and financial overview.",
    title: "Portfolio",
  },
  team: {
    description: `Owner, manager, and accountant roles with property-level permissions — ${APP_NAME}.`,
    eyebrow: "Team",
    headline: "Give owners, managers, and accountants",
    headlineAccent: "exactly the access they need.",
    relatedLinks: [{ href: "/contact", label: "Contact" }],
    sections: [
      {
        body: "Three roles with a clear permission matrix. Property creators are always treated as owners.",
        eyebrow: "Roles",
        title: "Owner · Manager · Accountant",
      },
      {
        body: "Send email invitations with pending, accepted, or failed delivery status. Change roles or remove members anytime.",
        eyebrow: "Invites",
        title: "Invite by email",
      },
      {
        body: "In-app support tickets with image attachments, threaded messages, and real-time status updates.",
        eyebrow: "Support",
        title: "Help without leaving the app",
      },
    ],
    slug: "team",
    subhead: "Role-based access for owners, managers, and accountants on every property.",
    title: "Team",
  },
  pricing: {
    description: `Start with a free 14-day pilot — ${APP_NAME} property accounting.`,
    eyebrow: "Pricing",
    headline: "Start with a free",
    headlineAccent: "14-day pilot.",
    relatedLinks: [{ href: "/contact", label: "Contact" }],
    sections: [
      {
        body: "No setup fees, no per-seat pricing during the pilot. Onboard your first property in under an hour with white-glove migration support.",
        eyebrow: "Pilot program",
        title: "Try before you commit",
      },
      {
        body: "We tailor pricing to your portfolio size after the pilot. No public tiers yet — just honest, portfolio-based quotes.",
        eyebrow: "After pilot",
        title: "Custom portfolio pricing",
      },
    ],
    slug: "pricing",
    subhead: "No setup fees, no per-seat pricing — just a calm path from pilot to portfolio.",
    title: "Pricing",
  },
  reliability: {
    description: `24/7 availability, safe upgrades, and data integrity — ${APP_NAME}.`,
    eyebrow: "Reliability",
    headline: "Always on.",
    headlineAccent: "Always improving.",
    relatedLinks: [{ href: "/security", label: "Security" }],
    sections: [
      {
        body: "Production monitoring, health checks, and incident response keep the platform available around the clock.",
        eyebrow: "Availability",
        title: "24/7 operations",
      },
      {
        body: "Database migrations run automatically on deploy. API contracts live in shared types so server and clients stay in sync.",
        eyebrow: "Upgrades",
        title: "Safe, continuous improvement",
      },
      {
        body: "Real-time notification stream via SSE. Soft-delete with restore on key records. Admin audit log for platform actions.",
        eyebrow: "Data integrity",
        title: "Recoverable, auditable data",
      },
      {
        body: "Controlled maintenance windows via app config when needed — with clear communication to operators.",
        eyebrow: "Maintenance",
        title: "Planned downtime, not surprises",
      },
    ],
    slug: "reliability",
    subhead: "Production monitoring, automatic migrations, and data integrity you can count on.",
    title: "Reliability",
  },
  roadmap: {
    description: `What we're building next — ${APP_NAME} product roadmap.`,
    eyebrow: "Roadmap",
    headline: "What we're",
    headlineAccent: "building next.",
    relatedLinks: [{ href: "/contact", label: "Contact" }],
    sections: [],
    slug: "roadmap",
    subhead: "Shipped features today, and an honest look at what comes next.",
    title: "Roadmap",
  },
};

export type TRoadmapItem = {
  body: string;
  horizon: "near" | "long";
  title: string;
};

export const ROADMAP_ITEMS: TRoadmapItem[] = [
  {
    body: "Push notifications and mobile init endpoints are in place — native operator app coming next.",
    horizon: "near",
    title: "Mobile operator app",
  },
  {
    body: "Deeper sync with OTA platforms beyond manual reservation entry.",
    horizon: "near",
    title: "OTA integrations",
  },
  {
    body: "Import reservations in bulk from CSV or channel exports.",
    horizon: "near",
    title: "Bulk reservation import",
  },
  {
    body: "Compare properties and units against portfolio benchmarks.",
    horizon: "near",
    title: "Portfolio benchmarking",
  },
  {
    body: "Ticket triage, vendor matching, and maintenance scheduling.",
    horizon: "long",
    title: "Maintenance workflows",
  },
  {
    body: "Autopay, split-pay, and instant reconciliation to the ledger.",
    horizon: "long",
    title: "Rent collection",
  },
  {
    body: "Amenity booking, package alerts, and resident communications.",
    horizon: "long",
    title: "Resident portal",
  },
  {
    body: "AI-assisted application screening and lease preparation.",
    horizon: "long",
    title: "AI-assisted leasing",
  },
];

export type TTeamPermissionRow = {
  accountant: boolean;
  capability: string;
  manager: boolean;
  owner: boolean;
};

export const TEAM_PERMISSIONS: TTeamPermissionRow[] = [
  { accountant: false, capability: "Manage property structure", manager: false, owner: true },
  { accountant: false, capability: "Manage units", manager: true, owner: true },
  { accountant: false, capability: "Manage income & expenses", manager: true, owner: true },
  { accountant: true, capability: "View reports & ledger", manager: true, owner: true },
  { accountant: false, capability: "Manage team members", manager: false, owner: true },
  { accountant: false, capability: "Edit tax & commission settings", manager: false, owner: true },
];

export const PRICING_FAQ = [
  {
    answer: "Fourteen days, fully featured, with migration support included.",
    question: "How long is the pilot?",
  },
  {
    answer: "We help import properties, units, and historical data during onboarding.",
    question: "Can you migrate our existing data?",
  },
  {
    answer: "Unlimited team members per property — no per-seat fees during the pilot.",
    question: "Are there seat limits?",
  },
  {
    answer: "Export reports as CSV anytime. Your data stays yours.",
    question: "What if we don't continue?",
  },
] as const;

export const SITEMAP_ROUTES = [
  { changeFrequency: "monthly" as const, path: "", priority: 1 },
  { changeFrequency: "monthly" as const, path: "/platform", priority: 0.9 },
  { changeFrequency: "monthly" as const, path: "/short-term-rentals", priority: 0.8 },
  { changeFrequency: "monthly" as const, path: "/long-term-leases", priority: 0.8 },
  { changeFrequency: "monthly" as const, path: "/income", priority: 0.8 },
  { changeFrequency: "monthly" as const, path: "/expenses", priority: 0.8 },
  { changeFrequency: "monthly" as const, path: "/reports", priority: 0.8 },
  { changeFrequency: "monthly" as const, path: "/portfolio", priority: 0.7 },
  { changeFrequency: "monthly" as const, path: "/team", priority: 0.7 },
  { changeFrequency: "monthly" as const, path: "/pricing", priority: 0.8 },
  { changeFrequency: "monthly" as const, path: "/reliability", priority: 0.6 },
  { changeFrequency: "monthly" as const, path: "/roadmap", priority: 0.6 },
  { changeFrequency: "monthly" as const, path: "/security", priority: 0.6 },
  { changeFrequency: "monthly" as const, path: "/contact", priority: 0.7 },
  { changeFrequency: "yearly" as const, path: "/privacy-policy", priority: 0.3 },
  { changeFrequency: "yearly" as const, path: "/terms-of-service", priority: 0.3 },
  { changeFrequency: "yearly" as const, path: "/delete-account", priority: 0.2 },
  { changeFrequency: "never" as const, path: "/unsubscribe", priority: 0.1 },
];
