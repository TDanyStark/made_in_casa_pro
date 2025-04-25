import {turso} from '../db';
import { revalidatePath } from "next/cache";
import { BrandType } from '../definitions';
import { getManagerById } from './managers';
import { ITEMS_PER_PAGE } from '@/config/constants';

export async function getBrandsByManagerId(managerId: string) {
  try {
    const result = await turso.execute({
      sql: `
        SELECT 
          bm.brand_id as id,
          b.name as name,
          bm.manager_id as manager_id
        FROM brand_manager bm
        JOIN brands b ON bm.brand_id = b.id
        WHERE bm.manager_id = ? 
        ORDER BY b.name ASC
      `,
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
      sql: `
        SELECT 
          b.id as id,
          b.name as name,
          bm.manager_id,
          m.name as manager_name,
          m.email as manager_email,
          m.phone as manager_phone,
          c.id as client_id,
          c.name as client_name,
          co.id as country_id,
          co.name as country_name,
          co.flag as country_flag
        FROM brands b
        JOIN brand_manager bm ON b.id = bm.brand_id
        JOIN managers m ON bm.manager_id = m.id
        JOIN clients c ON m.client_id = c.id
        LEFT JOIN countries co ON c.country_id = co.id
        WHERE b.id = ?
      `,
      args: [id]
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    
    return {
      id: row.id,
      name: row.name,
      manager_id: row.manager_id,
      manager: {
        id: row.manager_id,
        client_id: row.client_id,
        name: row.manager_name,
        email: row.manager_email,
        phone: row.manager_phone,
        client_info: {
          id: row.client_id,
          name: row.client_name,
          country: row.country_id ? {
            id: row.country_id,
            name: row.country_name,
            flag: row.country_flag
          } : undefined
        }
      }
    } as BrandType;
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
    // Use the turso transaction API instead of manual BEGIN/COMMIT/ROLLBACK
    const transaction = await turso.transaction('write');
    
    try {
      // 1. Crear el brand
      const brandResult = await transaction.execute({
        sql: `INSERT INTO brands (name)
        VALUES (?)`,
        args: [
          brandData.name
        ]
      });
      
      const brandId = Number(brandResult.lastInsertRowid);
      
      // 2. Crear la relación en la tabla brand_manager
      await transaction.execute({
        sql: `INSERT INTO brand_manager (brand_id, manager_id)
        VALUES (?, ?)`,
        args: [
          brandId,
          brandData.manager_id
        ]
      });
      
      // Commit the transaction
      await transaction.commit();
      
      const manager = await getManagerById(brandData.manager_id.toString());
      // Revalidamos la ruta del cliente al que pertenece el manager
      if (manager && manager.client_id) {
        revalidatePath(`/clients/${manager.client_id}`);
      }
      
      return {
        id: brandId,
        ...brandData
      };
    } catch (error) {
      // If any error occurs during the transaction, roll it back
      await transaction.rollback();
      throw error;
    }
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
    // Modified query to use brand_manager table
    let sql = `
      SELECT bm.brand_id as id, b.name as brand_name, 
             bm.manager_id, m.name as manager_name 
      FROM brand_manager bm
      JOIN brands b ON bm.brand_id = b.id
      JOIN managers m ON bm.manager_id = m.id
    `;
    const args = [];
    const countArgs = [];
    
    // Build WHERE clause
    const conditions: string[] = [];
    
    if (managerId) {
      conditions.push('bm.manager_id = ?');
      args.push(managerId);
      countArgs.push(managerId);
    }

    if (clientId) {
      conditions.push('m.client_id = ?');
      args.push(clientId);
      countArgs.push(clientId);
    }
    
    if (search) {
      conditions.push('(b.name LIKE ? OR m.name LIKE ?)');
      const searchParam = `%${search}%`;
      args.push(searchParam, searchParam);
      countArgs.push(searchParam, searchParam);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as count 
      FROM brand_manager bm
      JOIN brands b ON bm.brand_id = b.id
      JOIN managers m ON bm.manager_id = m.id
    `;
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await turso.execute({
      sql: countSql,
      args: countArgs
    });
    
    const total = Number(countResult.rows[0].count);
    
    // Add order by and pagination
    sql += ' ORDER BY b.name ASC LIMIT ? OFFSET ?';
    const offset = (page - 1) * limit;
    args.push(limit, offset);

    // Execute query
    const result = await turso.execute({
      sql,
      args
    });
    
    // Transform the result to match BrandsAndManagersType
    const brands = result.rows.map((row) => ({
      id: row.id,
      brand_name: row.brand_name,
      manager_id: row.manager_id,
      manager_name: row.manager_name,
    }));
    
    return {
      brands,
      total
    };
  } catch (error) {
    console.error("Error fetching brands with pagination:", error);
    return { brands: [], total: 0 };
  }
}