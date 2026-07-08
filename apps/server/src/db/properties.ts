import type { Pool, PoolClient } from "pg";

import type {
  IAdminCreatePropertyBody,
  IAdminUpdatePropertyBody,
  IProperty,
  IPropertyDetail,
  IPropertyMember,
  IPropertyMemberUser,
} from "@/packages/shared";
import { PropertyRole } from "@/packages/shared";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { mapPropertyMemberRow, mapPropertyRow } from "./mappers";
import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

export const propertiesDb = {
  async create(
    input: IAdminCreatePropertyBody,
    createdBy: string,
    queryable: DbQueryable = pool
  ): Promise<IProperty> {
    const result = await queryable.query(
      `INSERT INTO properties (name, address, phone_number, legal_name, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.name.trim(),
        input.address.trim(),
        input.phoneNumber?.trim() ?? null,
        input.legalName?.trim() ?? null,
        createdBy,
      ]
    );
    const row = result.rows[0] as Record<string, unknown>;
    const propertyId = row.id as string;

    await queryable.query(
      `INSERT INTO property_members (property_id, user_id, role, added_by)
       VALUES ($1, $2, $3::property_role, $4)`,
      [propertyId, createdBy, PropertyRole.OWNER, createdBy]
    );

    return mapPropertyRow({ ...row, member_count: 1, unit_count: 0 });
  },

  async delete(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM properties WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async findById(id: string): Promise<IProperty | null> {
    const result = await pool.query(
      `SELECT p.*, COUNT(pm.id)::int AS member_count,
              (SELECT COUNT(*)::int FROM property_units pu
               WHERE pu.property_id = p.id) AS unit_count
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
      `SELECT p.*, COUNT(pm.id)::int AS member_count,
              (SELECT COUNT(*)::int FROM property_units pu
               WHERE pu.property_id = p.id) AS unit_count,
              u.name AS creator_name, u.email AS creator_email
       FROM properties p
       LEFT JOIN property_members pm ON pm.property_id = p.id
       INNER JOIN users u ON u.id = p.created_by
       WHERE p.id = $1
       GROUP BY p.id, u.name, u.email`,
      [id]
    );
    if (propertyResult.rows.length === 0) return null;

    const row = propertyResult.rows[0] as Record<string, unknown>;
    const property = mapPropertyRow(row);
    const creator: IPropertyMemberUser = {
      email: row.creator_email as string,
      id: row.created_by as string,
      name: row.creator_name as string,
    };

    const membersResult = await pool.query(
      `SELECT pm.*, u.name AS user_name, u.email AS user_email
       FROM property_members pm
       INNER JOIN users u ON u.id = pm.user_id
       WHERE pm.property_id = $1
       ORDER BY pm.created_at ASC`,
      [id]
    );

    const members: IPropertyMember[] = membersResult.rows.map((memberRow) =>
      mapPropertyMemberRow(memberRow as Record<string, unknown>)
    );

    return { ...property, creator, members };
  },

  async listAccessibleForUser(
    userId: string,
    isAdmin: boolean
  ): Promise<{ id: string; name: string }[]> {
    if (isAdmin) {
      const result = await pool.query(`SELECT id, name FROM properties ORDER BY name ASC`);
      return result.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
      }));
    }

    const result = await pool.query(
      `SELECT DISTINCT p.id, p.name
       FROM properties p
       LEFT JOIN property_members pm ON pm.property_id = p.id
       WHERE p.created_by = $1 OR pm.user_id = $1
       ORDER BY p.name ASC`,
      [userId]
    );
    return result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
    }));
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
      `SELECT p.*, COUNT(pm.id)::int AS member_count,
              (SELECT COUNT(*)::int FROM property_units pu
               WHERE pu.property_id = p.id) AS unit_count
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

  async listPaginatedForUser(params: {
    cursor?: string;
    limit: number;
    q?: string;
    userId: string;
  }): Promise<{ items: IProperty[]; nextCursor: string | null }> {
    const fragments: string[] = [
      `(p.created_by = $1 OR EXISTS (
         SELECT 1 FROM property_members pm2
         WHERE pm2.property_id = p.id AND pm2.user_id = $1
       ))`,
    ];
    const values: unknown[] = [params.userId];
    let p = 2;

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

    const whereClause = `WHERE ${fragments.join(" AND ")}`;
    const limitParam = p;
    values.push(params.limit + 1);

    const result = await pool.query(
      `SELECT p.*, COUNT(pm.id)::int AS member_count,
              (SELECT COUNT(*)::int FROM property_units pu
               WHERE pu.property_id = p.id) AS unit_count
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
    if ("legalName" in input) {
      setClauses.push(`legal_name = $${p++}`);
      values.push(
        input.legalName != null && input.legalName !== "" ? input.legalName.trim() : null
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
};
