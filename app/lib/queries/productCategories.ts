import { db } from "../db";
import { revalidatePath } from "next/cache";
import { ProductCategoryType } from "../definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { buildWhereClause, buildPaginationArgs, parseTotal } from "../db/query-helpers";

export async function getProductCategories(): Promise<ProductCategoryType[]> {
  try {
    const result = await db.execute(
      `SELECT id, name FROM product_categories ORDER BY name ASC`
    );
    return result.rows as unknown as ProductCategoryType[];
  } catch (error) {
    console.error("Error fetching product categories:", error);
    return [];
  }
}

export async function getProductCategoryById(id: number): Promise<ProductCategoryType | null> {
  try {
    const result = await db.execute({
      sql: `SELECT id, name FROM product_categories WHERE id = $1`,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProductCategoryType;
  } catch (error) {
    console.error("Error fetching product category by ID:", error);
    return null;
  }
}

export async function createProductCategory(name: string): Promise<ProductCategoryType> {
  try {
    const result = await db.execute({
      sql: `INSERT INTO product_categories (name) VALUES ($1) RETURNING id`,
      args: [name],
    });
    const id = Number(result.rows[0]?.id);
    revalidatePath("/products");
    return { id, name };
  } catch (error) {
    console.error("Error creating product category:", error);
    throw error;
  }
}

export async function updateProductCategory(id: number, name: string): Promise<ProductCategoryType | null> {
  try {
    await db.execute({
      sql: `UPDATE product_categories SET name = $1 WHERE id = $2`,
      args: [name, id],
    });
    revalidatePath("/products");
    return getProductCategoryById(id);
  } catch (error) {
    console.error("Error updating product category:", error);
    throw error;
  }
}

export async function getProductCategoriesWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  try {
    const { whereSQL, args } = buildWhereClause([
      { sql: "unaccent(name) ILIKE unaccent($)", value: search ? `%${search}%` : undefined },
    ]);

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM product_categories${whereSQL}`,
      args,
    });
    const total = parseTotal(countResult.rows as Record<string, unknown>[]);

    const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(args, page, limit);
    const result = await db.execute({
      sql: `SELECT id, name FROM product_categories${whereSQL} ORDER BY name ASC LIMIT ${limitPH} OFFSET ${offsetPH}`,
      args: [...args, ...paginationArgs],
    });

    return {
      categories: result.rows as unknown as ProductCategoryType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching product categories with pagination:", error);
    return { categories: [], total: 0 };
  }
}
