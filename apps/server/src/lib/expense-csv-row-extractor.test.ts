import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { extractExpenseRowsFromCsv } from "./expense-csv-row-extractor";

const chaseFixturePath = join(__dirname, "fixtures", "chase-activity-sample.csv");
const debitCreditFixturePath = join(__dirname, "fixtures", "debit-credit-checking-sample.csv");

describe("extractExpenseRowsFromCsv", () => {
  test("extracts 32 Chase charge rows and skips payments and returns", () => {
    const csvText = readFileSync(chaseFixturePath, "utf8");
    const result = extractExpenseRowsFromCsv(csvText, "chase-activity-sample.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.rows).toHaveLength(32);
    expect(result.rows.every((row) => row.bankType === "Sale")).toBe(true);
    expect(result.rows.some((row) => row.description.includes("Payment Thank You"))).toBe(false);
    expect(result.rows.some((row) => row.description.includes("Return"))).toBe(false);
  });

  test("maps Chase charge fields correctly", () => {
    const csvText = readFileSync(chaseFixturePath, "utf8");
    const result = extractExpenseRowsFromCsv(csvText, "chase-activity-sample.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const awsRow = result.rows.find((row) => row.description.startsWith("Amazon web services"));
    expect(awsRow).toMatchObject({
      amount: 17.74,
      bankCategory: "Bills & Utilities",
      expenseDate: "2026-07-02",
      rowIndex: 3,
    });
  });

  test("parses debit/credit checking CSV with transaction-type filtering", () => {
    const csvText = readFileSync(debitCreditFixturePath, "utf8");
    const result = extractExpenseRowsFromCsv(csvText, "debit-credit-checking-sample.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.rows).toHaveLength(5);
    expect(result.rows.map((row) => row.bankType)).toEqual([
      "DEBIT",
      "CHECK",
      "DIRECTDEBIT",
      "FEE",
      "POS",
    ]);
    expect(result.rows.some((row) => row.bankType === "CREDIT")).toBe(false);
    expect(result.rows.some((row) => row.bankType === "DEP")).toBe(false);
    expect(result.rows.some((row) => row.bankType === "XFER")).toBe(false);
  });

  test("maps debit/credit checking fields correctly", () => {
    const csvText = readFileSync(debitCreditFixturePath, "utf8");
    const result = extractExpenseRowsFromCsv(csvText, "debit-credit-checking-sample.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const adobeRow = result.rows.find((row) => row.description.includes("ADOBE INC"));
    expect(adobeRow).toMatchObject({
      amount: 9.99,
      bankType: "DEBIT",
      expenseDate: "2026-07-08",
      rowIndex: 1,
    });

    const utilityRow = result.rows.find((row) => row.description.includes("FPL DIRECT DEBIT"));
    expect(utilityRow).toMatchObject({
      amount: 110.63,
      bankType: "DIRECTDEBIT",
      expenseDate: "2026-07-07",
      rowIndex: 4,
    });
  });

  test("includes CHECK rows in debit/credit checking CSV", () => {
    const csvText = readFileSync(debitCreditFixturePath, "utf8");
    const result = extractExpenseRowsFromCsv(csvText, "debit-credit-checking-sample.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const checkRow = result.rows.find((row) => row.description.includes("CHECK # 166"));
    expect(checkRow).toMatchObject({
      amount: 1284,
      bankType: "CHECK",
      expenseDate: "2026-07-08",
      rowIndex: 2,
    });
  });

  test("parses generic CSV with standard headers", () => {
    const csvText = [
      "Date,Description,Amount",
      "2026-02-01,Office supplies,-42.50",
      "2026-02-02,Card payment,100.00",
      "2026-02-03,Internet bill,-19.99",
    ].join("\n");

    const result = extractExpenseRowsFromCsv(csvText, "generic.csv");
    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      amount: 42.5,
      description: "Office supplies",
      expenseDate: "2026-02-01",
      rowIndex: 1,
    });
    expect(result.rows[1]).toMatchObject({
      amount: 19.99,
      description: "Internet bill",
      expenseDate: "2026-02-03",
      rowIndex: 3,
    });
  });

  test("returns error for unrecognized CSV format", () => {
    const csvText = ["foo,bar,baz", "1,2,3"].join("\n");
    const result = extractExpenseRowsFromCsv(csvText, "unknown.csv");
    expect(result).toEqual({ error: "Unrecognized CSV format" });
  });
});
