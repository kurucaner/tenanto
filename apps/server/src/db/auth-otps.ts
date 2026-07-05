import { pool } from "./pool";

export type OtpPurpose = "register" | "reset_password";

interface CreateOtpParams {
  codeHash: string;
  email: string;
  expiresAt: Date;
  purpose: OtpPurpose;
}

export interface IAuthOtpRow {
  codeHash: string;
  id: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const authOtpsDb = {
  async create({ codeHash, email, expiresAt, purpose }: CreateOtpParams): Promise<void> {
    const normalized = normalizeEmail(email);
    await pool.query(
      `INSERT INTO auth_otps (email, code_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalized, codeHash, purpose, expiresAt]
    );
  },

  async deleteByEmailAndPurpose(email: string, purpose: OtpPurpose): Promise<void> {
    const normalized = normalizeEmail(email);
    await pool.query(`DELETE FROM auth_otps WHERE LOWER(TRIM(email)) = $1 AND purpose = $2`, [
      normalized,
      purpose,
    ]);
  },

  async deleteById(id: string): Promise<void> {
    await pool.query("DELETE FROM auth_otps WHERE id = $1", [id]);
  },

  async findMostRecentCreatedAt(
    email: string,
    purpose: OtpPurpose
  ): Promise<Date | null> {
    const normalized = normalizeEmail(email);
    const result = await pool.query(
      `SELECT created_at FROM auth_otps
       WHERE LOWER(TRIM(email)) = $1 AND purpose = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalized, purpose]
    );
    if (result.rows.length === 0) return null;
    const raw = result.rows[0].created_at;
    return raw instanceof Date ? raw : new Date(raw as string);
  },

  async findValidByEmailAndPurpose(
    email: string,
    purpose: OtpPurpose
  ): Promise<IAuthOtpRow | null> {
    const normalized = normalizeEmail(email);
    const result = await pool.query(
      `SELECT id, code_hash as "codeHash" FROM auth_otps
       WHERE LOWER(TRIM(email)) = $1 AND purpose = $2 AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalized, purpose]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  },
};
