import { ITEMS_PER_PAGE } from '@/config/constants';
import { turso } from '../db';


export async function getFilteredItems<T>(table: string, query: string, currentPage: number) {
  try {
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new Error('Invalid table name');
    }
    // get the count of clients
    const pagesQuery = await turso.execute({
      sql: `SELECT COUNT(*) as count FROM ${table} WHERE name LIKE ?`,
      args: [`%${query}%`],
    });

    const countValue = pagesQuery.rows[0]?.count;
    if (typeof countValue !== 'number') {
      throw new Error('Count value is not a number');
    }
    const pages = Math.ceil(countValue / ITEMS_PER_PAGE);
    const items =  await turso.execute({
      sql: `SELECT * FROM ${table} WHERE name LIKE ? LIMIT 10 OFFSET ?`,
      args: [`%${query}%`, (currentPage - 1) * 10],
    });

    return { items: items.rows as T[], pages };
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}