import { createIdentityConflictError } from "@/constants/account";
import {
  isPhoneOwnedByOtherUser,
  type ITenantUser,
  normalizeToE164,
  resolveOauthProviderLinkDecision,
} from "@/packages/shared";

import { mapTenantUserRow } from "./mappers";
import { isPostgresUniqueViolation } from "./pg-errors";
import { pool } from "./pool";

export interface CreateTenantUserInput {
  appleId?: string | null;
  email: string;
  emailVerifiedAt?: Date | null;
  googleId?: string | null;
  name: string;
  passwordHash?: string | null;
  phone?: string | null;
  phoneVerifiedAt?: Date | null;
}

export interface ITenantFindOrCreateResult {
  accountLinked?: boolean;
  isNewSignup?: boolean;
  user: ITenantUser;
}

/** Methods used by findOrCreate* (allows stubbing in unit tests). */
interface ITenantOauthStore {
  create: (input: CreateTenantUserInput) => Promise<ITenantUser>;
  findByAppleId: (appleId: string) => Promise<ITenantUser | null>;
  findByEmail: (email: string) => Promise<ITenantUser | null>;
  findByGoogleId: (googleId: string) => Promise<ITenantUser | null>;
  linkAppleId: (tenantUserId: string, appleId: string) => Promise<ITenantUser>;
  linkGoogleId: (tenantUserId: string, googleId: string) => Promise<ITenantUser>;
}

function requireE164Phone(phone: string): string {
  const e164 = normalizeToE164(phone);
  if (!e164) {
    throw new Error("phone must be a valid E.164 phone number");
  }
  return e164;
}

