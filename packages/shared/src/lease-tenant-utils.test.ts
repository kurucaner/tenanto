import { describe, expect, test } from "bun:test";

import { getLeaseOccupancyNames } from "./lease-tenant-utils";
import type { IPropertyLongStay } from "./property-long-stay-types";

function makeLease(
  overrides: Partial<
    Pick<IPropertyLongStay, "guestName" | "secondaryOccupantNames" | "secondaryTenants">
  > = {}
): Pick<IPropertyLongStay, "guestName" | "secondaryOccupantNames" | "secondaryTenants"> {
  return {
    guestName: "John Doe",
    secondaryTenants: [],
    ...overrides,
  };
}

describe("getLeaseOccupancyNames", () => {
  test("returns primary tenant only when no secondaries", () => {
    expect(getLeaseOccupancyNames(makeLease())).toEqual(["John Doe"]);
  });

  test("returns primary followed by secondary names", () => {
    expect(
      getLeaseOccupancyNames(
        makeLease({
          secondaryTenants: [
            { email: null, name: "Jane Doe", phone: null },
            { email: "a@b.com", name: "Alex Kim", phone: null },
          ],
        })
      )
    ).toEqual(["John Doe", "Jane Doe", "Alex Kim"]);
  });

  test("prefers secondaryOccupantNames over legacy secondaryTenants", () => {
    expect(
      getLeaseOccupancyNames(
        makeLease({
          secondaryOccupantNames: ["Membership Secondary"],
          secondaryTenants: [{ email: null, name: "Legacy Secondary", phone: null }],
        })
      )
    ).toEqual(["John Doe", "Membership Secondary"]);
  });
});
