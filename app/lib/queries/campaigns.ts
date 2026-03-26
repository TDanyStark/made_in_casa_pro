import { db } from "../db";
import { CampaignType } from "../definitions";
import { buildWhereClause, buildPaginationArgs, parseTotal } from "../db/query-helpers";
import { ITEMS_PER_PAGE } from "@/config/constants";

export async function getCampaignById(id: number): Promise<CampaignType | null> {
  try {
    const result = await db.execute({
      sql: `
        SELECT c.id, c.name, c.client_id, cl.name AS client_name, c.created_at
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.id = $1
      `,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as CampaignType;
  } catch (error) {
    console.error("Error fetching campaign by ID:", error);
    return null;
  }
}

export async function createCampaign(
  name: string,
  clientId: number
): Promise<CampaignType> {
  try {
    const result = await db.execute({
      sql: `INSERT INTO campaigns (name, client_id) VALUES ($1, $2) RETURNING id`,
      args: [name, clientId],
    });
    const id = Number(result.rows[0]?.id);
    const created = await getCampaignById(id);
    return created!;
  } catch (error) {
    console.error("Error creating campaign:", error);
    throw error;
  }
}

export async function getCampaignsWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
  clientId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: number;
}) {
  try {
    const { whereSQL, args } = buildWhereClause([
      { sql: "c.client_id = $", value: clientId },
      { sql: "unaccent(c.name) ILIKE unaccent($)", value: search ? `%${search}%` : undefined },
    ]);

    const baseFrom = `FROM campaigns c LEFT JOIN clients cl ON c.client_id = cl.id`;

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as count ${baseFrom}${whereSQL}`,
      args,
    });
    const total = parseTotal(countResult.rows as Record<string, unknown>[]);

    const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(args, page, limit);
    const result = await db.execute({
      sql: `
        SELECT c.id, c.name, c.client_id, cl.name AS client_name, c.created_at
        ${baseFrom}${whereSQL}
        ORDER BY c.name ASC
        LIMIT ${limitPH} OFFSET ${offsetPH}
      `,
      args: [...args, ...paginationArgs],
    });

    return {
      campaigns: result.rows as unknown as CampaignType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return { campaigns: [], total: 0 };
  }
}
