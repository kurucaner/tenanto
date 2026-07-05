import type { IPropertyMember, TPropertyRole } from "@/packages/shared";

import { mapPropertyMemberRow } from "./mappers";
import { pool } from "./pool";

export const propertyMembersDb = {
  async add(
    propertyId: string,
    userId: string,
    role: TPropertyRole,
    addedBy: string
  ): Promise<IPropertyMember> {
    await pool.query(
      `INSERT INTO property_members (property_id, user_id, role, added_by)
       VALUES ($1, $2, $3::property_role, $4)`,
      [propertyId, userId, role, addedBy]
    );
    const member = await propertyMembersDb.findOne(propertyId, userId);
    if (!member) throw new Error("Failed to retrieve newly added property member");
    return member;
  },

  async updateRole(
    propertyId: string,
    userId: string,
    role: TPropertyRole
  ): Promise<IPropertyMember | null> {
    await pool.query(
      `UPDATE property_members SET role = $1::property_role
       WHERE property_id = $2 AND user_id = $3`,
      [role, propertyId, userId]
    );
    return propertyMembersDb.findOne(propertyId, userId);
  },

  async remove(propertyId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM property_members WHERE property_id = $1 AND user_id = $2`,
      [propertyId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async findByProperty(propertyId: string): Promise<IPropertyMember[]> {
    const result = await pool.query(
      `SELECT pm.*, u.name AS user_name, u.email AS user_email
       FROM property_members pm
       INNER JOIN users u ON u.id = pm.user_id
       WHERE pm.property_id = $1
       ORDER BY pm.created_at ASC`,
      [propertyId]
    );
    return result.rows.map((row) => mapPropertyMemberRow(row as Record<string, unknown>));
  },

  async findOne(propertyId: string, userId: string): Promise<IPropertyMember | null> {
    const result = await pool.query(
      `SELECT pm.*, u.name AS user_name, u.email AS user_email
       FROM property_members pm
       INNER JOIN users u ON u.id = pm.user_id
       WHERE pm.property_id = $1 AND pm.user_id = $2`,
      [propertyId, userId]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyMemberRow(result.rows[0] as Record<string, unknown>);
  },
};
