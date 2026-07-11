type TModifierKeyEvent = {
  shiftKey: boolean;
};

export function isPrimaryModifierHeld(event: TModifierKeyEvent): boolean {
  return event.shiftKey;
}

export function getPrimaryModifierKeyLabel(): string {
  return "Shift";
}
