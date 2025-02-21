import {turso} from '../db';

export async function getCountries() {
  try {
    return await turso.execute(`SELECT * FROM countries`);
  } catch (error) {
    console.error('Error al obtener países:', error);
    throw new Error('No se pudieron obtener los países');
  }
}