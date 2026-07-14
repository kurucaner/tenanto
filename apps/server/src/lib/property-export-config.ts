export const PROPERTY_EXPORT_QUEUE_NAME = "property-export-jobs";

export const PROPERTY_EXPORT_JOB_ATTEMPTS = 3;

export const PROPERTY_EXPORT_BATCH_SIZE = 1000;

export const PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS = Number.parseInt(
  process.env.PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS ?? "900000",
  10
);
