import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { ReservationStatus } from "@/packages/shared";

import {
  extractIncomeRowsFromHotelTaxCalculatorCsv,
  isHotelTaxCalculatorCsv,
  parseCsvMoney,
  parseIncomeCsvDate,
} from "./income-hotel-tax-calculator-csv-extractor";

const fixturePath = join(__dirname, "fixtures/hotel-tax-calculator-sample.csv");

describe("isHotelTaxCalculatorCsv", () => {
  test("recognizes the sample file header", () => {
    const headerRow =
      readFileSync(fixturePath, "utf8")
        .split("\n")[0]
        ?.split(",")
        .map((value) => value.trim().toLowerCase()) ?? [];

    expect(isHotelTaxCalculatorCsv(headerRow)).toBe(true);
  });
});

describe("parseIncomeCsvDate", () => {
  test("parses dashed US dates", () => {
    expect(parseIncomeCsvDate("02-07-2026")).toBe("2026-02-07");
  });

  test("parses slashed US dates", () => {
    expect(parseIncomeCsvDate("2/14/2026")).toBe("2026-02-14");
  });

  test("accepts ISO dates", () => {
    expect(parseIncomeCsvDate("2026-02-07")).toBe("2026-02-07");
  });
});

describe("parseCsvMoney", () => {
  test("parses plain and quoted currency values", () => {
    expect(parseCsvMoney("$121.63")).toBe(121.63);
    expect(parseCsvMoney("$1,375.20")).toBe(1375.2);
    expect(parseCsvMoney("$0.00")).toBe(0);
  });
});

describe("extractIncomeRowsFromHotelTaxCalculatorCsv", () => {
  test("extracts importable rows from the sample fixture", () => {
    const csvText = readFileSync(fixturePath, "utf8");
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, "hotel-tax-calculator.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.rows).toHaveLength(6);
  });

  test("maps status counts from the sample fixture", () => {
    const csvText = readFileSync(fixturePath, "utf8");
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, "hotel-tax-calculator.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const stayed = result.rows.filter((row) => row.status === ReservationStatus.STAYED);
    const canceled = result.rows.filter((row) => row.status === ReservationStatus.CANCELED);
    const noShow = result.rows.filter((row) => row.status === ReservationStatus.NO_SHOW);
    const refunded = result.rows.filter((row) => row.refunded);

    expect(stayed).toHaveLength(3);
    expect(canceled).toHaveLength(2);
    expect(noShow).toHaveLength(1);
    expect(refunded).toHaveLength(1);
  });

  test("maps a checked row correctly", () => {
    const csvText = readFileSync(fixturePath, "utf8");
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, "hotel-tax-calculator.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const alexandar = result.rows.find((row) => row.guestName === "Alexandar Kopilovic");
    expect(alexandar).toMatchObject({
      channelName: "Booking",
      checkIn: "2026-02-07",
      checkOut: "2026-02-08",
      cleaningFee: 0,
      guestName: "Alexandar Kopilovic",
      nights: 1,
      refunded: false,
      roomNo: "210",
      roomTotal: 121.63,
      rowIndex: 2,
      sourceFileName: "hotel-tax-calculator.csv",
      status: ReservationStatus.STAYED,
    });
  });

  test("maps refund rows to stayed + refunded", () => {
    const csvText = readFileSync(fixturePath, "utf8");
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, "hotel-tax-calculator.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const monica = result.rows.find((row) => row.guestName === "Monica Marichal");
    expect(monica).toMatchObject({
      channelName: "Expedia EC",
      checkIn: "2026-02-14",
      checkOut: "2026-02-15",
      refunded: true,
      roomTotal: 0,
      status: ReservationStatus.STAYED,
    });
  });

  test("parses mixed date formats on the same row", () => {
    const csvText = readFileSync(fixturePath, "utf8");
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, "hotel-tax-calculator.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const isaac = result.rows.find((row) => row.guestName === "Isaac Suero");
    const jalen = result.rows.find((row) => row.guestName === "Jalen Moye");

    expect(isaac).toMatchObject({
      checkIn: "2026-02-14",
      checkOut: "2026-02-15",
      status: ReservationStatus.CANCELED,
    });
    expect(jalen).toMatchObject({
      checkIn: "2026-02-14",
      checkOut: "2026-02-15",
      status: ReservationStatus.CANCELED,
    });
  });

  test("parses quoted room totals with commas", () => {
    const csvText = readFileSync(fixturePath, "utf8");
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, "hotel-tax-calculator.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    const dorie = result.rows.find((row) => row.guestName === "Dorie Sliverman");
    expect(dorie).toMatchObject({
      cleaningFee: 75,
      roomTotal: 1375.2,
    });
  });

  test("skips Err:522 junk rows at the end of the file", () => {
    const csvText = readFileSync(fixturePath, "utf8");
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv(csvText, "hotel-tax-calculator.csv");

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.rows.some((row) => row.guestName.includes("Err:522"))).toBe(false);
  });

  test("rejects non-Hotel Tax Calculator files", () => {
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv("foo,bar,baz\n1,2,3", "other.csv");

    expect(result).toEqual({
      error: "This file does not match the Hotel Tax Calculator CSV format.",
    });
  });

  test("rejects empty files", () => {
    const result = extractIncomeRowsFromHotelTaxCalculatorCsv("", "empty.csv");
    expect(result).toEqual({ error: "The file is empty." });
  });
});
