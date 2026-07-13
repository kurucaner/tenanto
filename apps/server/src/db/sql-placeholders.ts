export function offsetSqlPlaceholders(sql: string, offset: number): string {
  if (offset === 0) return sql;
  return sql.replace(/\$(\d+)/g, (_, index) => `$${Number(index) + offset}`);
}
