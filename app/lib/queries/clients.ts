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

export async function fetchFilteredClients() {
  try {

    const clients = await turso.execute(`
        SELECT c.id, c.name, co.name AS country_name, co.flag AS country_flag
        FROM clients c
        JOIN countries co ON c.country_id = co.id
      `);

    return {
      clients: clients.rows,
    }
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}