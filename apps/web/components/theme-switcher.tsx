"use client";

import { type LucideIcon, Moon, Sun, SunMoon } from "lucide-react";
import { memo, useCallback, useEffect, useSyncExternalStore } from "react";

import {
  applyTheme,
  readStoredTheme,
  subscribeStoredTheme,
  subscribeSystemTheme,
  type ThemeChoice,
} from "@/lib/theme-preference";

const OPTIONS: readonly { value: ThemeChoice; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "Match system theme", Icon: SunMoon },
] as const;

function getServerStoredTheme(): ThemeChoice {
  return "system";
}

export const ThemeSwitcher = memo(function ThemeSwitcher() {
  const mode = useSyncExternalStore(subscribeStoredTheme, readStoredTheme, getServerStoredTheme);

  useEffect(() => {
    if (mode !== "system") return;
    return subscribeSystemTheme(() => {
      applyTheme("system", false);
    });
  }, [mode]);

  const select = useCallback(
    (next: ThemeChoice) => {
      if (mode === next) return;
      applyTheme(next);
    },
    [mode],
  );

  return (
    <fieldset
      className="m-0 flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--navbar-border)] bg-[var(--surface)]/80 p-0.5 backdrop-blur-sm"
      suppressHydrationWarning
    >
      <legend className="sr-only">Color theme</legend>
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => {
              select(value);
            }}
            className={`flex size-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navbar-bg)] md:size-9 ${
              selected
                ? "bg-[var(--gold)]/15 text-[var(--gold)]"
                : "text-[var(--navbar-link)] hover:bg-[var(--surface-elevated)] hover:text-[var(--navbar-link-hover)]"
            }`}
          >
            <Icon className="size-[1.15rem] md:size-5" aria-hidden />
          </button>
        );
      })}
    </fieldset>
  );
});
ThemeSwitcher.displayName = "ThemeSwitcher";
