export function resolveDebouncedUrlInputValue(
  draftValue: string | null,
  committedValue: string
): string {
  return draftValue ?? committedValue;
}

export function getDebouncedUrlCommitValue(draftValue: string): string {
  return draftValue;
}

export function shouldCommitDebouncedUrlValue(draftValue: string, committedValue: string): boolean {
  return draftValue !== committedValue;
}
