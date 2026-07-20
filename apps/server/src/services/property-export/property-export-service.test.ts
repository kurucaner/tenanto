import { afterEach, describe, expect, mock, test } from "bun:test";

import { ExportFormat, ExportResourceType, PROPERTY_EXPORT_EMPTY_MESSAGE } from "@/packages/shared";
import {
  mockAsyncFn,
  mockResolved,
  mockResolvedNull,
  mockResolvedVoid,
} from "@/test-fixtures/mocks";

const findActiveDuplicateMock = mockResolvedNull();
const createExportJobMock = mockAsyncFn(() =>
  Promise.resolve({
    createdBy: "user-1",
    filters: {},
    format: ExportFormat.CSV,
    id: "job-1",
    propertyId: "property-1",
    resourceType: ExportResourceType.EXPENSES,
    status: "queued",
  })
);
const getExpenseListMetaMock = mockResolved({ totalCount: 0 });
const enqueuePropertyExportJobMock = mockResolvedVoid();

mock.module("@/db/export-jobs", () => ({
  exportJobsDb: {
    create: createExportJobMock,
    findActiveDuplicate: findActiveDuplicateMock,
  },
}));

mock.module("@/db/property-expenses", () => ({
  propertyExpensesDb: {
    getListMetaByProperty: getExpenseListMetaMock,
  },
}));

mock.module("@/db/property-income-entries", () => ({
  propertyIncomeEntriesDb: {
    getListMetaByProperty: mockResolved({ totalCount: 0 }),
  },
}));

mock.module("@/db/property-long-stays", () => ({
  propertyLongStaysDb: {
    getListMetaByProperty: mockResolved({ totalCount: 0 }),
  },
}));

mock.module("@/services/property-export/property-export-reenqueue", () => ({
  enqueuePropertyExportJob: enqueuePropertyExportJobMock,
}));

const { createPropertyExport, PropertyExportEmptyError } =
  await import("./property-export-service");

const expensesExportRequest = {
  filters: { from: "2026-01-01", to: "2026-01-31" },
  format: ExportFormat.CSV,
  resourceType: ExportResourceType.EXPENSES,
} as const;

afterEach(() => {
  findActiveDuplicateMock.mockClear();
  createExportJobMock.mockClear();
  getExpenseListMetaMock.mockClear();
  enqueuePropertyExportJobMock.mockClear();
  findActiveDuplicateMock.mockImplementation(() => Promise.resolve(null));
  getExpenseListMetaMock.mockImplementation(() => Promise.resolve({ totalCount: 0 }));
});

describe("createPropertyExport", () => {
  test("throws PropertyExportEmptyError when filters match zero rows", async () => {
    await expect(
      createPropertyExport("property-1", "user-1", expensesExportRequest)
    ).rejects.toBeInstanceOf(PropertyExportEmptyError);

    await expect(
      createPropertyExport("property-1", "user-1", expensesExportRequest)
    ).rejects.toThrow(PROPERTY_EXPORT_EMPTY_MESSAGE);

    expect(createExportJobMock).not.toHaveBeenCalled();
    expect(enqueuePropertyExportJobMock).not.toHaveBeenCalled();
  });

  test("creates and enqueues a job when filters match rows", async () => {
    getExpenseListMetaMock.mockImplementation(() => Promise.resolve({ totalCount: 12 }));

    const result = await createPropertyExport("property-1", "user-1", expensesExportRequest);

    expect(result).toEqual({ jobId: "job-1" });
    expect(createExportJobMock).toHaveBeenCalledTimes(1);
    expect(enqueuePropertyExportJobMock).toHaveBeenCalledWith("job-1");
  });
});
