import { turso } from "../db";
import { revalidatePath } from "next/cache";
import { ManagerType } from "../definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";

export async function getManagerByEmail(email: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE email = ?`,
      args: [email],
    });
    return result.rows.length > 0
      ? (result.rows[0] as unknown as ManagerType)
      : null;
  } catch (error) {
    console.error("Error fetching manager by email:", error);
    return null;
  }
}

export async function getManagerById(id: string) {
  try {
    const result = await turso.execute({
      sql: `
        SELECT 
          m.*,
          c.id AS client_id, 
          c.name AS client_name,
          co.id AS country_id,
          co.name AS country_name,
          co.flag AS country_flag
        FROM managers m
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN countries co ON c.country_id = co.id
        WHERE m.id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      client_id: row.client_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      biography: row.biography,
      client_info: row.client_id
        ? {
            id: row.client_id,
            name: row.client_name,
            country: row.country_id
              ? {
                  id: row.country_id,
                  name: row.country_name,
                  flag: row.country_flag,
                }
              : undefined,
          }
        : undefined,
    } as ManagerType;
  } catch (error) {
    console.error("Error fetching manager:", error);
    return null;
  }
}

export async function getManagersByClientId(clientId: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE client_id = ? ORDER BY name ASC`,
      args: [clientId],
    });
    return result.rows as unknown as ManagerType[];
  } catch (error) {
    console.error("Error fetching managers by client ID:", error);
    return [];
  }
}

export async function getManagers() {
  try {
    const result = await turso.execute(
      `SELECT * FROM managers ORDER BY name ASC`
    );
    return result.rows as unknown as ManagerType[];
  } catch (error) {
    console.error("Error fetching managers:", error);
    return [];
  }
}

interface PaginationParams {
  clientId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function getManagersWithPagination({clientId, page = 1, limit = ITEMS_PER_PAGE, search,}: PaginationParams) {
  try {
    let sql = "SELECT * FROM managers";
    const args = [];
    const countArgs = [];
    const conditions: string[] = [];
    if (clientId) {
      conditions.push("client_id = ?");
      args.push(clientId);
      countArgs.push(clientId);
    }
    if (search) {
      conditions.push("(name LIKE ? OR email LIKE ? OR phone LIKE ?)");
      const searchParam = `%${search}%`;
      args.push(searchParam, searchParam, searchParam);
      countArgs.push(searchParam, searchParam, searchParam);
    }
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    // Get total count for pagination
    let countSql = "SELECT COUNT(*) as count FROM managers";
    if (conditions.length > 0) {
      countSql += " WHERE " + conditions.join(" AND ");
    }
    const countResult = await turso.execute({
      sql: countSql,
      args: countArgs,
    });
    const total = Number(countResult.rows[0].count);
    // Add pagination
    const offset = (page - 1) * limit;
    sql += " LIMIT ? OFFSET ?";
    args.push(limit, offset);
    // Execute query
    const result = await turso.execute({
      sql,
      args,
    });
    return {
      managers: result.rows as unknown as ManagerType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching managers with pagination:", error);
    return { managers: [], total: 0 };
  }
}

export async function createManager(managerData: Omit<ManagerType, "id">) {
  try {
    const result = await turso.execute({
      sql: `INSERT INTO managers (client_id, name, email, phone, biography)
      VALUES (?, ?, ?, ?, ?)`,
      args: [
        managerData.client_id,
        managerData.name,
        managerData.email,
        managerData.phone,
        managerData.biography || "", // Asegurarnos de que nunca sea undefined
      ],
    });

    revalidatePath(`/clients/${managerData.client_id}`);

    return {
      id: Number(result.lastInsertRowid), // Convertir BigInt a Number
      ...managerData,
    };
  } catch (error) {
    console.error("Error creating manager:", error);
    throw error;
  }
}
