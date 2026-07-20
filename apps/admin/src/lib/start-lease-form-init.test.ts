import { afterEach, describe, expect, test } from "bun:test";

import { writeStartLeaseDraft } from "./start-lease-draft-storage";
import { resolveStartLeaseInitialState } from "./start-lease-form-init";
import { getStartLeaseDefaultValues } from "./start-lease-form-schema";

const memory = new Map<string, string>();

const sessionStorageMock = {
  clear: () => memory.clear(),
  getItem: (key: string) => memory.get(key) ?? null,
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
};

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: sessionStorageMock,
});

afterEach(() => {
  memory.clear();
});

describe("resolveStartLeaseInitialState", () => {
  test("returns defaults and url step when no draft", () => {
    const result = resolveStartLeaseInitialState({
      initialStep: "who",
      propertyId: "prop-1",
      stepFromUrl: false,
    });

    expect(result.step).toBe("who");
    expect(result.values.guestName).toBe("");
    expect(result.values.unitId).toBe("");
  });

  test("restores draft values and step when url has no step", () => {
    const values = getStartLeaseDefaultValues();
    values.guestName = "Ada";
    writeStartLeaseDraft("prop-1", "any", { step: "term", values });

    const result = resolveStartLeaseInitialState({
      initialStep: "who",
      propertyId: "prop-1",
      stepFromUrl: false,
    });

    expect(result.step).toBe("term");
    expect(result.values.guestName).toBe("Ada");
  });

  test("url step wins over draft step when stepFromUrl is true", () => {
    const values = getStartLeaseDefaultValues();
    values.guestName = "Ada";
    writeStartLeaseDraft("prop-1", "any", { step: "rent", values });

    const result = resolveStartLeaseInitialState({
      initialStep: "who",
      propertyId: "prop-1",
      stepFromUrl: true,
    });

    expect(result.step).toBe("who");
    expect(result.values.guestName).toBe("Ada");
  });

  test("forces locked unitId from url over draft unitId", () => {
    const values = getStartLeaseDefaultValues("old-unit");
    writeStartLeaseDraft("prop-1", "locked-unit", {
      step: "who",
      values: { ...values, unitId: "old-unit" },
    });

    const result = resolveStartLeaseInitialState({
      initialStep: "who",
      lockedUnitId: "locked-unit",
      propertyId: "prop-1",
      stepFromUrl: false,
    });

    expect(result.values.unitId).toBe("locked-unit");
  });
});
