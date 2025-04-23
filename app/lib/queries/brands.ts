import {turso} from '../db';
import { revalidatePath } from "next/cache";
import { BrandType } from '../definitions';
import { getManagerById } from './managers';
import { ITEMS_PER_PAGE } from '@/config/constants';

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

interface PaginationParams {
  managerId?: string;
  clientId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function getBrandsWithPagination({
  managerId,
  clientId,
  page = 1,
  limit = ITEMS_PER_PAGE,
  search
}: PaginationParams) {
  try {
    let sql = 'SELECT brands.*, managers.name as manager_name, managers.email as manager_email FROM brands JOIN managers ON brands.manager_id = managers.id';
    const args = [];
    const countArgs = [];
    
    // Build WHERE clause
    const conditions: string[] = [];
    
    if (managerId) {
      conditions.push('brands.manager_id = ?');
      args.push(managerId);
      countArgs.push(managerId);
    }

    if (clientId) {
      conditions.push('managers.client_id = ?');
      args.push(clientId);
      countArgs.push(clientId);
    }
    
    if (search) {
      conditions.push('(brands.name LIKE ?)');
      const searchParam = `%${search}%`;
      args.push(searchParam);
      countArgs.push(searchParam);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as count FROM brands JOIN managers ON brands.manager_id = managers.id';
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await turso.execute({
      sql: countSql,
      args: countArgs
    });
    
    const total = Number(countResult.rows[0].count);
    
    // Add pagination
    const offset = (page - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    args.push(limit, offset);

    // Execute query
    const result = await turso.execute({
      sql,
      args
    });
    
    // Transform the result to match BrandType with manager property
    const brands = result.rows.map((row) => ({
      id: row.id,
      manager_id: row.manager_id,
      name: row.name,
      manager_name: row.manager_name,
    })) as BrandType[];
    
    return {
      brands,
      total
    };
  } catch (error) {
    console.error("Error fetching brands with pagination:", error);
    return { brands: [], total: 0 };
  }
}