import { type TDashboardMockProps } from "@/components/landing/dashboard-mock";

const SIDEBAR = [
  "Overview",
  "Properties",
  "Units",
  "Leases",
  "Income",
  "Expenses",
  "Reports",
] as const;

export const MOCK_PORTFOLIO: TDashboardMockProps = {
  activeSidebarIndex: 0,
  barsLabel: "Portfolio net — last 8 months",
  kpis: [
    { label: "Gross income", tone: "text-mint", value: "$284K" },
    { label: "Net payout", tone: "text-glow", value: "$241K" },
    { label: "Operational net", tone: "text-ember", value: "$198K" },
  ],
  sidebarItems: SIDEBAR,
  title: "Portfolio Overview",
};

export const MOCK_STR: TDashboardMockProps = {
  activeSidebarIndex: 4,
  barsLabel: "Stay revenue by channel",
  feedRows: [
    ["🏠", "Airbnb — Unit 3A, 4 nights, $892 gross", "just now"],
    ["🌐", "Booking.com — Unit 1C, checked out", "5m ago"],
    ["📊", "ADR updated — Building A, 78.2%", "12m ago"],
  ],
  kpis: [
    { label: "Active stays", tone: "text-ember", value: "18" },
    { label: "Gross MTD", tone: "text-mint", value: "$42.8K" },
    { label: "Avg ADR", tone: "text-glow", value: "$186" },
  ],
  sidebarItems: SIDEBAR,
  title: "Reservations",
};

export const MOCK_LTR: TDashboardMockProps = {
  activeSidebarIndex: 3,
  barsLabel: "Rent collected — last 8 months",
  feedRows: [
    ["🗝️", "Lease extended — Unit 4B, +12 months", "just now"],
    ["✅", "March rent marked paid — Unit 2A", "1h ago"],
    ["👤", "Secondary tenant added — Unit 7C", "3h ago"],
  ],
  kpis: [
    { label: "Active leases", tone: "text-glow", value: "24" },
    { label: "Paid this month", tone: "text-mint", value: "22/24" },
    { label: "Monthly rent", tone: "text-ember", value: "$38.4K" },
  ],
  sidebarItems: SIDEBAR,
  title: "Leases",
};

export const MOCK_INCOME: TDashboardMockProps = {
  activeSidebarIndex: 4,
  barsLabel: "Income by type — last 8 months",
  feedRows: [
    ["💰", "Amenity income — Pool passes, $340", "just now"],
    ["🏨", "Stay payout — Airbnb, Unit 2A", "8m ago"],
    ["🧹", "Extra cleaning — Unit 5B, $120", "1h ago"],
  ],
  kpis: [
    { label: "Gross income", tone: "text-mint", value: "$52.1K" },
    { label: "Other income", tone: "text-glow", value: "$4.2K" },
    { label: "Tax total", tone: "text-ember", value: "$3.8K" },
  ],
  sidebarItems: SIDEBAR,
  title: "Income",
};

export const MOCK_EXPENSES: TDashboardMockProps = {
  activeSidebarIndex: 5,
  barsLabel: "Expenses by category",
  feedRows: [
    ["🤖", "CSV import — 142 rows categorized", "just now"],
    ["🔧", "Maintenance — Unit 3A, $280", "20m ago"],
    ["⚡", "Electricity — Building B, $1,420", "2h ago"],
  ],
  kpis: [
    { label: "MTD expenses", tone: "text-ember", value: "$18.6K" },
    { label: "Categories used", tone: "text-glow", value: "14" },
    { label: "Imported rows", tone: "text-mint", value: "142" },
  ],
  sidebarItems: SIDEBAR,
  title: "Expenses",
};

export const MOCK_REPORTS: TDashboardMockProps = {
  activeSidebarIndex: 6,
  barsLabel: "Revenue vs expenses trend",
  feedRows: [
    ["📊", "Report exported — Q1 portfolio CSV", "just now"],
    ["📈", "Occupancy — Building A, 82.4%", "15m ago"],
    ["💳", "Commission summary — Airbnb MTD", "1h ago"],
  ],
  kpis: [
    { label: "Gross income", tone: "text-mint", value: "$284K" },
    { label: "Total expenses", tone: "text-ember", value: "$86K" },
    { label: "Operational net", tone: "text-glow", value: "$198K" },
  ],
  sidebarItems: SIDEBAR,
  title: "Reports",
};
