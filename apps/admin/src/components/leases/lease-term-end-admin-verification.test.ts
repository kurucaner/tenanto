import { describe, expect, test } from "bun:test";

import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import {
  isCustomLeaseEndDate,
  PropertyLongStayStatus,
  resolveExtendLeaseEndDate,
} from "@/packages/shared";

import {
  getInitialLeaseTermEndValues,
  resolveLeaseTermEndPreview,
} from "./lease-term-end-fields";

describe("admin lease term end previews", () => {
  test("start lease months mode preview ends Jun 30, 2027 for Jul 1 start and 12 months", () => {
    const resolvedEnd = resolveLeaseTermEndPreview({
      leaseEndDate: "",
      leaseStartDate: "2026-07-01",
      termMode: "months",
      termMonths: "12",
    });

    expect(resolvedEnd).toBe("2027-06-30");
    expect(`Lease ends ${formatIsoDateDisplay(resolvedEnd!)}`).toBe("Lease ends 06/30/2027");
  });

  test("extend preview ends Dec 31, 2027 for lease ending Jun 30, 2027 plus 6 months", () => {
    const lease = {
      leaseEndDate: "2027-06-30",
      leaseStartDate: "2026-07-01",
      status: PropertyLongStayStatus.ACTIVE,
      termMonths: 12,
    };

    expect(
      resolveExtendLeaseEndDate(lease, { additionalTermMonths: 6 }).newLeaseEndDate
    ).toBe("2027-12-31");
    expect(formatIsoDateDisplay("2027-12-31")).toBe("12/31/2027");
  });

  test("standard month-based lease does not flag custom end for overview badge", () => {
    expect(isCustomLeaseEndDate("2026-07-01", 12, "2027-06-30")).toBe(false);
  });

  test("legacy anniversary end opens edit form in custom end mode", () => {
    expect(isCustomLeaseEndDate("2026-07-01", 12, "2027-07-01")).toBe(true);
    expect(
      getInitialLeaseTermEndValues({
        leaseEndDate: "2027-07-01",
        leaseStartDate: "2026-07-01",
        termMonths: 12,
      }).termMode
    ).toBe("customEnd");
  });

  test("standard month-based lease opens edit form in months mode", () => {
    expect(
      getInitialLeaseTermEndValues({
        leaseEndDate: "2027-06-30",
        leaseStartDate: "2026-07-01",
        termMonths: 12,
      }).termMode
    ).toBe("months");
  });
});
