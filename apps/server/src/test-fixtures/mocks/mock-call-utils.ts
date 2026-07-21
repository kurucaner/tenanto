type TMockWithCalls = {
  mock: {
    calls: readonly (readonly unknown[])[];
  };
};

/** Read a typed argument from a bun mock's call history. */
export function getMockCallArg<T>(
  mockFn: TMockWithCalls,
  argIndex: number,
  callIndex = 0
): T | undefined {
  return mockFn.mock.calls[callIndex]?.[argIndex] as T | undefined;
}
