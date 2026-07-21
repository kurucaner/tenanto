import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearRecentProperties,
  type IRecentProperty,
  parseRecentProperties,
  readRecentProperties,
  RECENT_PROPERTIES_MAX,
  RECENT_PROPERTIES_STORAGE_KEY,
  recordRecentProperty,
  removeRecentProperty,
  writeRecentProperties,
} from "./recent-properties-storage";

const storage = new Map<string, string>();

function property(id: string, name: string): Pick<IRecentProperty, "address" | "id" | "name"> {
  return { address: `${name} address`, id, name };
}

beforeEach(() => {
  storage.clear();
  const localStorageMock = {
    clear: () => {
      storage.clear();
    },
    getItem: (key: string) => storage.get(key) ?? null,
    key: () => null,
    length: 0,
    removeItem: (key: string) => {
      storage.delete(key);
    },
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  globalThis.localStorage = localStorageMock;
  globalThis.window = { localStorage: localStorageMock } as unknown as Window & typeof globalThis;
});

afterEach(() => {
  storage.clear();
});

describe("parseRecentProperties", () => {
  test("returns empty array for invalid json", () => {
    expect(parseRecentProperties("{")).toEqual([]);
  });

  test("returns empty array for non-array json", () => {
    expect(parseRecentProperties('{"id":"1"}')).toEqual([]);
  });

  test("accepts legacy entries without lastPath", () => {
    expect(
      parseRecentProperties(
        JSON.stringify([
          {
            address: "123 Main",
            id: "1",
            name: "One",
            visitedAt: "2026-01-01T00:00:00.000Z",
          },
        ])
      )
    ).toEqual([
      {
        address: "123 Main",
        id: "1",
        name: "One",
        visitedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  test("rejects entries with invalid lastPath", () => {
    expect(
      parseRecentProperties(
        JSON.stringify([
          {
            address: "123 Main",
            id: "1",
            lastPath: 42,
            name: "One",
            visitedAt: "2026-01-01T00:00:00.000Z",
          },
        ])
      )
    ).toEqual([]);
  });
});

describe("recordRecentProperty", () => {
  test("prepends a new visit", () => {
    recordRecentProperty(property("a", "Alpha"));
    recordRecentProperty(property("b", "Beta"));

    expect(readRecentProperties().map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  test("moves an existing id to the front", () => {
    recordRecentProperty(property("a", "Alpha"));
    recordRecentProperty(property("b", "Beta"));
    recordRecentProperty(property("a", "Alpha Updated"));

    const recent = readRecentProperties();
    expect(recent.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(recent[0]?.name).toBe("Alpha Updated");
  });

  test("caps at five entries", () => {
    for (let index = 1; index <= RECENT_PROPERTIES_MAX + 1; index += 1) {
      recordRecentProperty(property(String(index), `Property ${index}`));
    }

    const recent = readRecentProperties();
    expect(recent).toHaveLength(RECENT_PROPERTIES_MAX);
    expect(recent.map((entry) => entry.id)).toEqual(["6", "5", "4", "3", "2"]);
  });

  test("persists lastPath round-trip", () => {
    recordRecentProperty({
      ...property("a", "Alpha"),
      lastPath: "/leases",
    });

    expect(readRecentProperties()[0]?.lastPath).toBe("/leases");
    expect(storage.get(RECENT_PROPERTIES_STORAGE_KEY)).toContain('"/leases"');
  });

  test("updates lastPath when revisiting the same property", () => {
    recordRecentProperty({
      ...property("a", "Alpha"),
      lastPath: "/leases",
    });
    recordRecentProperty({
      ...property("a", "Alpha"),
      lastPath: "/income",
    });

    expect(readRecentProperties()[0]?.lastPath).toBe("/income");
  });

  test("stores empty string lastPath for overview", () => {
    recordRecentProperty({
      ...property("a", "Alpha"),
      lastPath: "",
    });

    expect(readRecentProperties()[0]?.lastPath).toBe("");
  });
});

describe("removeRecentProperty", () => {
  test("removes a single entry", () => {
    recordRecentProperty(property("a", "Alpha"));
    recordRecentProperty(property("b", "Beta"));

    removeRecentProperty("a");

    expect(readRecentProperties().map((entry) => entry.id)).toEqual(["b"]);
  });

  test("no-ops when id is missing", () => {
    recordRecentProperty(property("a", "Alpha"));

    removeRecentProperty("missing");

    expect(readRecentProperties()).toHaveLength(1);
  });
});

describe("clearRecentProperties", () => {
  test("removes all entries", () => {
    recordRecentProperty(property("a", "Alpha"));
    recordRecentProperty(property("b", "Beta"));

    clearRecentProperties();

    expect(readRecentProperties()).toEqual([]);
    expect(storage.has(RECENT_PROPERTIES_STORAGE_KEY)).toBe(false);
  });

  test("no-ops when already empty", () => {
    clearRecentProperties();

    expect(readRecentProperties()).toEqual([]);
  });
});

describe("readRecentProperties", () => {
  test("reads persisted entries", () => {
    writeRecentProperties([
      {
        address: "123 Main",
        id: "1",
        name: "One",
        visitedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(readRecentProperties()).toHaveLength(1);
    expect(storage.get(RECENT_PROPERTIES_STORAGE_KEY)).toContain('"One"');
  });

  test("returns a stable snapshot reference when storage is unchanged", () => {
    recordRecentProperty(property("a", "Alpha"));

    expect(readRecentProperties()).toBe(readRecentProperties());
  });
});

describe("clearRecentProperties", () => {
  test("removes persisted entries", () => {
    recordRecentProperty(property("a", "Alpha"));

    clearRecentProperties();

    expect(readRecentProperties()).toEqual([]);
    expect(storage.has(RECENT_PROPERTIES_STORAGE_KEY)).toBe(false);
  });
});
