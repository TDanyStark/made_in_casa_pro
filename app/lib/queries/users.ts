import {turso} from '../db';
import { UserRole, UserType } from '../definitions';
import { ITEMS_PER_PAGE } from "@/config/constants";

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  rolId?: number;
}

export async function getUsers(params?: GetUsersParams) {
  try {
    const { page = 1, pageSize = 10, search = "" } = params || {};
    const offset = (page - 1) * pageSize;
    
    let whereClause = "";
    const args: (string | number)[] = [];
    
    if (search) {
      whereClause = `WHERE name LIKE ? OR email LIKE ?`;
      args.push(`%${search}%`, `%${search}%`);
    }
    
    // Consulta para obtener el total de registros
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await turso.execute({
      sql: countQuery,
      args,
    });
    
    const total = Number(countResult.rows[0].total);
    const pageCount = Math.ceil(total / pageSize);
    
    // Consulta principal con paginación
    const query = `
      SELECT * FROM users 
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;
    
    const result = await turso.execute({
      sql: query,
      args: [...args, pageSize, offset],
    });
    
    return {
      rows: result.rows,
      data: result.rows,
      pageCount,
      currentPage: page,
      total,
    };
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    throw new Error('No se pudieron obtener los usuarios');
  }
}

export async function getUserById(userId: number) {
  try {
    return await turso.execute({
      sql: `SELECT * FROM users WHERE id = ?`,
      args: [userId],
    });
  } catch (error) {
    console.error(`Error al obtener el usuario con ID ${userId}:`, error);
    throw new Error('No se pudo obtener el usuario');
  }
}

export async function getUserByEmail(email: string): Promise<UserType[]> {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM users WHERE email = ?`,
      args: [email],
    });
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      rol_id: row.rol_id as UserRole,
    })) as UserType[];
  } catch (error) {
    console.error(`Error al obtener el usuario con email ${email}:`, error);
    throw new Error('No se pudo obtener el usuario');
  }
}

export async function createUser(name: string, email: string, password: string, rol_id: number) {
  try {
    return await turso.execute({
      sql: `INSERT INTO users (name, email, password, rol_id) VALUES (?, ?, ?, ?)`,
      args: [name, email, password, rol_id],
    });
  } catch (error) {
    console.error('Error al crear el usuario:', error);
    throw new Error('No se pudo crear el usuario');
  }
}

export async function deleteUser(userId: number) {
  try {
    return await turso.execute({
      sql: `DELETE FROM users WHERE id = ?`,
      args: [userId],
    });
  } catch (error) {
    console.error(`Error al eliminar el usuario con ID ${userId}:`, error);
    throw new Error('No se pudo eliminar el usuario');
  }
}

export async function getUsersWithPagination({
  page = 1, 
  limit = ITEMS_PER_PAGE, 
  search,
  rolId
}: PaginationParams) {
  try {
    let sql = "SELECT id, name, email, rol_id, area_id, is_internal, must_change_password, last_login, is_active FROM users";
    const args = [];
    const countArgs = [];
    const conditions: string[] = [];

    if (rolId) {
      conditions.push("rol_id = ?");
      args.push(rolId);
      countArgs.push(rolId);
    }

    if (search) {
      conditions.push("(name LIKE ? OR email LIKE ?)");
      const searchParam = `%${search}%`;
      args.push(searchParam, searchParam);
      countArgs.push(searchParam, searchParam);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // Get total count for pagination
    let countSql = "SELECT COUNT(*) as count FROM users";
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
    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    // Execute query
    const result = await turso.execute({
      sql,
      args,
    });

    return {
      users: result.rows as unknown as UserType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching users with pagination:", error);
    return { users: [], total: 0, pageCount: 0, currentPage: page };
  }
}

export async function updateUser(userId: string, data: {
  name?: string;
  email?: string;
  password?: string;
  is_active?: boolean;
  rol_id?: number;
  must_change_password?: boolean;
}) {
  try {
    // Construir la consulta SQL dinámicamente basada en los campos proporcionados
    const updateFields: string[] = [];
    const args: (string | number | boolean)[] = [];

    if (data.name !== undefined) {
      updateFields.push('name = ?');
      args.push(data.name);
    }
    
    if (data.email !== undefined) {
      updateFields.push('email = ?');
      args.push(data.email);
    }
    
    if (data.password !== undefined) {
      updateFields.push('password = ?');
      args.push(data.password);
    }
    
    if (data.is_active !== undefined) {
      updateFields.push('is_active = ?');
      args.push(data.is_active);
    }
    
    if (data.rol_id !== undefined) {
      updateFields.push('rol_id = ?');
      args.push(data.rol_id);
    }
    
    if (data.must_change_password !== undefined) {
      updateFields.push('must_change_password = ?');
      args.push(data.must_change_password);
    }
    
    // Si no hay campos para actualizar, retornar
    if (updateFields.length === 0) {
      throw new Error('No se proporcionaron campos para actualizar');
    }
    
    // Añadir el ID al final de los argumentos
    args.push(userId);
    
    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `;
    
    await turso.execute({
      sql: query,
      args,
    });
    
    // Obtener el usuario actualizado
    const result = await turso.execute({
      sql: `SELECT id, name, email, rol_id, must_change_password, last_login, is_active FROM users WHERE id = ?`,
      args: [userId],
    });
    
    if (result.rows.length === 0) {
      throw new Error('No se encontró el usuario después de la actualización');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error(`Error al actualizar el usuario con ID ${userId}:`, error);
    throw new Error('No se pudo actualizar el usuario');
  }
}

