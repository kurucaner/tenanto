import {
  type IPropertyInvite,
  PropertyInviteStatus,
  TERMINAL_PROPERTY_MEMBER_INVITE_STATUSES,
  type TPropertyInviteStatus,
  type TPropertyRole,
} from "@/packages/shared";

import { mapPropertyInviteRow } from "./mappers";
import { pool } from "./pool";

const INVITE_EXPIRY_DAYS = 30;

const PENDING_INVITE_STATUSES: TPropertyInviteStatus[] = [
  PropertyInviteStatus.PENDING,
  PropertyInviteStatus.PENDING_INVITE,
  PropertyInviteStatus.PENDING_ACCEPTANCE,
];

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

  async expirePendingInvites(): Promise<number> {
    const result = await pool.query(
      `UPDATE property_invites
       SET status = $1::property_invite_status,
           updated_at = NOW()
       WHERE status = ANY($2::property_invite_status[])
         AND expires_at <= NOW()`,
      [PropertyInviteStatus.EXPIRED, PENDING_INVITE_STATUSES]
    );
    return result.rowCount ?? 0;
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
       WHERE property_id = $1 AND LOWER(TRIM(email)) = LOWER(TRIM($2))
       ORDER BY created_at DESC
       LIMIT 1`,
      [propertyId, email]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },

  async findNonTerminalByProperty(propertyId: string): Promise<IPropertyInvite[]> {
    const result = await pool.query(
      `SELECT * FROM property_invites
       WHERE property_id = $1
         AND NOT (status = ANY($2::property_invite_status[]))
       ORDER BY created_at ASC`,
      [propertyId, TERMINAL_PROPERTY_MEMBER_INVITE_STATUSES]
    );
    return result.rows.map((row) => mapPropertyInviteRow(row as Record<string, unknown>));
  },

  async findPendingByEmail(email: string): Promise<IPropertyInvite[]> {
    const result = await pool.query(
      `SELECT * FROM property_invites
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
         AND status = ANY($2::property_invite_status[])
         AND expires_at > NOW()`,
      [email, PENDING_INVITE_STATUSES]
    );
    return result.rows.map((row) => mapPropertyInviteRow(row as Record<string, unknown>));
  },

  async findPendingByPropertyAndEmail(
    propertyId: string,
    email: string
  ): Promise<IPropertyInvite | null> {
    const result = await pool.query(
      `SELECT * FROM property_invites
       WHERE property_id = $1
         AND LOWER(TRIM(email)) = LOWER(TRIM($2))
         AND status = ANY($3::property_invite_status[])
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [propertyId, email, PENDING_INVITE_STATUSES]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },

  async updateStatus(
    id: string,
    status: TPropertyInviteStatus,
    emailError?: string
  ): Promise<IPropertyInvite | null> {
    const result = await pool.query(
      `UPDATE property_invites
       SET status = $1::property_invite_status,
           email_error = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, emailError ?? null, id]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },
};
