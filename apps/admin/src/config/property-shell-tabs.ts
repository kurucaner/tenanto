export interface IPropertyShellTab {
  end?: boolean;
  label: string;
  path: string;
}

export const PROPERTY_SHELL_TABS: IPropertyShellTab[] = [
  { end: true, label: "Overview", path: "" },
  { label: "Units", path: "units" },
  { label: "Income", path: "income" },
  { label: "Expenses", path: "expenses" },
  { label: "Reports", path: "reports" },
  { label: "Settings", path: "settings" },
];
