export function getAuthApiErrorCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error) {
    const code = (error as Error & { code?: string }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function getAuthApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
