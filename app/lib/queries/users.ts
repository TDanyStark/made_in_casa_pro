import {turso} from '../db';
import { UserRole, UserType } from '../definitions';

export async function getUsers() {
  try {
    return await turso.execute(`SELECT * FROM users`);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    throw new Error('No se pudieron obtener los usuarios'); // Lanza un error controlado
  }
}

export async function getUserById(userId: number) {
  try {
    return await turso.execute({
      sql: `SELECT * FROM users WHERE id = ?`,
      args: [userId],
    });
  } catch (error) {
    console.error(`Error al obtener el usuario con ID ${userId}:`, error);
    throw new Error('No se pudo obtener el usuario');
  }
}

export async function getUserByEmail(email: string): Promise<UserType[]> {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM users WHERE email = ?`,
      args: [email],
    });
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      rol_id: row.rol_id as UserRole,
    })) as UserType[];
  } catch (error) {
    console.error(`Error al obtener el usuario con email ${email}:`, error);
    throw new Error('No se pudo obtener el usuario');
  }
}

export async function createUser(name: string, email: string, password: string) {
  try {
    return await turso.execute({
      sql: `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
      args: [name, email, password],
    });
  } catch (error) {
    console.error('Error al crear el usuario:', error);
    throw new Error('No se pudo crear el usuario');
  }
}

export async function deleteUser(userId: number) {
  try {
    return await turso.execute({
      sql: `DELETE FROM users WHERE id = ?`,
      args: [userId],
    });
  } catch (error) {
    console.error(`Error al eliminar el usuario con ID ${userId}:`, error);
    throw new Error('No se pudo eliminar el usuario');
  }
}

