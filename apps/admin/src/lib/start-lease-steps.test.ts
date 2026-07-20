import { describe, expect, test } from "bun:test";

import {
  canNavigateToStartLeaseStep,
  getNextStartLeaseStep,
  getPreviousStartLeaseStep,
  parseStartLeaseStep,
} from "./start-lease-steps";

describe("parseStartLeaseStep", () => {
  test("defaults to who for missing or invalid values", () => {
    expect(parseStartLeaseStep(null)).toBe("who");
    expect(parseStartLeaseStep("")).toBe("who");
    expect(parseStartLeaseStep("nope")).toBe("who");
  });

  test("accepts known steps", () => {
    expect(parseStartLeaseStep("who")).toBe("who");
    expect(parseStartLeaseStep("term")).toBe("term");
    expect(parseStartLeaseStep("rent")).toBe("rent");
  });
});

describe("step navigation helpers", () => {
  test("getNextStartLeaseStep", () => {
    expect(getNextStartLeaseStep("who")).toBe("term");
    expect(getNextStartLeaseStep("term")).toBe("rent");
    expect(getNextStartLeaseStep("rent")).toBeNull();
  });

  test("getPreviousStartLeaseStep", () => {
    expect(getPreviousStartLeaseStep("who")).toBeNull();
    expect(getPreviousStartLeaseStep("term")).toBe("who");
    expect(getPreviousStartLeaseStep("rent")).toBe("term");
  });

  test("canNavigateToStartLeaseStep allows current and earlier only", () => {
    expect(canNavigateToStartLeaseStep("who", "rent")).toBe(true);
    expect(canNavigateToStartLeaseStep("term", "term")).toBe(true);
    expect(canNavigateToStartLeaseStep("rent", "who")).toBe(false);
  });
});
