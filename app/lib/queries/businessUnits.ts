import { db } from "../db";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { BusinessUnitType } from "../definitions";



export async function getBusinessUnitById(id: string) {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, name
        FROM business_units
        WHERE id = $1
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as BusinessUnitType;
  } catch (error) {
    console.error("Error fetching business unit:", error);
    return null;
  }
}

export async function getBusinessUnits() {
  try {
    const result = await db.execute(
      `SELECT * FROM business_units ORDER BY name ASC`
    );
    return result.rows as unknown as BusinessUnitType[];
  } catch (error) {
    console.error("Error fetching business units:", error);
    return [];
  }
}

export async function createBusinessUnit(businessUnitData: Omit<BusinessUnitType, "id">) {
  try {
    const result = await db.execute({
      sql: `INSERT INTO business_units (name)
      VALUES ($1) RETURNING id`,
      args: [businessUnitData.name],
    });

    const businessUnitId = Number(result.rows[0]?.id);

    return {
      id: businessUnitId,
      ...businessUnitData,
    };
  } catch (error) {
    console.error("Error creating business unit:", error);
    throw error;
  }
}

export async function updateBusinessUnit(id: string, updateData: Partial<BusinessUnitType>) {
  try {
    const { name } = updateData;
    
    if (name) {
      await db.execute({
        sql: `UPDATE business_units SET name = $1 WHERE id = $2`,
        args: [name, id],
      });
      
    }

    // Return the updated business unit
    return getBusinessUnitById(id);
  } catch (error) {
    console.error("Error updating business unit:", error);
    throw error;
  }
}

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getBusinessUnitsWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
}: PaginationParams) {
  try {
    let sql = `
      SELECT id, name
      FROM business_units
    `;
    const args = [];
    const countArgs = [];

    // Build WHERE clause for search
    if (search) {
      sql += ` WHERE unaccent(name) ILIKE unaccent($1)`;
      const searchParam = `%${search}%`;
      args.push(searchParam);
      countArgs.push(searchParam);
    }

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as count FROM business_units`;
    if (search) {
      countSql += ` WHERE unaccent(name) ILIKE unaccent($1)`;
    }

    const countResult = await db.execute({
      sql: countSql,
      args: countArgs,
    });

    const total = Number(countResult.rows[0].count);

    // Add order by and pagination
    const limitPlaceholder = search ? "$2" : "$1";
    const offsetPlaceholder = search ? "$3" : "$2";
    sql += ` ORDER BY name ASC LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
    const offset = (page - 1) * limit;
    args.push(limit, offset);

    // Execute query
    const result = await db.execute({
      sql,
      args,
    });

    // Transform the result
    const businessUnits = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));

    return {
      businessUnits,
      total,
    };
  } catch (error) {
    console.error("Error fetching business units with pagination:", error);
    return { businessUnits: [], total: 0 };
  }
}

export async function deleteBusinessUnit(id: string) {
  try {
    await db.execute({
      sql: `DELETE FROM business_units WHERE id = $1`,
      args: [id],
    });
    
    return true;
  } catch (error) {
    console.error("Error deleting business unit:", error);
    throw error;
  }
}