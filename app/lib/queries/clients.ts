import {turso} from '../db';
import { ClientType } from '../definitions';
import { ITEMS_PER_PAGE } from '@/config/constants';

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
        SELECT c.id, c.name, co.id AS country_id, co.name AS country_name, co.flag AS country_flag
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

// Managers