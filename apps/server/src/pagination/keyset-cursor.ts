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

export function encodeUnitKeysetCursor(rentalType: string, unitNumber: string, id: string): string {
  return Buffer.from(JSON.stringify({ id, rentalType, unitNumber }), "utf8").toString("base64url");
}

/**
 * Short-stay list keyset cursor (v1): checkIn (YYYY-MM-DD) + createdAt + id.
 * Matches ORDER BY check_in DESC, created_at DESC, id DESC.
 */
export type ReservationKeysetCursorV1 = {
  checkIn: string;
  createdAt: string;
  id: string;
};

export function decodeReservationKeysetCursor(raw: string): ReservationKeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      checkIn?: unknown;
      createdAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.checkIn !== "string" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new TypeError("invalid shape");
    }
    return {
      checkIn: parsed.checkIn,
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeReservationKeysetCursor(
  checkIn: string,
  createdAt: Date | string,
  id: string
): string {
  const iso = typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  return Buffer.from(JSON.stringify({ checkIn, createdAt: iso, id }), "utf8").toString("base64url");
}

/**
 * Income line list keyset cursor (v1): transactionDate (YYYY-MM-DD) + createdAt + id.
 * Matches ORDER BY transaction_date DESC, created_at DESC, id DESC.
 */
export type IncomeLineKeysetCursorV1 = {
  createdAt: string;
  id: string;
  transactionDate: string;
};

export function decodeIncomeLineKeysetCursor(raw: string): IncomeLineKeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      createdAt?: unknown;
      id?: unknown;
      transactionDate?: unknown;
    };
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      typeof parsed.transactionDate !== "string"
    ) {
      throw new TypeError("invalid shape");
    }
    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
      transactionDate: parsed.transactionDate,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeIncomeLineKeysetCursor(
  transactionDate: string,
  createdAt: Date | string,
  id: string
): string {
  const iso = typeof createdAt === "string" ? createdAt : createdAt.toISOString();
  return Buffer.from(JSON.stringify({ createdAt: iso, id, transactionDate }), "utf8").toString(
    "base64url"
  );
}

/**
 * Unified income-entries list keyset cursor (v1): sort dimensions + createdAt + id + entryKind.
 * Matches dynamic ORDER BY with tiebreakers created_at, id, entry_kind.
 */
export type IncomeEntryKeysetCursorV1 = {
  createdAt: string;
  entryKind: string;
  id: string;
  sortBy: string;
  sortDir: string;
  sortKeyDate: string | null;
  sortKeyNum: number | null;
  sortKeyText: string | null;
};

export function decodeIncomeEntryKeysetCursor(raw: string): IncomeEntryKeysetCursorV1 {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      createdAt?: unknown;
      entryKind?: unknown;
      id?: unknown;
      sortBy?: unknown;
      sortDir?: unknown;
      sortKeyDate?: unknown;
      sortKeyNum?: unknown;
      sortKeyText?: unknown;
      sortDate?: unknown;
    };
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.entryKind !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new TypeError("invalid shape");
    }

    const sortBy = typeof parsed.sortBy === "string" ? parsed.sortBy : "date";
    const sortDir = typeof parsed.sortDir === "string" ? parsed.sortDir : "desc";
    const sortKeyDate =
      parsed.sortKeyDate === null
        ? null
        : typeof parsed.sortKeyDate === "string"
          ? parsed.sortKeyDate
          : typeof parsed.sortDate === "string"
            ? parsed.sortDate
            : null;
    const sortKeyNum =
      parsed.sortKeyNum === null
        ? null
        : typeof parsed.sortKeyNum === "number"
          ? parsed.sortKeyNum
          : null;
    const sortKeyText =
      parsed.sortKeyText === null
        ? null
        : typeof parsed.sortKeyText === "string"
          ? parsed.sortKeyText
          : null;

    return {
      createdAt: parsed.createdAt,
      entryKind: parsed.entryKind,
      id: parsed.id,
      sortBy,
      sortDir,
      sortKeyDate,
      sortKeyNum,
      sortKeyText,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeIncomeEntryKeysetCursor(input: {
  createdAt: Date | string;
  entryKind: string;
  id: string;
  sortBy: string;
  sortDir: string;
  sortKeyDate: string | null;
  sortKeyNum: number | null;
  sortKeyText: string | null;
}): string {
  const iso =
    typeof input.createdAt === "string" ? input.createdAt : input.createdAt.toISOString();
  return Buffer.from(
    JSON.stringify({
      createdAt: iso,
      entryKind: input.entryKind,
      id: input.id,
      sortBy: input.sortBy,
      sortDir: input.sortDir,
      sortKeyDate: input.sortKeyDate,
      sortKeyNum: input.sortKeyNum,
      sortKeyText: input.sortKeyText,
    }),
    "utf8"
  ).toString("base64url");
}
