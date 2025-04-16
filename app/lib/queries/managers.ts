import {turso} from '../db';
import { revalidatePath } from "next/cache";
import { ManagerType } from '../definitions';

export async function getManagerByEmail(email: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE email = ?`,
      args: [email]
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ManagerType : null;
  }
  catch (error) {
    console.error("Error fetching manager by email:", error);
    return null;
  }
}

export async function getManagerById(id: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE id = ?`,
      args: [id]
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ManagerType : null;
  } catch (error) {
    console.error("Error fetching manager:", error);
    return null;
  }
}

export async function getManagersByClientId(clientId: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE client_id = ? ORDER BY name ASC`,
      args: [clientId]
    });
    return result.rows as unknown as ManagerType[];
  } catch (error) {
    console.error("Error fetching managers by client ID:", error);
    return [];
  }
}

export async function getManagers() {
  try {
    const result = await turso.execute(`SELECT * FROM managers ORDER BY name ASC`);
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

export async function getManagersWithPagination({
  clientId,
  page = 1,
  limit = 10,
  search
}: PaginationParams) {
  try {
    let sql = 'SELECT * FROM managers';
    const args = [];
    const countArgs = [];
    
    // Build WHERE clause
    const conditions: string[] = [];
    
    if (clientId) {
      conditions.push('client_id = ?');
      args.push(clientId);
      countArgs.push(clientId);
    }
    
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const searchParam = `%${search}%`;
      args.push(searchParam, searchParam, searchParam);
      countArgs.push(searchParam, searchParam, searchParam);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as count FROM managers';
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await turso.execute({
      sql: countSql,
      args: countArgs
    });
    
    const total = Number(countResult.rows[0].count);
    
    // Add pagination
    const offset = (page - 1) * limit;
    sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    args.push(limit, offset);

    console.log(sql, args);
    
    // Execute query
    const result = await turso.execute({
      sql,
      args
    });
    
    return {
      managers: result.rows as unknown as ManagerType[],
      total
    };
  } catch (error) {
    console.error("Error fetching managers with pagination:", error);
    return { managers: [], total: 0 };
  }
}

export async function createManager(managerData: Omit<ManagerType, 'id'>) {
  try {
    const result = await turso.execute({
      sql: `INSERT INTO managers (client_id, name, email, phone, biography)
      VALUES (?, ?, ?, ?, ?)`,
      args: [
        managerData.client_id,
        managerData.name,
        managerData.email,
        managerData.phone,
        managerData.biography || '' // Asegurarnos de que nunca sea undefined
      ]
    });
    
    revalidatePath(`/clients/${managerData.client_id}`);
    
    return {
      id: Number(result.lastInsertRowid), // Convertir BigInt a Number
      ...managerData
    };
  } catch (error) {
    console.error("Error creating manager:", error);
    throw error;
  }
}