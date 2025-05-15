import { turso } from '../db';

export async function getRoles() {
  try {
    return await turso.execute(`SELECT * FROM roles`);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    throw new Error('No se pudieron obtener los roles');
  }
}

export async function getRoleById(roleId: number) {
  try {
    return await turso.execute({
      sql: `SELECT * FROM roles WHERE id = ?`,
      args: [roleId],
    });
  } catch (error) {
    console.error(`Error al obtener el rol con ID ${roleId}:`, error);
    throw new Error('No se pudo obtener el rol');
  }
}

export async function createRole(role: string) {
  try {
    return await turso.execute({
      sql: `INSERT INTO roles (role) VALUES (?)`,
      args: [role],
    });
  } catch (error) {
    console.error('Error al crear el rol:', error);
    throw new Error('No se pudo crear el rol');
  }
}
