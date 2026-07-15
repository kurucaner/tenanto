import { Palette } from "lucide-react";
import { memo, useCallback, useSyncExternalStore } from "react";

import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../lib/utils";
import { useAppTheme } from "../theme/app-theme-provider";
import {
  DARK_PRESET_DEFAULT,
  DARK_PRESET_OPTIONS,
  isDarkPreset,
  type DarkPreset,
} from "../theme/types";

function getServerPreset(): DarkPreset {
  return DARK_PRESET_DEFAULT;
}

export const DarkPaletteMenu = memo(function DarkPaletteMenu({
  compact = false,
}: Readonly<{ compact?: boolean }>) {
  const theme = useAppTheme();
  const preset = useSyncExternalStore(
    theme.subscribeStoredDarkPreset,
    theme.readStoredDarkPreset,
    getServerPreset
  );

  const onPresetChange = useCallback(
    (value: string) => {
      if (!isDarkPreset(value)) return;
      theme.applyDarkPreset(value);
    },
    [theme]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Dark palette"
          className={cn(
            "rounded-full border-border/80 bg-muted/50 backdrop-blur-sm",
            compact ? "size-7 [&_svg]:size-3.5" : "size-8 sm:size-9"
          )}
          size={compact ? "icon-sm" : "icon"}
          title="Dark palette"
          type="button"
          variant="outline"
        >
          <Palette aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Dark palette</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={onPresetChange} value={preset}>
          {DARK_PRESET_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem
              className="items-start gap-2 py-2 pr-8 pl-2"
              key={opt.value}
              value={opt.value}
            >
              <span className="mt-0.5 flex shrink-0 gap-0.5" aria-hidden>
                <span
                  className="size-3.5 rounded-sm border border-border/60"
                  style={{ backgroundColor: opt.swatchA }}
                />
                <span
                  className="size-3.5 rounded-sm border border-border/60"
                  style={{ backgroundColor: opt.swatchB }}
                />
                <span
                  className="size-3.5 rounded-sm border border-border/60"
                  style={{ backgroundColor: opt.swatchC }}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium leading-none">{opt.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{opt.mood}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
DarkPaletteMenu.displayName = "DarkPaletteMenu";
