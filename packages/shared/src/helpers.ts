export const toIso = (val: unknown): string | null =>
  val == null ? null : (val as Date).toISOString();

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
