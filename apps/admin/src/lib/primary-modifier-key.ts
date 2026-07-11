type TModifierKeyEvent = {
  ctrlKey: boolean;
  metaKey: boolean;
};

export function isPrimaryModifierHeld(event: TModifierKeyEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

export function getPrimaryModifierKeyLabel(): string {
  if (typeof navigator === "undefined") {
    return "Ctrl";
  }

  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘" : "Ctrl";
}
