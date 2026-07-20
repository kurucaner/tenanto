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

  test("includes unitId and from query params", () => {
    expect(buildPropertyStartLeasePath("prop-1", { from: "units", unitId: "unit-9" })).toBe(
      "/properties/prop-1/leases/new?unitId=unit-9&from=units"
    );
  });
});

describe("parseStartLeaseSearchParams", () => {
  test("defaults from to leases when missing or invalid", () => {
    expect(parseStartLeaseSearchParams(new URLSearchParams())).toEqual({
      from: "leases",
      unitId: "",
    });
    expect(parseStartLeaseSearchParams(new URLSearchParams("from=other"))).toEqual({
      from: "leases",
      unitId: "",
    });
  });

  test("parses unitId and from=units", () => {
    expect(parseStartLeaseSearchParams(new URLSearchParams("unitId=u1&from=units"))).toEqual({
      from: "units",
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
