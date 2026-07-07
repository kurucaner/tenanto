/** Tab row content height (icon + label + padding). Excludes safe-area inset. */
export const MOBILE_BOTTOM_NAV_HEIGHT = "4rem";

/** Locks the admin shell to one viewport on mobile so the in-flow bottom nav stays visible. */
export const MOBILE_ADMIN_SHELL_HEIGHT_CLASS = "max-md:h-svh max-md:min-h-0";

/** Applied to SidebarProvider to prevent page-level scroll on mobile. */
export const MOBILE_ADMIN_SHELL_OVERFLOW_CLASS = "max-md:overflow-hidden";

/** Support full-bleed mobile height deduction (header + page padding + nav area). */
export const MOBILE_BOTTOM_NAV_SUPPORT_BLEED_HEIGHT_CLASS =
  "h-[calc(100dvh-3.5rem-1.5rem-4rem-env(safe-area-inset-bottom))]";
