import { describe, expect, test } from "bun:test";

import {
  buildPropertyStartLeasePath,
  getStartLeaseBackPath,
  parseStartLeaseSearchParams,
} from "./start-lease-routes";

describe("buildPropertyStartLeasePath", () => {
  test("builds base path without query", () => {
    expect(buildPropertyStartLeasePath("prop-1")).toBe("/properties/prop-1/leases/new");
  });

  test("includes unitId, from, and non-default step", () => {
    expect(
      buildPropertyStartLeasePath("prop-1", { from: "units", step: "term", unitId: "unit-9" })
    ).toBe("/properties/prop-1/leases/new?unitId=unit-9&from=units&step=term");
  });

  test("omits default who step from query", () => {
    expect(buildPropertyStartLeasePath("prop-1", { from: "leases", step: "who" })).toBe(
      "/properties/prop-1/leases/new?from=leases"
    );
  });
});

describe("parseStartLeaseSearchParams", () => {
  test("defaults from and step when missing or invalid", () => {
    expect(parseStartLeaseSearchParams(new URLSearchParams())).toEqual({
      from: "leases",
      step: "who",
      unitId: "",
    });
    expect(parseStartLeaseSearchParams(new URLSearchParams("from=other&step=nope"))).toEqual({
      from: "leases",
      step: "who",
      unitId: "",
    });
  });

  test("parses unitId, from=units, and step", () => {
    expect(
      parseStartLeaseSearchParams(new URLSearchParams("unitId=u1&from=units&step=rent"))
    ).toEqual({
      from: "units",
      step: "rent",
      unitId: "u1",
    });
  });
});

describe("getStartLeaseBackPath", () => {
  test("returns leases or units back targets", () => {
    expect(getStartLeaseBackPath("prop-1", "leases")).toEqual({
      label: "Back to leases",
      path: "/properties/prop-1/leases",
    });
    expect(getStartLeaseBackPath("prop-1", "units")).toEqual({
      label: "Back to units",
      path: "/properties/prop-1/units",
    });
  });
});
