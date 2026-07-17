import { Monitor, Moon, Sun } from "lucide-react";
import { memo, useCallback, useSyncExternalStore } from "react";

import { cn } from "../lib/utils";
import { useAppTheme } from "../theme/app-theme-provider";
import type { ThemeChoice } from "../theme/types";

function getServerThemeChoice(): ThemeChoice {
  return "system";
}

const OPTIONS: readonly { Icon: typeof Sun; label: string; value: ThemeChoice }[] = [
  { Icon: Sun, label: "Light theme", value: "light" },
  { Icon: Moon, label: "Dark theme", value: "dark" },
  { Icon: Monitor, label: "Match system theme", value: "system" },
] as const;

export const ThemeSwitcher = memo(function ThemeSwitcher({
  compact = false,
}: Readonly<{ compact?: boolean }>) {
  const theme = useAppTheme();
  const mode = useSyncExternalStore(
    theme.subscribeStoredTheme,
    theme.readStoredTheme,
    getServerThemeChoice
  );

  const select = useCallback(
    (next: ThemeChoice) => {
      if (mode === next) return;
      theme.applyTheme(next);
    },
    [mode, theme]
  );

  return (
    <fieldset
      className={cn(
        "m-0 flex shrink-0 items-center gap-0.5 rounded-full border border-border/80 bg-muted/50 p-0.5 backdrop-blur-sm",
        compact ? "justify-center" : ""
      )}
    >
      <legend className="sr-only">Color theme</legend>
      {OPTIONS.map(({ Icon, label, value }) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            aria-label={label}
            aria-pressed={selected}
            className={cn(
              "flex items-center justify-center rounded-full text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              compact ? "size-7" : "size-8 sm:size-9",
              selected
                ? "bg-primary/15 text-primary"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
            onClick={() => {
              select(value);
            }}
            title={label}
            type="button"
          >
            <Icon aria-hidden className={compact ? "size-3.5" : "size-4"} />
          </button>
        );
      })}
    </fieldset>
  );
});
ThemeSwitcher.displayName = "ThemeSwitcher";
