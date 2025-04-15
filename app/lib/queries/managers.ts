import {turso} from '../db';
import { revalidatePath } from "next/cache";
import { ManagerType } from '../definitions';

export async function getManagerByEmail(email: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE email = ?`,
      args: [email]
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ManagerType : null;
  }
  catch (error) {
    console.error("Error fetching manager by email:", error);
    return null;
  }
}

export async function getManagerById(id: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE id = ?`,
      args: [id]
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as ManagerType : null;
  } catch (error) {
    console.error("Error fetching manager:", error);
    return null;
  }
}

export async function getManagersByClientId(clientId: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM managers WHERE client_id = ? ORDER BY name ASC`,
      args: [clientId]
    });
    return result.rows as unknown as ManagerType[];
  } catch (error) {
    console.error("Error fetching managers by client ID:", error);
    return [];
  }
}

export async function getManagers() {
  try {
    return await turso.execute(`SELECT * FROM managers ORDER BY name ASC`);
  } catch (error) {
    console.error("Error fetching managers:", error);
    return [];
  }
}

export async function createManager(managerData: Omit<ManagerType, 'id'>) {
  try {
    const result = await turso.execute({
      sql: `INSERT INTO managers (client_id, name, email, phone, biography)
      VALUES (?, ?, ?, ?, ?)`,
      args: [
        managerData.client_id,
        managerData.name,
        managerData.email,
        managerData.phone,
        managerData.biography
      ]
    });
    
    revalidatePath(`/clients/${managerData.client_id}`);
    
    return {
      id: result.lastInsertRowid,
      ...managerData
    };
  } catch (error) {
    console.error("Error creating manager:", error);
    throw error;
  }
}