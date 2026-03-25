import { db } from "../db";
import { revalidatePath } from "next/cache";
import { ProductType } from "../definitions";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { buildWhereClause, buildPaginationArgs, parseTotal } from "../db/query-helpers";

export async function getProductById(id: number): Promise<ProductType | null> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          p.id,
          p.name,
          p.description,
          p.category_id,
          pc.name AS category_name,
          p.is_active,
          p.created_at
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.id = $1
      `,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProductType;
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    return null;
  }
}

export async function createProduct(data: {
  name: string;
  description?: string | null;
  category_id?: number | null;
  is_active?: number;
}): Promise<ProductType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO products (name, description, category_id, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      args: [
        data.name,
        data.description ?? null,
        data.category_id ?? null,
        data.is_active ?? 1,
      ],
    });
    const id = Number(result.rows[0]?.id);
    revalidatePath("/products");
    const created = await getProductById(id);
    return created!;
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

export async function updateProduct(
  id: number,
  data: Partial<{
    name: string;
    description: string | null;
    category_id: number | null;
    is_active: number;
  }>
): Promise<ProductType | null> {
  try {
    const updates: string[] = [];
    const args: unknown[] = [];

    if (data.name !== undefined) {
      args.push(data.name);
      updates.push(`name = $${args.length}`);
    }
    if (data.description !== undefined) {
      args.push(data.description);
      updates.push(`description = $${args.length}`);
    }
    if (data.category_id !== undefined) {
      args.push(data.category_id);
      updates.push(`category_id = $${args.length}`);
    }
    if (data.is_active !== undefined) {
      args.push(data.is_active);
      updates.push(`is_active = $${args.length}`);
    }

    if (updates.length === 0) return getProductById(id);

    args.push(id);
    await db.execute({
      sql: `UPDATE products SET ${updates.join(", ")} WHERE id = $${args.length}`,
      args,
    });

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return getProductById(id);
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
}

export async function getProductsWithPagination({
  page = 1,
  limit = ITEMS_PER_PAGE,
  search,
  categoryId,
  isActive,
}: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  isActive?: number;
}) {
  try {
    const { whereSQL, args } = buildWhereClause([
      { sql: "unaccent(p.name) ILIKE unaccent($)", value: search ? `%${search}%` : undefined },
      { sql: "p.category_id = $", value: categoryId },
      { sql: "p.is_active = $", value: isActive },
    ]);

    const baseJoin = `
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
    `;

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as count ${baseJoin}${whereSQL}`,
      args,
    });
    const total = parseTotal(countResult.rows as Record<string, unknown>[]);

    const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(args, page, limit);
    const result = await db.execute({
      sql: `
        SELECT
          p.id,
          p.name,
          p.description,
          p.category_id,
          pc.name AS category_name,
          p.is_active,
          p.created_at
        ${baseJoin}${whereSQL}
        ORDER BY p.name ASC
        LIMIT ${limitPH} OFFSET ${offsetPH}
      `,
      args: [...args, ...paginationArgs],
    });

    return {
      products: result.rows as unknown as ProductType[],
      total,
    };
  } catch (error) {
    console.error("Error fetching products with pagination:", error);
    return { products: [], total: 0 };
  }
}
