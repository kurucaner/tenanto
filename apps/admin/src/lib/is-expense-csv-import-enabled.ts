import { isLocalEnvironment } from "@/lib/document-title";

export function isExpenseCsvImportEnabled(): boolean {
  return isLocalEnvironment();
}
