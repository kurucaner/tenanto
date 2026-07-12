/**
 * Opaque keyset cursor (v1): ISO `createdAt` + UUID `id`, base64url-encoded JSON.
 * Not signed or encrypted; do not embed secrets. For tamper-evident cursors, use a dedicated signed format.
 */
export type KeysetCursorV1 = {
  createdAt: string;
  id: string;
};

export function decodeKeysetCursor(raw: string): KeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new TypeError("invalid shape");
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeKeysetCursor(createdAt: Date | string, id: string): string {
  const iso = typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  return Buffer.from(JSON.stringify({ createdAt: iso, id }), "utf8").toString("base64url");
}

/**
 * Expense list keyset cursor (v1): expenseDate (YYYY-MM-DD or null) + createdAt + id.
 * Matches ORDER BY expense_date DESC NULLS LAST, created_at DESC, id DESC.
 */
export type ExpenseKeysetCursorV1 = {
  createdAt: string;
  expenseDate: string | null;
  id: string;
};

export function decodeExpenseKeysetCursor(raw: string): ExpenseKeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      createdAt?: unknown;
      expenseDate?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new TypeError("invalid shape");
    }
    if (parsed.expenseDate !== null && typeof parsed.expenseDate !== "string") {
      throw new TypeError("invalid expenseDate");
    }
    return {
      createdAt: parsed.createdAt,
      expenseDate: parsed.expenseDate ?? null,
      id: parsed.id,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeExpenseKeysetCursor(
  expenseDate: string | null,
  createdAt: Date | string,
  id: string
): string {
  const iso = typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  return Buffer.from(JSON.stringify({ createdAt: iso, expenseDate, id }), "utf8").toString(
    "base64url"
  );
}

/**
 * Lease list keyset cursor (v1): leaseStartDate (YYYY-MM-DD) + createdAt + id.
 * Matches ORDER BY lease_start_date DESC, created_at DESC, id DESC.
 */
export type LeaseKeysetCursorV1 = {
  createdAt: string;
  id: string;
  leaseStartDate: string;
};

export function decodeLeaseKeysetCursor(raw: string): LeaseKeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      createdAt?: unknown;
      id?: unknown;
      leaseStartDate?: unknown;
    };
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      typeof parsed.leaseStartDate !== "string"
    ) {
      throw new TypeError("invalid shape");
    }
    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
      leaseStartDate: parsed.leaseStartDate,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeLeaseKeysetCursor(
  leaseStartDate: string,
  createdAt: Date | string,
  id: string
): string {
  const iso = typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  return Buffer.from(JSON.stringify({ createdAt: iso, id, leaseStartDate }), "utf8").toString(
    "base64url"
  );
}

/**
 * Unit list keyset cursor (v1): rentalType + unitNumber + id.
 * Matches ORDER BY rental_type ASC, unit_number ASC, id ASC.
 */
export type UnitKeysetCursorV1 = {
  id: string;
  rentalType: string;
  unitNumber: string;
};

export function decodeUnitKeysetCursor(raw: string): UnitKeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      id?: unknown;
      rentalType?: unknown;
      unitNumber?: unknown;
    };
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.rentalType !== "string" ||
      typeof parsed.unitNumber !== "string"
    ) {
      throw new TypeError("invalid shape");
    }
    return {
      id: parsed.id,
      rentalType: parsed.rentalType,
      unitNumber: parsed.unitNumber,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeUnitKeysetCursor(
  rentalType: string,
  unitNumber: string,
  id: string
): string {
  return Buffer.from(JSON.stringify({ id, rentalType, unitNumber }), "utf8").toString("base64url");
}
