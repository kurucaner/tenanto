import { mockAsyncFn, type TAsyncMock } from "./async-mocks";

export type TPoolQueryResult<TRow = Record<string, unknown>> = {
  rows: TRow[];
};

export type TPoolQueryFn<TRow = Record<string, unknown>> = (
  sql: string,
  values?: unknown[]
) => Promise<TPoolQueryResult<TRow>>;

/** Typed `pool.query` mock for db module tests. */
export function mockPoolQuery<TRow = Record<string, unknown>>(
  impl?: TPoolQueryFn<TRow>
): TAsyncMock<[string, unknown[]?], TPoolQueryResult<TRow>> {
  return mockAsyncFn(
    impl ?? ((_sql: string, _values?: unknown[]) => Promise.resolve({ rows: [] }))
  );
}