export const tenantUsersDb = {
  async create(input: CreateTenantUserInput): Promise<ITenantUser> {
    const result = await pool.query(
      `INSERT INTO tenant_users (
         email, name, password_hash, phone, email_verified_at,
         google_id, apple_id, phone_verified_at
       )
       VALUES (LOWER(TRIM($1)), $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.email,
        input.name,
        input.passwordHash ?? null,
        input.phone ?? null,
        input.emailVerifiedAt ?? null,
        input.googleId ?? null,
        input.appleId ?? null,
        input.phoneVerifiedAt ?? null,
      ]
    );
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async findByAppleId(appleId: string): Promise<ITenantUser | null> {
    const result = await pool.query(`SELECT * FROM tenant_users WHERE apple_id = $1`, [appleId]);
    if (result.rows.length === 0) return null;
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async findByEmail(email: string): Promise<ITenantUser | null> {
    const result = await pool.query(
      `SELECT * FROM tenant_users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
      [email]
    );
    if (result.rows.length === 0) return null;
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async findByEmailWithPassword(
    email: string
  ): Promise<(ITenantUser & { passwordHash: string | null }) | null> {
    const result = await pool.query(
      `SELECT * FROM tenant_users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
      [email]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      ...mapTenantUserRow(row),
      passwordHash: (row.password_hash as string | null) ?? null,
    };
  },

  async findByGoogleId(googleId: string): Promise<ITenantUser | null> {
    const result = await pool.query(`SELECT * FROM tenant_users WHERE google_id = $1`, [googleId]);
    if (result.rows.length === 0) return null;
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async findById(id: string): Promise<ITenantUser | null> {
    const result = await pool.query(`SELECT * FROM tenant_users WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async findByPhone(phone: string): Promise<ITenantUser | null> {
    const e164 = requireE164Phone(phone);
    const result = await pool.query(`SELECT * FROM tenant_users WHERE phone = $1`, [e164]);
    if (result.rows.length === 0) return null;
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async findByVerifiedPhone(phone: string): Promise<ITenantUser | null> {
    const e164 = requireE164Phone(phone);
    const result = await pool.query(
      `SELECT * FROM tenant_users
       WHERE phone = $1 AND phone_verified_at IS NOT NULL`,
      [e164]
    );
    if (result.rows.length === 0) return null;
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async findOrCreateByApple(
    this: ITenantOauthStore,
    input: {
      appleId: string;
      email: string | null;
      name: string;
    }
  ): Promise<ITenantFindOrCreateResult> {
    const byApple = await this.findByAppleId(input.appleId);
    if (byApple) {
      return { user: byApple };
    }

    if (input.email) {
      const byEmail = await this.findByEmail(input.email);
      if (byEmail) {
        const user = await this.linkAppleId(byEmail.id, input.appleId);
        return { accountLinked: true, user };
      }
    } else {
      throw new Error("Email required for first-time Apple sign-in");
    }

    try {
      const user = await this.create({
        appleId: input.appleId,
        email: input.email,
        emailVerifiedAt: new Date(),
        name: input.name,
      });
      return { isNewSignup: true, user };
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw createIdentityConflictError(
          "An account with this email already exists. Sign in with the method you used originally."
        );
      }
      throw error;
    }
  },

  async findOrCreateByGoogle(
    this: ITenantOauthStore,
    input: {
      email: string;
      googleId: string;
      name: string;
    }
  ): Promise<ITenantFindOrCreateResult> {
    const byGoogle = await this.findByGoogleId(input.googleId);
    if (byGoogle) {
      return { user: byGoogle };
    }

    const byEmail = await this.findByEmail(input.email);
    if (byEmail) {
      const user = await this.linkGoogleId(byEmail.id, input.googleId);
      return { accountLinked: true, user };
    }

    try {
      const user = await this.create({
        email: input.email,
        emailVerifiedAt: new Date(),
        googleId: input.googleId,
        name: input.name,
      });
      return { isNewSignup: true, user };
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw createIdentityConflictError(
          "An account with this email already exists. Sign in with the method you used originally."
        );
      }
      throw error;
    }
  },

  /**
   * Returns stored provider id for link conflict checks (not exposed on public ITenantUser).
   */
  async getOauthProviderIds(
    tenantUserId: string
  ): Promise<{ appleId: string | null; googleId: string | null } | null> {
    const result = await pool.query(`SELECT google_id, apple_id FROM tenant_users WHERE id = $1`, [
      tenantUserId,
    ]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      appleId: (row.apple_id as string | null) ?? null,
      googleId: (row.google_id as string | null) ?? null,
    };
  },

  async getStripeCustomerId(tenantUserId: string): Promise<string | null> {
    const result = await pool.query(`SELECT stripe_customer_id FROM tenant_users WHERE id = $1`, [
      tenantUserId,
    ]);
    if (result.rows.length === 0) return null;
    return (result.rows[0]?.stripe_customer_id as string | null) ?? null;
  },

  async grantVerifiedPhoneWithSmsConsent(
    tenantUserId: string,
    phone: string
  ): Promise<{ newlySubscribed: boolean; user: ITenantUser }> {
    const e164 = requireE164Phone(phone);
    const current = await tenantUsersDb.findById(tenantUserId);
    if (!current) {
      throw new Error("grantVerifiedPhoneWithSmsConsent failed: tenant user not found");
    }

    const existing = await tenantUsersDb.findByPhone(e164);
    if (
      existing &&
      isPhoneOwnedByOtherUser({
        candidateOwnerId: tenantUserId,
        existingOwnerId: existing.id,
      })
    ) {
      throw createIdentityConflictError("This phone number is already linked to another account");
    }

    const alreadySubscribed =
      current.phone === e164 &&
      current.phoneVerifiedAt != null &&
      current.smsConsentedAt != null &&
      current.smsOptedOutAt == null;

    try {
      const result = await pool.query(
        `UPDATE tenant_users
         SET phone = $1,
             phone_verified_at = NOW(),
             sms_consented_at = NOW(),
             sms_opted_out_at = NULL,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [e164, tenantUserId]
      );
      if (result.rows.length === 0) {
        throw new Error("grantVerifiedPhoneWithSmsConsent failed: tenant user not found");
      }
      return {
        newlySubscribed: !alreadySubscribed,
        user: mapTenantUserRow(result.rows[0] as Record<string, unknown>),
      };
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw createIdentityConflictError("This phone number is already linked to another account");
      }
      throw error;
    }
  },

  async linkAppleId(tenantUserId: string, appleId: string): Promise<ITenantUser> {
    const ids = await tenantUsersDb.getOauthProviderIds(tenantUserId);
    if (!ids) {
      throw new Error("linkAppleId failed: tenant user not found");
    }
    const decision = resolveOauthProviderLinkDecision({
      providerId: appleId,
      storedProviderId: ids.appleId,
    });
    if (decision === "conflict") {
      throw createIdentityConflictError(
        "This email is already linked to a different Apple account"
      );
    }
    if (decision === "already_linked") {
      const user = await tenantUsersDb.findById(tenantUserId);
      if (!user) throw new Error("linkAppleId failed: tenant user not found");
      return user;
    }

    try {
      const result = await pool.query(
        `UPDATE tenant_users
         SET apple_id = $1, updated_at = NOW()
         WHERE id = $2 AND apple_id IS NULL
         RETURNING *`,
        [appleId, tenantUserId]
      );
      if (result.rows.length === 0) {
        throw new Error("linkAppleId failed: tenant user not found or apple_id already set");
      }
      return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw createIdentityConflictError("This Apple account is already linked to another user");
      }
      throw error;
    }
  },

  async linkGoogleId(tenantUserId: string, googleId: string): Promise<ITenantUser> {
    const ids = await tenantUsersDb.getOauthProviderIds(tenantUserId);
    if (!ids) {
      throw new Error("linkGoogleId failed: tenant user not found");
    }
    const decision = resolveOauthProviderLinkDecision({
      providerId: googleId,
      storedProviderId: ids.googleId,
    });
    if (decision === "conflict") {
      throw createIdentityConflictError(
        "This email is already linked to a different Google account"
      );
    }
    if (decision === "already_linked") {
      const user = await tenantUsersDb.findById(tenantUserId);
      if (!user) throw new Error("linkGoogleId failed: tenant user not found");
      return user;
    }

    try {
      const result = await pool.query(
        `UPDATE tenant_users
         SET google_id = $1, updated_at = NOW()
         WHERE id = $2 AND google_id IS NULL
         RETURNING *`,
        [googleId, tenantUserId]
      );
      if (result.rows.length === 0) {
        throw new Error("linkGoogleId failed: tenant user not found or google_id already set");
      }
      return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw createIdentityConflictError("This Google account is already linked to another user");
      }
      throw error;
    }
  },

  async optOutOfSms(tenantUserId: string): Promise<ITenantUser | null> {
    const result = await pool.query(
      `UPDATE tenant_users
       SET phone = NULL,
           phone_verified_at = NULL,
           sms_opted_out_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [tenantUserId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  async setStripeCustomerIdIfNull(
    tenantUserId: string,
    stripeCustomerId: string
  ): Promise<string | null> {
    const result = await pool.query(
      `UPDATE tenant_users
       SET stripe_customer_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND stripe_customer_id IS NULL
       RETURNING stripe_customer_id`,
      [tenantUserId, stripeCustomerId]
    );
    if (result.rows.length > 0) {
      return (result.rows[0]?.stripe_customer_id as string) ?? stripeCustomerId;
    }
    const existing = await pool.query(`SELECT stripe_customer_id FROM tenant_users WHERE id = $1`, [
      tenantUserId,
    ]);
    return (existing.rows[0]?.stripe_customer_id as string | null) ?? null;
  },

  /**
   * Copies operator-entered lease phone onto the tenant account without OTP verification.
   * No-op when the user already has a phone or the number is owned by another account.
   */
  async setUnverifiedPhoneIfNull(tenantUserId: string, phone: string): Promise<ITenantUser | null> {
    const e164 = requireE164Phone(phone);
    const existing = await tenantUsersDb.findByPhone(e164);
    if (
      existing &&
      isPhoneOwnedByOtherUser({
        candidateOwnerId: tenantUserId,
        existingOwnerId: existing.id,
      })
    ) {
      return null;
    }

    try {
      const result = await pool.query(
        `UPDATE tenant_users
         SET phone = $1, updated_at = NOW()
         WHERE id = $2 AND phone IS NULL
         RETURNING *`,
        [e164, tenantUserId]
      );
      if (result.rows.length === 0) {
        return null;
      }
      return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  },

  async setVerifiedPhone(tenantUserId: string, phone: string): Promise<ITenantUser> {
    const e164 = requireE164Phone(phone);
    const existing = await tenantUsersDb.findByPhone(e164);
    if (
      existing &&
      isPhoneOwnedByOtherUser({
        candidateOwnerId: tenantUserId,
        existingOwnerId: existing.id,
      })
    ) {
      throw createIdentityConflictError("This phone number is already linked to another account");
    }

    try {
      const result = await pool.query(
        `UPDATE tenant_users
         SET phone = $1, phone_verified_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [e164, tenantUserId]
      );
      if (result.rows.length === 0) {
        throw new Error("setVerifiedPhone failed: tenant user not found");
      }
      return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw createIdentityConflictError("This phone number is already linked to another account");
      }
      throw error;
    }
  },

  async updateName(tenantUserId: string, name: string): Promise<ITenantUser> {
    const result = await pool.query(
      `UPDATE tenant_users
       SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [name.trim(), tenantUserId]
    );
    if (result.rows.length === 0) {
      throw new Error("updateName failed: tenant user not found");
    }
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },

  /**
   * Updates phone for linked-tenant admin edits when phone is not verified.
   * Does not set phone_verified_at.
   */
  async updateUnverifiedPhone(tenantUserId: string, phone: string | null): Promise<ITenantUser> {
    const e164 = phone?.trim() ? requireE164Phone(phone) : null;
    if (e164) {
      const existing = await tenantUsersDb.findByPhone(e164);
      if (
        existing &&
        isPhoneOwnedByOtherUser({
          candidateOwnerId: tenantUserId,
          existingOwnerId: existing.id,
        })
      ) {
        throw createIdentityConflictError("This phone number is already linked to another account");
      }
    }

    try {
      const result = await pool.query(
        `UPDATE tenant_users
         SET phone = $1, updated_at = NOW()
         WHERE id = $2
           AND phone_verified_at IS NULL
         RETURNING *`,
        [e164, tenantUserId]
      );
      if (result.rows.length === 0) {
        throw new Error("updateUnverifiedPhone failed: tenant user not found or phone is verified");
      }
      return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw createIdentityConflictError("This phone number is already linked to another account");
      }
      throw error;
    }
  },
};
