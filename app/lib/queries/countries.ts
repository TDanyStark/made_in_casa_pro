import {db} from '../db';

export async function getCountries() {
  try {
    return await db.execute(`SELECT * FROM countries`);
  } catch (error) {
    console.error('Error al obtener países:', error);
    throw new Error('No se pudieron obtener los países');
  }
}

export async function createCountry(name: string, flag: string) {
  try {
    return await db.execute({
      sql: `INSERT INTO countries (name, flag) VALUES ($1, $2)`,
      args: [name, flag],
    });
  } catch (error) {
    throw new Error(String(error));
  }
}