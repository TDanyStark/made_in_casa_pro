import { turso } from "../db";
import { AreaType } from "../definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";

export async function getAreas() {
  try {
    const result = await turso.execute(
      `SELECT id, name FROM areas ORDER BY name ASC`
    );
    return result.rows as unknown as AreaType[];
  } catch (error) {
    console.error("Error fetching areas:", error);
    return [];
  }
}

export async function getAreaById(id: string) {
  try {
    const result = await turso.execute({
      sql: `
        SELECT id, name
        FROM areas
        WHERE id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    return result.rows[0] as unknown as AreaType;
  } catch (error) {
    console.error("Error fetching area by ID:", error);
    return null;
  }
}

export async function createArea(areaData: Omit<AreaType, "id">) {
  try {
    const result = await turso.execute({
      sql: `INSERT INTO areas (name) VALUES (?)`,
      args: [areaData.name],
    });

    const areaId = Number(result.lastInsertRowid);
    
    return {
      id: areaId,
      name: areaData.name,
    };
  } catch (error) {
    console.error("Error creating area:", error);
    throw error;
  }
}

export async function updateArea(id: string, updateData: Partial<AreaType>) {
  try {
    const { name } = updateData;
    const updates = [];
    const args = [];

    // Build update statement based on provided fields
    if (name) {
      updates.push("name = ?");
      args.push(name);
    }

    if (updates.length > 0) {
      // Add the id at the end of args for WHERE clause
      args.push(id);

      await turso.execute({
        sql: `UPDATE areas SET ${updates.join(", ")} WHERE id = ?`,
        args,
      });

      // Get the updated area to return
      return getAreaById(id);
    }

    // If no fields to update, just return the existing area
    return getAreaById(id);
  } catch (error) {
    console.error("Error updating area:", error);
    throw error;
  }
}

export async function getAreasWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  try {
    let sql = `SELECT id, name FROM areas`;
    const args = [];
    const countArgs = [];

    // Build WHERE clause for search
    if (search) {
      sql += ` WHERE name LIKE ?`;
      const searchParam = `%${search}%`;
      args.push(searchParam);
      countArgs.push(searchParam);
    }

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as count FROM areas`;
    if (search) {
      countSql += ` WHERE name LIKE ?`;
    }

    const countResult = await turso.execute({
      sql: countSql,
      args: countArgs,
    });

    const total = Number(countResult.rows[0].count);

    // Add order by and pagination
    sql += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    const offset = (page - 1) * limit;
    args.push(limit, offset);

    // Execute query
    const result = await turso.execute({
      sql,
      args,
    });

    // Transform the result
    const areas = result.rows as unknown as AreaType[];

    return {
      areas,
      total,
    };
  } catch (error) {
    console.error("Error fetching areas with pagination:", error);
    return { areas: [], total: 0 };
  }
}
