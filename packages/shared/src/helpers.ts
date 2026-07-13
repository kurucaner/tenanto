export const toIso = (val: unknown): string | null => {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return new Date(val).toISOString();
  return null;
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
