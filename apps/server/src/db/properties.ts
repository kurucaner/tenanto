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
import {
  decodePropertyFavoriteKeysetCursor,
  encodePropertyFavoriteKeysetCursor,
} from "@/pagination/keyset-cursor";
import { takePageWithNextCursor } from "@/pagination/limit-plus-one";

import { mapPropertyMemberRow, mapPropertyRow } from "./mappers";
import { pool } from "./pool";

type DbQueryable = Pool | PoolClient;

const PROPERTY_LIST_SELECT = `
  p.*, COUNT(pm.id)::int AS member_count,
  (SELECT COUNT(*)::int FROM property_units pu
   WHERE pu.property_id = p.id AND pu.is_deleted = false) AS unit_count,
  MAX(puf.favorited_at) AS favorited_at`;

const PROPERTY_LIST_ORDER_BY = `
  COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) ASC,
  p.created_at DESC,
  p.id DESC`;

function propertyFavoriteJoin(userIdParamIndex: number): string {
  return `
       LEFT JOIN property_user_favorites puf
         ON puf.property_id = p.id AND puf.user_id = $${userIdParamIndex}`;
}

function propertyByIdSelectSql(viewerUserIdParamIndex: number | null): string {
  const favoritedAtSelect =
    viewerUserIdParamIndex == null ? "NULL::timestamptz AS favorited_at" : "puf.favorited_at";
  const favoriteJoin =
    viewerUserIdParamIndex == null ? "" : propertyFavoriteJoin(viewerUserIdParamIndex);
  const groupByFavorite = viewerUserIdParamIndex == null ? "" : ", puf.favorited_at";

  return `
      SELECT p.*, COUNT(pm.id)::int AS member_count,
             (SELECT COUNT(*)::int FROM property_units pu
              WHERE pu.property_id = p.id AND pu.is_deleted = false) AS unit_count,
             ${favoritedAtSelect}
       FROM properties p
       LEFT JOIN property_members pm ON pm.property_id = p.id
       ${favoriteJoin}
       WHERE p.id = $1
       GROUP BY p.id${groupByFavorite}`;
}

function propertyDetailByIdSelectSql(viewerUserIdParamIndex: number | null): string {
  const favoritedAtSelect =
    viewerUserIdParamIndex == null ? "NULL::timestamptz AS favorited_at" : "puf.favorited_at";
  const favoriteJoin =
    viewerUserIdParamIndex == null ? "" : propertyFavoriteJoin(viewerUserIdParamIndex);
  const groupByFavorite = viewerUserIdParamIndex == null ? "" : ", puf.favorited_at";

  return `
      SELECT p.*, COUNT(pm.id)::int AS member_count,
             (SELECT COUNT(*)::int FROM property_units pu
              WHERE pu.property_id = p.id AND pu.is_deleted = false) AS unit_count,
             ${favoritedAtSelect},
             u.name AS creator_name, u.email AS creator_email
       FROM properties p
       LEFT JOIN property_members pm ON pm.property_id = p.id
       ${favoriteJoin}
       INNER JOIN users u ON u.id = p.created_by
       WHERE p.id = $1
       GROUP BY p.id, u.name, u.email${groupByFavorite}`;
}

function formatPropertyFavoritedAtForCursor(
  value: Date | string | null | undefined
): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function encodePropertyListNextCursor(row: Record<string, unknown>): string {
  return encodePropertyFavoriteKeysetCursor(
    formatPropertyFavoritedAtForCursor(row.favorited_at as Date | null | undefined),
    row.created_at as Date | string,
    row.id as string
  );
}

type TPropertyListPaginatedParams = {
  accessWhereFragments: string[];
  cursor?: string;
  limit: number;
  q?: string;
  userId: string;
};

async function listPaginatedProperties(
  params: TPropertyListPaginatedParams
): Promise<{ items: IProperty[]; nextCursor: string | null }> {
  const whereFragments = [...params.accessWhereFragments];
  const havingFragments: string[] = [];
  const values: unknown[] = [params.userId];
  let p = 2;

  if (params.q != null && params.q.trim() !== "") {
    whereFragments.push(`(p.name ILIKE $${p} OR p.address ILIKE $${p})`);
    values.push(`%${params.q.trim()}%`);
    p++;
  }

  if (params.cursor != null && params.cursor !== "") {
    const decoded = decodePropertyFavoriteKeysetCursor(params.cursor);
    const cursorFavoritedAt = decoded.favoritedAt ?? "infinity";
    havingFragments.push(`(
      (COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) > $${p}::timestamptz)
      OR (
        COALESCE(MAX(puf.favorited_at), 'infinity'::timestamptz) = $${p}::timestamptz
        AND (
          p.created_at < $${p + 1}::timestamptz
          OR (p.created_at = $${p + 1}::timestamptz AND p.id < $${p + 2}::uuid)
        )
      )
    )`);
    values.push(cursorFavoritedAt, decoded.createdAt, decoded.id);
    p += 3;
  }

  const whereClause = whereFragments.length > 0 ? `WHERE ${whereFragments.join(" AND ")}` : "";
  const havingClause = havingFragments.length > 0 ? `HAVING ${havingFragments.join(" AND ")}` : "";
  const limitParam = p;
  values.push(params.limit + 1);

  const result = await pool.query(
    `SELECT ${PROPERTY_LIST_SELECT}
     FROM properties p
     LEFT JOIN property_members pm ON pm.property_id = p.id
     ${propertyFavoriteJoin(1)}
     ${whereClause}
     GROUP BY p.id
     ${havingClause}
     ORDER BY ${PROPERTY_LIST_ORDER_BY}
     LIMIT $${limitParam}`,
    values
  );

  const rows = result.rows as Record<string, unknown>[];
  const { nextCursor, page: pageRows } = takePageWithNextCursor(rows, params.limit, (last) =>
    encodePropertyListNextCursor(last)
  );
  const items = pageRows.map(mapPropertyRow);
  return { items, nextCursor };
}

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

  async findById(id: string, viewerUserId?: string): Promise<IProperty | null> {
    const values: unknown[] = [id];
    if (viewerUserId != null) {
      values.push(viewerUserId);
    }

    const result = await pool.query(propertyByIdSelectSql(viewerUserId != null ? 2 : null), values);
    if (result.rows.length === 0) return null;
    return mapPropertyRow(result.rows[0] as Record<string, unknown>);
  },

  async findDetailById(id: string, viewerUserId?: string): Promise<IPropertyDetail | null> {
    const values: unknown[] = [id];
    if (viewerUserId != null) {
      values.push(viewerUserId);
    }

    const propertyResult = await pool.query(
      propertyDetailByIdSelectSql(viewerUserId != null ? 2 : null),
      values
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
    userId: string;
  }): Promise<{ items: IProperty[]; nextCursor: string | null }> {
    return listPaginatedProperties({
      accessWhereFragments: [],
      cursor: params.cursor,
      limit: params.limit,
      q: params.q,
      userId: params.userId,
    });
  },

  async listPaginatedForUser(params: {
    cursor?: string;
    limit: number;
    q?: string;
    userId: string;
  }): Promise<{ items: IProperty[]; nextCursor: string | null }> {
    return listPaginatedProperties({
      accessWhereFragments: [
        `(p.created_by = $1 OR EXISTS (
           SELECT 1 FROM property_members pm2
           WHERE pm2.property_id = p.id AND pm2.user_id = $1
         ))`,
      ],
      cursor: params.cursor,
      limit: params.limit,
      q: params.q,
      userId: params.userId,
    });
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
