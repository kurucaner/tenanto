import { afterEach, describe, expect, test } from "bun:test";

import {
  buildStartLeaseDraftStorageKey,
  clearAllStartLeaseDrafts,
  clearStartLeaseDraft,
  getStartLeaseDraftUnitScope,
  readStartLeaseDraft,
  START_LEASE_DRAFT_KEY_PREFIX,
  START_LEASE_DRAFT_TTL_MS,
  writeStartLeaseDraft,
} from "./start-lease-draft-storage";
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

describe("getStartLeaseDraftUnitScope", () => {
  test("uses locked unit id or any", () => {
    expect(getStartLeaseDraftUnitScope("unit-1")).toBe("unit-1");
    expect(getStartLeaseDraftUnitScope("")).toBe("any");
    expect(getStartLeaseDraftUnitScope()).toBe("any");
  });
});

describe("start lease draft storage", () => {
  test("writes and reads a draft", () => {
    const values = getStartLeaseDefaultValues("unit-1");
    values.guestName = "Ada";
    writeStartLeaseDraft("prop-1", "unit-1", { step: "term", values });

    const draft = readStartLeaseDraft("prop-1", "unit-1", { lockedUnitId: "unit-1" });
    expect(draft?.step).toBe("term");
    expect(draft?.values.guestName).toBe("Ada");
    expect(draft?.values.unitId).toBe("unit-1");
  });

  test("URL locked unit wins over draft unitId", () => {
    const values = getStartLeaseDefaultValues("old-unit");
    writeStartLeaseDraft("prop-1", "locked-unit", {
      step: "who",
      values: { ...values, unitId: "old-unit" },
    });

    const draft = readStartLeaseDraft("prop-1", "locked-unit", {
      lockedUnitId: "locked-unit",
    });
    expect(draft?.values.unitId).toBe("locked-unit");
  });

  test("drops expired drafts", () => {
    const values = getStartLeaseDefaultValues();
    writeStartLeaseDraft("prop-1", "any", {
      step: "rent",
      updatedAt: Date.now() - START_LEASE_DRAFT_TTL_MS - 1,
      values,
    });

    expect(readStartLeaseDraft("prop-1", "any", { now: Date.now() })).toBeNull();
    expect(sessionStorage.getItem(buildStartLeaseDraftStorageKey("prop-1", "any"))).toBeNull();
  });

  test("clearStartLeaseDraft removes one key", () => {
    writeStartLeaseDraft("prop-1", "any", {
      step: "who",
      values: getStartLeaseDefaultValues(),
    });
    clearStartLeaseDraft("prop-1", "any");
    expect(readStartLeaseDraft("prop-1", "any")).toBeNull();
  });

  test("clearAllStartLeaseDrafts removes all draft keys", () => {
    writeStartLeaseDraft("prop-1", "any", {
      step: "who",
      values: getStartLeaseDefaultValues(),
    });
    writeStartLeaseDraft("prop-2", "u1", {
      step: "term",
      values: getStartLeaseDefaultValues("u1"),
    });
    sessionStorage.setItem("unrelated", "keep");

    clearAllStartLeaseDrafts();

    expect(sessionStorage.getItem("unrelated")).toBe("keep");
    expect(
      [...memory.keys()].some((key) => key.startsWith(START_LEASE_DRAFT_KEY_PREFIX))
    ).toBe(false);
  });
});
