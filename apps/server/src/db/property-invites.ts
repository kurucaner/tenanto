import {
  duplicatePropertyMemberInviteError,
  invalidPropertyMemberInviteTransitionError,
} from "@/errors/property-member-invite-errors";
import {
  canTransitionPropertyMemberInviteStatus,
  type IPropertyInvite,
  pickCanonicalPropertyMemberInvitesForAdmin,
  PropertyInviteStatus,
  type TPropertyInviteStatus,
  type TPropertyRole,
} from "@/packages/shared";
import {
  hashPropertyMemberInviteToken,
  propertyMemberInviteTokenMatchesHash,
} from "@/ses/property-member-invite-token";

import { mapPropertyInviteRow } from "./mappers";
import { pool } from "./pool";

const INVITE_EXPIRY_DAYS = 30;

const PENDING_INVITE_STATUSES: TPropertyInviteStatus[] = [
  PropertyInviteStatus.PENDING,
  PropertyInviteStatus.PENDING_INVITE,
  PropertyInviteStatus.PENDING_ACCEPTANCE,
];

const ADMIN_HIDDEN_INVITE_STATUSES: TPropertyInviteStatus[] = [
  PropertyInviteStatus.ACCEPTED,
  PropertyInviteStatus.EXPIRED,
];

function inviteStatusTimestampColumn(status: TPropertyInviteStatus): string | null {
  switch (status) {
    case PropertyInviteStatus.ACCEPTED:
      return "accepted_at";
    case PropertyInviteStatus.DECLINED:
      return "declined_at";
    case PropertyInviteStatus.REVOKED:
      return "revoked_at";
    default:
      return null;
  }
}

export interface CreatePropertyInviteInput {
  email: string;
  invitedBy: string;
  inviteTokenHash: string;
  propertyId: string;
  role: TPropertyRole;
  status: TPropertyInviteStatus;
}

export const propertyInvitesDb = {
  async create(input: CreatePropertyInviteInput): Promise<IPropertyInvite> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingPending = await propertyInvitesDb.findPendingByPropertyAndEmail(
      input.propertyId,
      normalizedEmail
    );
    if (existingPending) {
      throw duplicatePropertyMemberInviteError();
    }

    const result = await pool.query(
      `INSERT INTO property_invites (
         property_id,
         email,
         role,
         invited_by,
         expires_at,
         status,
         invite_token_hash,
         invited_at
       )
       VALUES ($1, $2, $3::property_role, $4, $5, $6::property_invite_status, $7, NOW())
       RETURNING *`,
      [
        input.propertyId,
        normalizedEmail,
        input.role,
        input.invitedBy,
        expiresAt,
        input.status,
        input.inviteTokenHash,
      ]
    );
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },

  async expireInviteIfPastTtl(invite: IPropertyInvite): Promise<IPropertyInvite | null> {
    if (new Date(invite.expiresAt) > new Date()) {
      return null;
    }
    if (!PENDING_INVITE_STATUSES.includes(invite.status)) {
      return null;
    }
    return propertyInvitesDb.updateStatus(invite.id, PropertyInviteStatus.EXPIRED);
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

  async findAdminVisibleByProperty(propertyId: string): Promise<IPropertyInvite[]> {
    const result = await pool.query(
      `SELECT * FROM property_invites
       WHERE property_id = $1
         AND NOT (status = ANY($2::property_invite_status[]))
       ORDER BY created_at ASC`,
      [propertyId, ADMIN_HIDDEN_INVITE_STATUSES]
    );
    return pickCanonicalPropertyMemberInvitesForAdmin(
      result.rows.map((row) => mapPropertyInviteRow(row as Record<string, unknown>))
    );
  },

  async findById(id: string): Promise<IPropertyInvite | null> {
    const result = await pool.query(`SELECT * FROM property_invites WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },

  async findByInviteToken(rawToken: string): Promise<IPropertyInvite | null> {
    const inviteTokenHash = hashPropertyMemberInviteToken(rawToken);
    const result = await pool.query(
      `SELECT * FROM property_invites
       WHERE invite_token_hash = $1
         AND invite_token_hash IS NOT NULL`,
      [inviteTokenHash]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const storedHash = row["invite_token_hash"];
    if (
      typeof storedHash !== "string" ||
      !propertyMemberInviteTokenMatchesHash(rawToken, storedHash)
    ) {
      return null;
    }

    return mapPropertyInviteRow(row);
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
    return propertyInvitesDb.findAdminVisibleByProperty(propertyId);
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

  async transitionStatus(
    id: string,
    toStatus: TPropertyInviteStatus
  ): Promise<IPropertyInvite | null> {
    const current = await propertyInvitesDb.findById(id);
    if (!current) {
      return null;
    }

    if (!canTransitionPropertyMemberInviteStatus(current.status, toStatus)) {
      throw invalidPropertyMemberInviteTransitionError(current.status, toStatus);
    }

    const timestampColumn = inviteStatusTimestampColumn(toStatus);
    const setTimestamp = timestampColumn != null ? `, ${timestampColumn} = NOW()` : "";
    const clearInviteToken =
      toStatus === PropertyInviteStatus.ACCEPTED ? ", invite_token_hash = NULL" : "";

    const result = await pool.query(
      `UPDATE property_invites
       SET status = $1::property_invite_status,
           updated_at = NOW()${setTimestamp}${clearInviteToken}
       WHERE id = $2
       RETURNING *`,
      [toStatus, id]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyInviteRow(result.rows[0] as Record<string, unknown>);
  },

  async updateInviteToken(id: string, inviteTokenHash: string): Promise<IPropertyInvite | null> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const result = await pool.query(
      `UPDATE property_invites
       SET invite_token_hash = $1,
           expires_at = $2,
           invited_at = NOW(),
           updated_at = NOW(),
           email_error = NULL
       WHERE id = $3
       RETURNING *`,
      [inviteTokenHash, expiresAt, id]
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
