// Accepts empty, whole numbers, and decimals with up to 2 places (e.g. "", "12", "12.", "12.5", "98.50").
// Linear regex — avoids the S8786 backtracking lint.
export function isValidDecimalInput(value: string): boolean {
  return value === "" || /^\d*(\.\d{0,2})?$/.test(value);
}
