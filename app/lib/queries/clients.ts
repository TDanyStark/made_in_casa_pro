import { ITEMS_PER_PAGE } from '@/config/constants';
import {turso} from '../db';

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

export async function fetchFilteredClients(query: string, currentPage: number) {
  try {
    // get the count of clients
    const count = await turso.execute({
      sql: `SELECT COUNT(*) as count FROM clients WHERE name LIKE ?`,
      args: [`%${query}%`],
    });

    const countValue = count.rows[0]?.count;
    if (typeof countValue !== 'number') {
      throw new Error('Count value is not a number');
    }
    const pages = Math.ceil(countValue / ITEMS_PER_PAGE);
    const clients = await turso.execute({
      sql: `
        SELECT c.id, c.name, co.name AS country_name, co.flag AS country_flag
        FROM clients c
        JOIN countries co ON c.country_id = co.id
        WHERE c.name LIKE ?
        LIMIT ${ITEMS_PER_PAGE} OFFSET ?
      `,
      args: [`%${query}%`, (currentPage - 1) * ITEMS_PER_PAGE],
    });

    return {
      clients: clients.rows,
      pages,
    }
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}