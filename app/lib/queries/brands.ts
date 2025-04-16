import {turso} from '../db';
import { revalidatePath } from "next/cache";
import { BrandType } from '../definitions';
import { getManagerById } from './managers';

// Esta función ya no es necesaria ya que obtendremos las marcas por manager_id
// y el manager ya tiene la relación con el cliente
// export async function getBrandsByClientId(clientId: string) { ... }

export async function getBrandsByManagerId(managerId: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM brands WHERE manager_id = ? ORDER BY name ASC`,
      args: [managerId]
    });
    return result.rows as unknown as BrandType[];
  } catch (error) {
    console.error("Error fetching brands by manager ID:", error);
    return [];
  }
}

export async function getBrandById(id: string) {
  try {
    const result = await turso.execute({
      sql: `SELECT * FROM brands WHERE id = ?`,
      args: [id]
    });
    return result.rows.length > 0 ? result.rows[0] as unknown as BrandType : null;
  } catch (error) {
    console.error("Error fetching brand:", error);
    return null;
  }
}

export async function getBrands() {
  try {
    const result = await turso.execute(`SELECT * FROM brands ORDER BY name ASC`);
    return result.rows as unknown as BrandType[];
  } catch (error) {
    console.error("Error fetching brands:", error);
    return [];
  }
}

export async function createBrand(brandData: Omit<BrandType, 'id'>) {
  try {
    console.log("Brand data:", brandData);
    
    const result = await turso.execute({
      sql: `INSERT INTO brands (manager_id, name)
      VALUES (?, ?)`,
      args: [
        brandData.manager_id,
        brandData.name
      ]
    });
    
    const manager = await getManagerById(brandData.manager_id.toString());
    // Revalidamos la ruta del cliente al que pertenece el manager
    if (manager && manager.client_id) {
      revalidatePath(`/clients/${manager.client_id}`);
    }
    
    return {
      id: Number(result.lastInsertRowid), // Convertir BigInt a Number
      ...brandData
    };
  } catch (error) {
    console.error("Error creating brand:", error);
    throw error;
  }
}