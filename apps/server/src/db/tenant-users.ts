import type { ITenantUser } from "@/packages/shared";

import { mapTenantUserRow } from "./mappers";
import { pool } from "./pool";

export interface CreateTenantUserInput {
  email: string;
  emailVerifiedAt?: Date | null;
  name: string;
  passwordHash?: string | null;
  phone?: string | null;
}

export const tenantUsersDb = {
  async create(input: CreateTenantUserInput): Promise<ITenantUser> {
    const result = await pool.query(
      `INSERT INTO tenant_users (email, name, password_hash, phone, email_verified_at)
       VALUES (LOWER(TRIM($1)), $2, $3, $4, $5)
       RETURNING *`,
      [
        input.email,
        input.name,
        input.passwordHash ?? null,
        input.phone ?? null,
        input.emailVerifiedAt ?? null,
      ]
    );
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

  async findById(id: string): Promise<ITenantUser | null> {
    const result = await pool.query(`SELECT * FROM tenant_users WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapTenantUserRow(result.rows[0] as Record<string, unknown>);
  },
};
