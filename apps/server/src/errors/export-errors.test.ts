import { describe, expect, test } from "bun:test";

import { HttpStatus, PROPERTY_EXPORT_EMPTY_MESSAGE } from "@/packages/shared";

import {
  ExportErrorCode,
  exportJobPermanentError,
  propertyExportDuplicateError,
  propertyExportEmptyError,
} from "./export-errors";

describe("export domain errors", () => {
  test("propertyExportDuplicateError includes jobId in body", () => {
    const error = propertyExportDuplicateError("job-1");

    expect(error.code).toBe(ExportErrorCode.DUPLICATE);
    expect(error.httpStatus).toBe(HttpStatus.CONFLICT);
    expect(error.body).toEqual({ jobId: "job-1" });
  });

  test("propertyExportEmptyError uses shared empty message", () => {
    const error = propertyExportEmptyError();

    expect(error.code).toBe(ExportErrorCode.EMPTY);
    expect(error.message).toBe(PROPERTY_EXPORT_EMPTY_MESSAGE);
  });

  test("exportJobPermanentError uses 400", () => {
    expect(exportJobPermanentError("failed").httpStatus).toBe(HttpStatus.BAD_REQUEST);
  });
});
