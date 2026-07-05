import {
  createAccountPermanentlyDeletedError,
  createIdentityConflictError,
} from "@/constants/account";
import { type IUser, type UserType } from "@/packages/shared";
import { encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { AccountEvent } from "../server-types";
import { accountEventsDb } from "./account-events";
import { mapUserRow } from "./mappers";
import { pool } from "./pool";

interface CreateUserParams {
  email: string;
  googleId: string;
  name: string;
}

interface CreateAppleUserParams {
  appleId: string;
  email: string;
  name: string;
}

interface CreateWithEmailParams {
  email: string;
  name: string;
  passwordHash: string;
}

interface AppleFindOrCreateParams {
  appleId: string;
  email: string | null;
  name: string;
}

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function isWithinRecoveryWindow(deletedAt: string): boolean {
  const deletedTime = new Date(deletedAt).getTime();
  const now = Date.now();
  if (deletedTime > now) return false;
  return now - deletedTime <= RECOVERY_WINDOW_MS;
}

function toUser(row: IUserRow): IUser {
  const { deletedAt: _a, isDeleted: _d, ...user } = row;
  return user;
}

/** Internal type for auth flow; includes deletion fields for recovery logic */
export interface IUserRow extends IUser {
  deletedAt: string | null;
  isDeleted: boolean;
}

export interface IFindOrCreateResult {
  accountLinked?: boolean;
  accountRecovered: boolean;
  isNewSignup?: boolean;
  user: IUser;
}

const mapRowWithDeletion = (row: Record<string, unknown>): IUserRow => ({
  ...mapUserRow(row),
  deletedAt: row.deleted_at ? (row.deleted_at as Date).toISOString() : null,
  isDeleted: (row.is_deleted as boolean) ?? false,
});

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

export interface IListUsersPaginatedParams {
  cursor: { createdAt: string; id: string } | null;
  includeDeleted: boolean;
  limit: number;
  q?: string;
  userType?: UserType;
}

export interface IAdminUserDetail {
  deletedAt: string | null;
  hasPassword: boolean;
  isDeleted: boolean;
  user: IUser;
}

export const userDb = {
  async completeOnboarding(userId: string): Promise<IUser | null> {
    const result = await pool.query(
      `UPDATE users SET onboarding_completed_at = NOW()
       WHERE id = $1 AND is_deleted = false
       RETURNING *`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    return mapUserRow(result.rows[0]);
  },

  async create({ email, googleId, name }: CreateUserParams): Promise<IUser> {
    const result = await pool.query(
      `INSERT INTO users (google_id, email, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [googleId, email, name]
    );
    return mapUserRow(result.rows[0]);
  },

  async createWithApple({ appleId, email, name }: CreateAppleUserParams): Promise<IUser> {
    const result = await pool.query(
      `INSERT INTO users (apple_id, email, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [appleId, email, name]
    );
    return mapUserRow(result.rows[0]);
  },

  async createWithEmail({ email, name, passwordHash }: CreateWithEmailParams): Promise<IUser> {
    const normalized = email.trim().toLowerCase();
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [normalized, name, passwordHash]
    );
    return mapUserRow(result.rows[0]);
  },

  async findByAppleId(appleId: string): Promise<IUserRow | null> {
    const result = await pool.query("SELECT * FROM users WHERE apple_id = $1", [appleId]);
    if (result.rows.length > 0) {
      return mapRowWithDeletion(result.rows[0]);
    }
    return null;
  },

  async findByEmail(email: string): Promise<IUser | null> {
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND is_deleted = false",
      [email]
    );
    if (result.rows.length === 0) return null;
    return mapUserRow(result.rows[0]);
  },

  async findByEmailWithPassword(email: string): Promise<(IUser & { passwordHash: string }) | null> {
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND is_deleted = false",
      [email]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...mapUserRow(row),
      passwordHash: row.password_hash as string,
    };
  },

  async findByGoogleId(googleId: string): Promise<IUserRow | null> {
    const result = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
    if (result.rows.length > 0) {
      return mapRowWithDeletion(result.rows[0]);
    }
    return null;
  },

  async findById(id: string): Promise<IUser | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1 AND is_deleted = false", [
      id,
    ]);
    if (result.rows.length === 0) return null;
    return mapUserRow(result.rows[0]);
  },

  async findByIdForAdmin(id: string): Promise<IAdminUserDetail | null> {
    const result = await pool.query(
      "SELECT *, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      deletedAt: row.deleted_at ? (row.deleted_at as Date).toISOString() : null,
      hasPassword: Boolean(row.has_password),
      isDeleted: (row.is_deleted as boolean) ?? false,
      user: mapUserRow(row),
    };
  },

  async findByIdWithHasPassword(id: string): Promise<{ hasPassword: boolean; user: IUser } | null> {
    const result = await pool.query(
      "SELECT *, (password_hash IS NOT NULL) as has_password FROM users WHERE id = $1 AND is_deleted = false",
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      hasPassword: Boolean(row.has_password),
      user: mapUserRow(row),
    };
  },

  async findByIdWithPassword(id: string): Promise<(IUser & { passwordHash: string }) | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1 AND is_deleted = false", [
      id,
    ]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row.password_hash) return null;
    return {
      ...mapUserRow(row),
      passwordHash: row.password_hash as string,
    };
  },

  async findOrCreateByApple({
    appleId,
    email,
    name,
  }: AppleFindOrCreateParams): Promise<IFindOrCreateResult> {
    const existing = await userDb.findByAppleId(appleId);
    if (!existing) {
      if (!email) {
        throw new Error("Email required for first-time Apple sign-in");
      }

      const byEmail = await userDb.findByEmail(email);
      if (byEmail) {
        if (byEmail.appleId != null && byEmail.appleId !== appleId) {
          throw createIdentityConflictError(
            "This email is already linked to a different Apple account. Sign in with the method you used when you created your account."
          );
        }
        if (byEmail.appleId === appleId) {
          const user = await userDb.findById(byEmail.id);
          if (!user) {
            throw new Error("User record missing after Apple identity match");
          }
          return { accountRecovered: false, user };
        }

        const user = await userDb.linkAppleId(byEmail.id, appleId);
        await accountEventsDb.logEvent({
          eventType: AccountEvent.ACCOUNT_PROVIDER_LINKED,
          metadata: { provider: "apple" },
          userId: user.id,
        });
        return { accountLinked: true, accountRecovered: false, user };
      }

      try {
        const user = await userDb.createWithApple({ appleId, email, name });
        return { accountRecovered: false, isNewSignup: true, user };
      } catch (err) {
        if (isPostgresUniqueViolation(err)) {
          throw createIdentityConflictError(
            "An account with this email already exists. Sign in with the method you used originally."
          );
        }
        throw err;
      }
    }

    if (!existing.isDeleted) {
      return { accountRecovered: false, user: toUser(existing) };
    }

    if (!existing.deletedAt || !isWithinRecoveryWindow(existing.deletedAt)) {
      throw createAccountPermanentlyDeletedError();
    }

    await userDb.restore(existing.id);
    await accountEventsDb.logEvent({
      eventType: AccountEvent.ACCOUNT_RECOVERED,
      metadata: { provider: "apple" },
      userId: existing.id,
    });
    const user = toUser({ ...existing, deletedAt: null, isDeleted: false });
    return { accountRecovered: true, user };
  },

  async findOrCreateByGoogle({
    email,
    googleId,
    name,
  }: CreateUserParams): Promise<IFindOrCreateResult> {
    const existing = await userDb.findByGoogleId(googleId);
    if (!existing) {
      const byEmail = await userDb.findByEmail(email);
      if (byEmail) {
        if (byEmail.googleId != null && byEmail.googleId !== googleId) {
          throw createIdentityConflictError(
            "This email is already linked to a different Google account. Sign in with the method you used when you created your account."
          );
        }
        if (byEmail.googleId === googleId) {
          const user = await userDb.findById(byEmail.id);
          if (!user) {
            throw new Error("User record missing after Google identity match");
          }
          return { accountRecovered: false, user };
        }

        const user = await userDb.linkGoogleId(byEmail.id, googleId);
        await accountEventsDb.logEvent({
          eventType: AccountEvent.ACCOUNT_PROVIDER_LINKED,
          metadata: { provider: "google" },
          userId: user.id,
        });
        return { accountLinked: true, accountRecovered: false, user };
      }

      try {
        const user = await userDb.create({ email, googleId, name });
        return { accountRecovered: false, isNewSignup: true, user };
      } catch (err) {
        if (isPostgresUniqueViolation(err)) {
          throw createIdentityConflictError(
            "An account with this email already exists. Sign in with the method you used originally."
          );
        }
        throw err;
      }
    }

    if (!existing.isDeleted) {
      return { accountRecovered: false, user: toUser(existing) };
    }

    if (!existing.deletedAt || !isWithinRecoveryWindow(existing.deletedAt)) {
      throw createAccountPermanentlyDeletedError();
    }

    await userDb.restore(existing.id);
    await accountEventsDb.logEvent({
      eventType: AccountEvent.ACCOUNT_RECOVERED,
      metadata: { provider: "google" },
      userId: existing.id,
    });
    const user = toUser({ ...existing, deletedAt: null, isDeleted: false });
    return { accountRecovered: true, user };
  },

  async getAdminPlatformUserStats(): Promise<{ usersTotal: number }> {
    const result = await pool.query<{ users_total: string }>(
      `SELECT COUNT(*)::int AS users_total FROM users WHERE is_deleted = false`
    );
    const row = result.rows[0] ?? { users_total: "0" };
    return { usersTotal: Number(row.users_total) };
  },

  async linkAppleId(userId: string, appleId: string): Promise<IUser> {
    const result = await pool.query(
      `UPDATE users
       SET apple_id = $1, updated_at = NOW()
       WHERE id = $2 AND is_deleted = false AND apple_id IS NULL
       RETURNING *`,
      [appleId, userId]
    );
    if (result.rows.length === 0) {
      throw new Error("linkAppleId failed: user not found, deleted, or apple_id already set");
    }
    return mapUserRow(result.rows[0]);
  },

  async linkGoogleId(userId: string, googleId: string): Promise<IUser> {
    const result = await pool.query(
      `UPDATE users
       SET google_id = $1, updated_at = NOW()
       WHERE id = $2 AND is_deleted = false AND google_id IS NULL
       RETURNING *`,
      [googleId, userId]
    );
    if (result.rows.length === 0) {
      throw new Error("linkGoogleId failed: user not found, deleted, or google_id already set");
    }
    return mapUserRow(result.rows[0]);
  },

  async listUsersPaginated(
    params: IListUsersPaginatedParams
  ): Promise<{ nextCursor: string | null; users: IUser[] }> {
    const fragments: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (!params.includeDeleted) {
      fragments.push("is_deleted = false");
    }

    const qTrim = params.q?.trim();
    if (qTrim) {
      fragments.push(`strpos(lower(email), lower($${p++})) > 0`);
      values.push(qTrim);
    }

    if (params.userType !== undefined) {
      fragments.push(`user_type = $${p++}::user_type`);
      values.push(params.userType);
    }

    if (params.cursor) {
      fragments.push(`(created_at, id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      values.push(params.cursor.createdAt, params.cursor.id);
    }

    const whereClause = fragments.length > 0 ? `WHERE ${fragments.join(" AND ")}` : "";
    const limitParam = p;
    values.push(params.limit + 1);

    const result = await pool.query(
      `SELECT * FROM users
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows;
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, params.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date, last.id as string)
    );
    const users = pageRows.map((row) => mapUserRow(row));

    return { nextCursor, users };
  },

  async restore(userId: string): Promise<void> {
    await pool.query("UPDATE users SET is_deleted = false, deleted_at = NULL WHERE id = $1", [
      userId,
    ]);
  },

  async softDelete(userId: string): Promise<void> {
    await pool.query("UPDATE users SET is_deleted = true, deleted_at = NOW() WHERE id = $1", [
      userId,
    ]);
  },

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
  },
};
