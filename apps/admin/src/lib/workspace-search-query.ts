import { type IPropertyShellTab } from "@/config/property-shell-tabs";
import {
  getPropertyShellTabSearchTerms,
  getSearchablePropertyShellTabs,
  type IPropertyLauncherDestination,
} from "@/lib/property-launcher-destinations";

export type TWorkspaceSearchQueryMode = "idle" | "propertyAndTab" | "propertyOnly" | "tabOnly";

export interface IWorkspaceSearchQuery {
  matchedTabs: IPropertyShellTab[];
  mode: TWorkspaceSearchQueryMode;
  propertyQuery: string;
}

const PROPERTIES_SEARCH_PREFIX = "properties:";

function normalizeWorkspaceSearchToken(token: string): string {
  return token.trim().toLowerCase();
}

export function tokenizeWorkspaceSearchQuery(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .map(normalizeWorkspaceSearchToken)
    .filter((token) => token !== "");
}

function tabSearchTermsMatchToken(
  destination: Pick<IPropertyLauncherDestination, "label" | "path" | "searchTerms">,
  token: string
): boolean {
  return getPropertyShellTabSearchTerms(destination).some((term) => {
    return term.startsWith(token) || token.startsWith(term);
  });
}

export function matchPropertyShellTabs(token: string): IPropertyShellTab[] {
  const normalizedToken = normalizeWorkspaceSearchToken(token);

  if (normalizedToken === "") {
    return [];
  }

  return getSearchablePropertyShellTabs()
    .filter((destination) => tabSearchTermsMatchToken(destination, normalizedToken))
    .map(({ end, label, path }) => ({ end, label, path }));
}

function dedupeMatchedTabs(tabs: IPropertyShellTab[]): IPropertyShellTab[] {
  const seenPaths = new Set<string>();

  return tabs.filter((tab) => {
    if (seenPaths.has(tab.path)) {
      return false;
    }

    seenPaths.add(tab.path);
    return true;
  });
}

function resolveWorkspaceSearchMode(
  matchedTabs: IPropertyShellTab[],
  propertyQuery: string
): TWorkspaceSearchQueryMode {
  if (matchedTabs.length === 0 && propertyQuery === "") {
    return "idle";
  }

  if (matchedTabs.length > 0 && propertyQuery === "") {
    return "tabOnly";
  }

  if (matchedTabs.length === 0 && propertyQuery !== "") {
    return "propertyOnly";
  }

  return "propertyAndTab";
}

export function parseWorkspaceSearchQuery(raw: string): IWorkspaceSearchQuery {
  const trimmedRaw = raw.trim();

  if (trimmedRaw === "") {
    return {
      matchedTabs: [],
      mode: "idle",
      propertyQuery: "",
    };
  }

  if (trimmedRaw.toLowerCase().startsWith(PROPERTIES_SEARCH_PREFIX)) {
    const propertyQuery = trimmedRaw.slice(PROPERTIES_SEARCH_PREFIX.length).trim();

    return {
      matchedTabs: [],
      mode: propertyQuery === "" ? "idle" : "propertyOnly",
      propertyQuery,
    };
  }

  const tokens = tokenizeWorkspaceSearchQuery(trimmedRaw);
  const matchedTabs: IPropertyShellTab[] = [];
  const propertyTokens: string[] = [];

  for (const token of tokens) {
    const tabsForToken = matchPropertyShellTabs(token);

    if (tabsForToken.length > 0) {
      matchedTabs.push(...tabsForToken);
      continue;
    }

    propertyTokens.push(token);
  }

  const uniqueMatchedTabs = dedupeMatchedTabs(matchedTabs);
  const propertyQuery = propertyTokens.join(" ");

  return {
    matchedTabs: uniqueMatchedTabs,
    mode: resolveWorkspaceSearchMode(uniqueMatchedTabs, propertyQuery),
    propertyQuery,
  };
}
