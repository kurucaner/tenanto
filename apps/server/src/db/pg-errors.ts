export interface IPostgresErrorMeta {
  code: string | null;
  constraint: string | null;
  table: string | null;
}

function readPostgresField(error: object, key: string): string | null {
  if (!(key in error)) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export function getPostgresErrorMeta(error: unknown): IPostgresErrorMeta | null {
  if (typeof error !== "object" || error === null) return null;
  const code = readPostgresField(error, "code");
  if (code === null) return null;
  return {
    code,
    constraint: readPostgresField(error, "constraint"),
    table: readPostgresField(error, "table"),
  };
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  return getPostgresErrorMeta(error)?.code === "23505";
}

export function isPostgresForeignKeyViolation(error: unknown): boolean {
  return getPostgresErrorMeta(error)?.code === "23503";
}
