/** Tab row content height (icon + label + padding). Excludes safe-area inset. */
export const MOBILE_BOTTOM_NAV_HEIGHT = "4rem";

/** Extra scroll clearance above the fixed nav on mobile pages. */
export const MOBILE_BOTTOM_NAV_SCROLL_BUFFER = "2rem";

export const MOBILE_BOTTOM_NAV_OFFSET = `calc(${MOBILE_BOTTOM_NAV_HEIGHT} + ${MOBILE_BOTTOM_NAV_SCROLL_BUFFER} + env(safe-area-inset-bottom))`;

/** Main content bottom padding on mobile (nav + buffer + safe area). */
export const MOBILE_BOTTOM_NAV_CONTENT_PADDING_CLASS =
  "max-md:pb-[calc(4rem+2rem+env(safe-area-inset-bottom))]";

/** Support full-bleed mobile height deduction (header + page padding + nav area). */
export const MOBILE_BOTTOM_NAV_SUPPORT_BLEED_HEIGHT_CLASS =
  "h-[calc(100dvh-3.5rem-1.5rem-4rem-2rem-env(safe-area-inset-bottom))]";
