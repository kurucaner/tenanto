// Accepts empty or whole numbers only (e.g. "", "12").
export function isValidIntegerInput(value: string): boolean {
  return value === "" || /^\d+$/.test(value);
}
