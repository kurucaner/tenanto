import { mock, type Mock } from "bun:test";

export type TAsyncMock<TArgs extends unknown[] = [], TResult = unknown> = Mock<
  (...args: TArgs) => Promise<TResult>
>;

/** Async mock with a fixed default return value. */
export function mockResolved<T>(value: T): TAsyncMock<[], T> {
  return mock(() => Promise.resolve(value)) as TAsyncMock<[], T>;
}

/** Typed async mock defaulting to null (for findById-style methods). */
export function mockResolvedNull<T>(): TAsyncMock<[], T | null> {
  return mock(() => Promise.resolve(null)) as TAsyncMock<[], T | null>;
}

/** Async mock defaulting to an empty array. */
export function mockResolvedEmpty<T>(): TAsyncMock<[], T[]> {
  return mock(() => Promise.resolve([])) as TAsyncMock<[], T[]>;
}

/** Fire-and-forget async mock (notify, send, etc.). */
export function mockResolvedVoid(): TAsyncMock<[], void> {
  return mock(() => Promise.resolve()) as TAsyncMock<[], void>;
}

/** Async mock with a custom implementation. */
export function mockAsyncFn<TArgs extends unknown[], TResult>(
  impl: (...args: TArgs) => Promise<TResult> | TResult
): TAsyncMock<TArgs, TResult> {
  return mock(impl) as TAsyncMock<TArgs, TResult>;
}

/** Sync mock that returns undefined (loggers, no-op handlers). */
export function mockSyncVoid(): Mock<() => undefined> {
  return mock(() => undefined);
}

/** Reset a list of bun mocks (typical beforeEach helper). */
export function resetMocks(...mocks: Array<{ mockReset: () => void }>) {
  for (const mockFn of mocks) {
    mockFn.mockReset();
  }
}

/** Clear call history without removing implementations. */
export function clearMocks(...mocks: Array<{ mockClear: () => void }>) {
  for (const mockFn of mocks) {
    mockFn.mockClear();
  }
}
