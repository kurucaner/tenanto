/** True when env var is one of: 1, true, yes, on (case-insensitive). Unset → false. */
export function isEnvFlagEnabled(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
