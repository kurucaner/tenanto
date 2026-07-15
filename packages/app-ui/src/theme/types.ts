export type AppThemeKey = "admin" | "tenant";

export type ThemeChoice = "dark" | "light" | "system";

export type DarkPreset = "ember" | "evergreen" | "inkwell" | "noir" | "obsidian" | "plum";

export const DARK_PRESET_DEFAULT: DarkPreset = "noir";

export const DARK_PRESETS: readonly DarkPreset[] = [
  "noir",
  "obsidian",
  "evergreen",
  "plum",
  "ember",
  "inkwell",
] as const;

export const DARK_PRESET_OPTIONS: readonly {
  label: string;
  mood: string;
  swatchA: string;
  swatchB: string;
  swatchC: string;
  value: DarkPreset;
}[] = [
  {
    label: "Noir",
    mood: "Cool slate + champagne",
    swatchA: "oklch(0.14 0.02 262)",
    swatchB: "oklch(0.22 0.022 262)",
    swatchC: "oklch(0.78 0.09 88)",
    value: "noir",
  },
  {
    label: "Obsidian",
    mood: "Neutral luxury",
    swatchA: "oklch(0.14 0.006 280)",
    swatchB: "oklch(0.2 0.01 280)",
    swatchC: "oklch(0.8 0.04 285)",
    value: "obsidian",
  },
  {
    label: "Evergreen",
    mood: "Forest terminal",
    swatchA: "oklch(0.13 0.03 165)",
    swatchB: "oklch(0.2 0.035 165)",
    swatchC: "oklch(0.72 0.11 150)",
    value: "evergreen",
  },
  {
    label: "Plum",
    mood: "Studio violet",
    swatchA: "oklch(0.14 0.038 305)",
    swatchB: "oklch(0.2 0.04 305)",
    swatchC: "oklch(0.72 0.1 295)",
    value: "plum",
  },
  {
    label: "Ember",
    mood: "Warm charcoal + copper",
    swatchA: "oklch(0.14 0.022 48)",
    swatchB: "oklch(0.21 0.028 48)",
    swatchC: "oklch(0.76 0.11 62)",
    value: "ember",
  },
  {
    label: "Inkwell",
    mood: "Cold cyan night",
    swatchA: "oklch(0.13 0.03 235)",
    swatchB: "oklch(0.2 0.03 235)",
    swatchC: "oklch(0.72 0.12 208)",
    value: "inkwell",
  },
] as const;

export function isDarkPreset(value: string): value is DarkPreset {
  return (DARK_PRESETS as readonly string[]).includes(value);
}
