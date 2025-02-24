import {turso} from '../db';

export async function getCountries() {
  try {
    return await turso.execute(`SELECT * FROM countries`);
  } catch (error) {
    console.error('Error al obtener países:', error);
    throw new Error('No se pudieron obtener los países');
  }
}

export async function createCountry(name: string, flag: string) {
  try {
    return await turso.execute({
      sql: `INSERT INTO countries (name, flag) VALUES (?, ?)`,
      args: [name, flag],
    });
  } catch (error) {
    throw new Error(String(error));
  }
}