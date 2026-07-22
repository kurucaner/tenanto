export interface IPropertyShellTab {
  end?: boolean;
  label: string;
  path: string;
}

export const PROPERTY_SHELL_TABS: IPropertyShellTab[] = [
  { end: true, label: "Overview", path: "" },
  { label: "Units", path: "units" },
  { label: "Leases", path: "leases" },
  { label: "Income", path: "income" },
  { label: "Expenses", path: "expenses" },
  { label: "Exports", path: "exports" },
  { label: "Announcements", path: "communications" },
  { label: "Reports", path: "reports" },
  { label: "Settings", path: "settings" },
];
