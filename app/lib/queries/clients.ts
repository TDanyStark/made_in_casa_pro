import {turso} from '../db';

export async function getClients() {
  try {
    return await turso.execute(`SELECT * FROM clients`);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    throw new Error('No se pudieron obtener los clientes');
  }
}