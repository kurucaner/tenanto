import type {
  IAdminCreatePropertyBody,
  IAdminUpdatePropertyBody,
  IProperty,
  IPropertyDetail,
  IPropertyMember,
} from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { mapPropertyMemberRow, mapPropertyRow } from "./mappers";
import { pool } from "./pool";

export const propertiesDb = {
  async create(
    input: IAdminCreatePropertyBody,
    createdBy: string
  ): Promise<IProperty> {
    const result = await pool.query(
      `INSERT INTO properties (name, address, phone_number, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *, 0 AS member_count`,
      [input.name.trim(), input.address.trim(), input.phoneNumber?.trim() ?? null, createdBy]
    );
    return mapPropertyRow(result.rows[0] as Record<string, unknown>);
  },

  async findById(id: string): Promise<IProperty | null> {
    const result = await pool.query(
      `SELECT p.*, COUNT(pm.id)::int AS member_count
       FROM properties p
       LEFT JOIN property_members pm ON pm.property_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return mapPropertyRow(result.rows[0] as Record<string, unknown>);
  },

  async findDetailById(id: string): Promise<IPropertyDetail | null> {
    const propertyResult = await pool.query(
      `SELECT p.*, COUNT(pm.id)::int AS member_count
       FROM properties p
       LEFT JOIN property_members pm ON pm.property_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    if (propertyResult.rows.length === 0) return null;

    const property = mapPropertyRow(propertyResult.rows[0] as Record<string, unknown>);

    const membersResult = await pool.query(
      `SELECT pm.*, u.name AS user_name, u.email AS user_email
       FROM property_members pm
       INNER JOIN users u ON u.id = pm.user_id
       WHERE pm.property_id = $1
       ORDER BY pm.created_at ASC`,
      [id]
    );

    const members: IPropertyMember[] = membersResult.rows.map((row) =>
      mapPropertyMemberRow(row as Record<string, unknown>)
    );

    return { ...property, members };
  },

  async listPaginatedForAdmin(params: {
    cursor?: string;
    limit: number;
    q?: string;
  }): Promise<{ items: IProperty[]; nextCursor: string | null }> {
    const fragments: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (params.q != null && params.q.trim() !== "") {
      fragments.push(`(p.name ILIKE $${p} OR p.address ILIKE $${p})`);
      values.push(`%${params.q.trim()}%`);
      p++;
    }

    if (params.cursor != null && params.cursor !== "") {
      const decoded = decodeKeysetCursor(params.cursor);
      fragments.push(`(p.created_at, p.id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      values.push(decoded.createdAt, decoded.id);
    }

    const whereClause = fragments.length > 0 ? `WHERE ${fragments.join(" AND ")}` : "";
    const limitParam = p;
    values.push(params.limit + 1);

    const result = await pool.query(
      `SELECT p.*, COUNT(pm.id)::int AS member_count
       FROM properties p
       LEFT JOIN property_members pm ON pm.property_id = p.id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $${limitParam}`,
      values
    );

    const rows = result.rows as Record<string, unknown>[];
    const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, params.limit, (last) =>
      encodeKeysetCursor(last.created_at as Date, last.id as string)
    );
    const items = pageRows.map(mapPropertyRow);
    return { items, nextCursor };
  },

  async update(id: string, input: IAdminUpdatePropertyBody): Promise<IProperty | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${p++}`);
      values.push(input.name.trim());
    }
    if (input.address !== undefined) {
      setClauses.push(`address = $${p++}`);
      values.push(input.address.trim());
    }
    if ("phoneNumber" in input) {
      setClauses.push(`phone_number = $${p++}`);
      values.push(
        input.phoneNumber != null && input.phoneNumber !== "" ? input.phoneNumber.trim() : null
      );
    }

    if (setClauses.length === 0) return propertiesDb.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE properties SET ${setClauses.join(", ")} WHERE id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return null;
    return propertiesDb.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM properties WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
