import {db} from '../db';
import { UserRole, UserType } from '../definitions';
import { ITEMS_PER_PAGE } from "@/config/constants";
import { LEADERSHIP_ROLES } from '@/lib/role-groups';

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  rolId?: number | number[];
  withTaskCount?: boolean;
}

export async function getUsers(params?: GetUsersParams) {
  try {
    const { page = 1, pageSize = 10, search = "" } = params || {};
    const offset = (page - 1) * pageSize;
    
    let whereClause = "";
    const args: (string | number)[] = [];
    
    if (search) {
      whereClause = `WHERE unaccent(name) ILIKE unaccent($1) OR unaccent(email) ILIKE unaccent($2)`;
      args.push(`%${search}%`, `%${search}%`);
    }
    
    // Consulta para obtener el total de registros
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await db.execute({
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
      LIMIT ${search ? "$3" : "$1"} OFFSET ${search ? "$4" : "$2"}
    `;
    
    const result = await db.execute({
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
    const result = await db.execute({
      sql: `SELECT * FROM users WHERE id = $1`,
      args: [userId],
    });
    const row = result.rows[0];
    if (!row) {
      throw new Error('Usuario no encontrado');
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      rol_id: row.rol_id as UserRole,
      area_id: row.area_id,
      is_internal: Boolean(row.is_internal),
      is_active: Boolean(row.is_active),
      monthly_salary: row.monthly_salary,
      must_change_password: Boolean(row.must_change_password),
      last_login: row.last_login,
      created_at: row.created_at,
    } as UserType;
  } catch (error) {
    console.error(`Error al obtener el usuario con ID ${userId}:`, error);
    throw new Error('No se pudo obtener el usuario');
  }
}

export async function getUserByEmail(email: string): Promise<UserType[]> {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM users WHERE email = $1`,
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
    return await db.execute({
      sql: `INSERT INTO users (name, email, password, rol_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      args: [name, email, password, rol_id],
    });
  } catch (error) {
    console.error('Error al crear el usuario:', error);
    throw new Error('No se pudo crear el usuario');
  }
}

export async function deleteUser(userId: number) {
  try {
    return await db.execute({
      sql: `DELETE FROM users WHERE id = $1`,
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
  rolId,
  withTaskCount = false,
}: PaginationParams) {
  try {
    const taskCountSelect = withTaskCount
      ? `, (SELECT COUNT(*) FROM project_tasks pt WHERE pt.assigned_user_id = users.id AND pt.status != 'completed') AS pending_tasks_count`
      : "";
    let sql = `SELECT id, name, email, rol_id, area_id, is_internal, must_change_password, last_login, is_active${taskCountSelect} FROM users`;
    const filterArgs: Array<string | number> = [];
    const conditions: string[] = [];

    if (rolId) {
      if (Array.isArray(rolId)) {
        const placeholders = rolId.map((_, i) => `$${filterArgs.length + i + 1}`);
        conditions.push(`rol_id IN (${placeholders.join(", ")})`);
        filterArgs.push(...rolId);
      } else {
        filterArgs.push(rolId);
        conditions.push(`rol_id = $${filterArgs.length}`);
      }
    }

    if (search) {
      const searchParam = `%${search}%`;
      filterArgs.push(searchParam);
      const firstSearch = filterArgs.length;
      filterArgs.push(searchParam);
      const secondSearch = filterArgs.length;
      conditions.push(`(unaccent(name) ILIKE unaccent($${firstSearch}) OR unaccent(email) ILIKE unaccent($${secondSearch}))`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // Get total count for pagination
    let countSql = "SELECT COUNT(*) as count FROM users";
    if (conditions.length > 0) {
      countSql += " WHERE " + conditions.join(" AND ");
    }

    const countResult = await db.execute({
      sql: countSql,
      args: filterArgs,
    });

    const total = Number(countResult.rows[0].count);

    // Add pagination
    const offset = (page - 1) * limit;
    const args = [...filterArgs, limit, offset];
    const limitPlaceholder = `$${filterArgs.length + 1}`;
    const offsetPlaceholder = `$${filterArgs.length + 2}`;
    sql += ` ORDER BY id DESC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

    // Execute query
    const result = await db.execute({
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
  is_internal?: boolean;
  area_id?: number;
  monthly_salary?: number;
}) {
  try {
    // Construir la consulta SQL dinámicamente basada en los campos proporcionados
    const updateFields: string[] = [];
    const args: (string | number | boolean)[] = [];

    if (data.name !== undefined) {
      args.push(data.name);
      updateFields.push(`name = $${args.length}`);
    }
    
    if (data.email !== undefined) {
      args.push(data.email);
      updateFields.push(`email = $${args.length}`);
    }
    
    if (data.password !== undefined) {
      args.push(data.password);
      updateFields.push(`password = $${args.length}`);
    }
    
    if (data.is_active !== undefined) {
      args.push(data.is_active ? 1 : 0);
      updateFields.push(`is_active = $${args.length}`);
    }
    
    if (data.rol_id !== undefined) {
      args.push(data.rol_id);
      updateFields.push(`rol_id = $${args.length}`);
    }

    if (data.is_internal !== undefined) {
      args.push(data.is_internal ? 1 : 0);
      updateFields.push(`is_internal = $${args.length}`);
    }

    if (data.area_id !== undefined) {
      args.push(data.area_id);
      updateFields.push(`area_id = $${args.length}`);
    }
    
    if (data.must_change_password !== undefined) {
      args.push(data.must_change_password ? 1 : 0);
      updateFields.push(`must_change_password = $${args.length}`);
    }
    if (data.monthly_salary !== undefined) {
      args.push(data.monthly_salary);
      updateFields.push(`monthly_salary = $${args.length}`);
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
      WHERE id = $${args.length}
    `;
    
    await db.execute({
      sql: query,
      args,
    });
    
    // Obtener el usuario actualizado
    const result = await db.execute({
      sql: `SELECT * FROM users WHERE id = $1`,
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

/**
 * Returns the emails of all active leadership users (admin, directivo, financiero).
 * Used to auto-share Drive folders when a project is created.
 */
export async function getAdminAndLeadershipEmails(): Promise<string[]> {
  try {
    const rolePlaceholders = LEADERSHIP_ROLES.map((_, index) => `$${index + 1}`).join(', ');
    const result = await db.execute({
      sql: `SELECT email FROM users WHERE rol_id IN (${rolePlaceholders}) AND is_active = 1 AND email IS NOT NULL ORDER BY name ASC`,
      args: [...LEADERSHIP_ROLES],
    });
    return result.rows.map((r) => r.email as string).filter(Boolean);
  } catch (error) {
    console.error("Error fetching leadership emails:", error);
    return [];
  }
}

