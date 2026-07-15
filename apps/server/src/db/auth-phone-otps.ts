import { pool } from "./pool";

export type PhoneOtpPurpose = "tenant_phone_bind" | "tenant_phone_login";

interface CreatePhoneOtpParams {
  codeHash: string;
  expiresAt: Date;
  phone: string;
  purpose: PhoneOtpPurpose;
}

export interface IAuthPhoneOtpRow {
  codeHash: string;
  id: string;
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

export const authPhoneOtpsDb = {
  async create({ codeHash, expiresAt, phone, purpose }: CreatePhoneOtpParams): Promise<void> {
    const normalized = normalizePhone(phone);
    await pool.query(
      `INSERT INTO auth_phone_otps (phone, code_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalized, codeHash, purpose, expiresAt]
    );
  },

  async deleteById(id: string): Promise<void> {
    await pool.query("DELETE FROM auth_phone_otps WHERE id = $1", [id]);
  },

  async deleteByPhoneAndPurpose(phone: string, purpose: PhoneOtpPurpose): Promise<void> {
    const normalized = normalizePhone(phone);
    await pool.query(`DELETE FROM auth_phone_otps WHERE phone = $1 AND purpose = $2`, [
      normalized,
      purpose,
    ]);
  },

  async findMostRecentCreatedAt(phone: string, purpose: PhoneOtpPurpose): Promise<Date | null> {
    const normalized = normalizePhone(phone);
    const result = await pool.query(
      `SELECT created_at FROM auth_phone_otps
       WHERE phone = $1 AND purpose = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalized, purpose]
    );
    if (result.rows.length === 0) return null;
    const raw = result.rows[0].created_at;
    return raw instanceof Date ? raw : new Date(raw as string);
  },

  async findValidByPhoneAndPurpose(
    phone: string,
    purpose: PhoneOtpPurpose
  ): Promise<IAuthPhoneOtpRow | null> {
    const normalized = normalizePhone(phone);
    const result = await pool.query(
      `SELECT id, code_hash as "codeHash" FROM auth_phone_otps
       WHERE phone = $1 AND purpose = $2 AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalized, purpose]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as IAuthPhoneOtpRow;
  },
};
