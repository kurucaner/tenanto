import type { IPropertyInvite, TPropertyInviteStatus, TPropertyRole } from "@/packages/shared";

import { mapPropertyInviteRow } from "./mappers";
import { pool } from "./pool";

const INVITE_EXPIRY_DAYS = 30;

export interface CreatePropertyInviteInput {
  email: string;
  invitedBy: string;
  propertyId: string;
  role: TPropertyRole;
}

export const propertyInvitesDb = {
  async create(input: CreatePropertyInviteInput): Promise<IPropertyInvite> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const result = await pool.query(
      `INSERT INTO property_invites (property_id, email, role, invited_by, expires_at)
       VALUES ($1, $2, $3::property_role, $4, $5)
       RETURNING *`,
      [input.propertyId, input.email.trim().toLowerCase(), input.role, input.invitedBy, expiresAt]
    );
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },

  async findByProperty(propertyId: string): Promise<IPropertyInvite[]> {
    const result = await pool.query(
      `SELECT * FROM property_invites WHERE property_id = $1 ORDER BY created_at DESC`,
      [propertyId]
    );
    return result.rows.map((row) => mapPropertyInviteRow(row as Record<string, unknown>));
  },

  async findByPropertyAndEmail(propertyId: string, email: string): Promise<IPropertyInvite | null> {
    const result = await pool.query(
      `SELECT * FROM property_invites
       WHERE property_id = $1 AND LOWER(TRIM(email)) = LOWER(TRIM($2))`,
      [propertyId, email]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },

  async findPendingByEmail(email: string): Promise<IPropertyInvite[]> {
    const result = await pool.query(
      `SELECT * FROM property_invites
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
         AND status = 'pending'
         AND expires_at > NOW()`,
      [email]
    );
    return result.rows.map((row) => mapPropertyInviteRow(row as Record<string, unknown>));
  },

  async updateStatus(
    id: string,
    status: TPropertyInviteStatus,
    emailError?: string
  ): Promise<IPropertyInvite | null> {
    const result = await pool.query(
      `UPDATE property_invites
       SET status = $1::property_invite_status, email_error = $2
       WHERE id = $3
       RETURNING *`,
      [status, emailError ?? null, id]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },
};
