import {turso} from '../db';
import { ClientType } from '../definitions';
import { ITEMS_PER_PAGE } from '@/config/constants';
import { revalidatePath } from "next/cache";

export async function getClients() {
  try {
    return await turso.execute(`SELECT * FROM clients`);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}

export async function createClient(name: string, country_id: number) {
  try {
    return await turso.execute({
      sql: `INSERT INTO clients (name, country_id) VALUES (?, ?)`,
      args: [name, country_id],
    });
  } catch (error) {
    throw new Error(String(error));
  }
}

export async function fetchFilteredClients(): Promise<ClientType[]> {
  try {
    const clients = await turso.execute(`
        SELECT c.id, c.name, co.id AS country_id, co.name AS country_name, co.flag AS country_flag
        FROM clients c
        LEFT JOIN countries co ON c.country_id = co.id
      `);

    return clients.rows.map((row) => ({
      id: Number(row.id), // Ensure id is a number
      name: String(row.name || ''), // Ensure name is a string
      country: row.country_id ? {
        id: Number(row.country_id), // Ensure country_id is a number
        name: String(row.country_name || ''), // Ensure country_name is a string
        flag: String(row.country_flag || ''), // Ensure country_flag is a string
      } : undefined,
    }));
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}

export async function getClientById(id: string): Promise<ClientType | null> {
  try {
    const client = await turso.execute({
      sql: `
        SELECT c.id, c.name, co.id AS country_id, co.name AS country_name, c.accept_business_units, co.flag AS country_flag
        FROM clients c
        LEFT JOIN countries co ON c.country_id = co.id
        WHERE c.id = ?
      `,
      args: [id],
    });

    if (client.rows.length > 0) {
      const row = client.rows[0];
      return {
        id: row.id,
        name: String(row.name || ''), // Ensure name is a string
        accept_business_units: Boolean(row.accept_business_units),
        country: row.country_id ? {
          id: row.country_id,
          name: String(row.country_name || ''), // Ensure country_name is a string
          flag: String(row.country_flag || ''), // Ensure country_flag is a string
        } : undefined,
      } as ClientType;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener cliente por ID:', error);
    throw new Error('No se pudo obtener el cliente');
  }
}

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getClientsWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search
}: PaginationParams) {
  try {
    let sql = `
      SELECT c.id, c.name, co.id AS country_id, co.name AS country_name, co.flag AS country_flag
      FROM clients c
      LEFT JOIN countries co ON c.country_id = co.id
    `;
    const args = [];
    const countArgs = [];
    
    // Build WHERE clause
    const conditions: string[] = [];
    
    if (search) {
      conditions.push('(c.name LIKE ? OR co.name LIKE ?)');
      const searchParam = `%${search}%`;
      args.push(searchParam, searchParam);
      countArgs.push(searchParam, searchParam);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as count FROM clients c LEFT JOIN countries co ON c.country_id = co.id';
    
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
    sql += ' ORDER BY c.name ASC LIMIT ? OFFSET ?';
    args.push(limit, offset);

    // Execute query
    const result = await turso.execute({
      sql,
      args
    });
    
    const clients = result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name || ''),
      country: row.country_id ? {
        id: Number(row.country_id),
        name: String(row.country_name || ''),
        flag: String(row.country_flag || ''),
      } : undefined,
    }));
    
    return {
      clients,
      total
    };
  } catch (error) {
    console.error("Error fetching clients with pagination:", error);
    return { clients: [], total: 0 };
  }
}

export async function updateClient(id: string, updateData: { 
  name?: string; 
  country_id?: number;
  accept_business_units?: boolean;
}) {
  try {
    // Construir la consulta de actualización basada en los campos proporcionados
    const updates: string[] = [];
    const args = [];

    if (updateData.name !== undefined) {
      updates.push("name = ?");
      args.push(updateData.name);
    }

    if (updateData.country_id !== undefined) {
      updates.push("country_id = ?");
      args.push(updateData.country_id);
    }

    if (updateData.accept_business_units !== undefined) {
      updates.push("accept_business_units = ?");
      args.push(updateData.accept_business_units ? 1 : 0); // Convertir boolean a 1/0 para SQLite
    }

    // Si no hay campos para actualizar, devolver null
    if (updates.length === 0) {
      return null;
    }

    // Añadir el ID al final de los argumentos para la cláusula WHERE
    args.push(id);

    // Ejecutar la consulta de actualización
    await turso.execute({
      sql: `UPDATE clients SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    // Revalidar rutas
    revalidatePath(`/clients/${id}`);

    // Obtener y devolver el cliente actualizado
    return getClientById(id);
  } catch (error) {
    console.error("Error updating client:", error);
    throw error;
  }
}

// Managers