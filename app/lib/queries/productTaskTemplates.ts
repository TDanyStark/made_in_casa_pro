import { db } from "../db";
import { revalidatePath } from "next/cache";
import { ProductTaskTemplateType } from "../definitions";

export async function getTaskTemplatesByProductId(
  productId: number
): Promise<ProductTaskTemplateType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          ptt.id,
          ptt.product_id,
          ptt.title,
          ptt.description,
          ptt.area_id,
          a.name  AS area_name,
          ptt.assigned_user_id,
          u.name  AS assigned_user_name,
          ptt.order_index,
          ptt.task_type,
          ptt.requires_quote,
          ptt.created_at
        FROM product_task_templates ptt
        LEFT JOIN areas a ON ptt.area_id = a.id
        LEFT JOIN users u ON ptt.assigned_user_id = u.id
        WHERE ptt.product_id = $1
        ORDER BY ptt.order_index ASC, ptt.id ASC
      `,
      args: [productId],
    });
    return result.rows as unknown as ProductTaskTemplateType[];
  } catch (error) {
    console.error("Error fetching task templates by product ID:", error);
    return [];
  }
}

export async function getTaskTemplateById(id: number): Promise<ProductTaskTemplateType | null> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          ptt.id,
          ptt.product_id,
          ptt.title,
          ptt.description,
          ptt.area_id,
          a.name  AS area_name,
          ptt.assigned_user_id,
          u.name  AS assigned_user_name,
          ptt.order_index,
          ptt.task_type,
          ptt.requires_quote,
          ptt.created_at
        FROM product_task_templates ptt
        LEFT JOIN areas a ON ptt.area_id = a.id
        LEFT JOIN users u ON ptt.assigned_user_id = u.id
        WHERE ptt.id = $1
      `,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProductTaskTemplateType;
  } catch (error) {
    console.error("Error fetching task template by ID:", error);
    return null;
  }
}

export async function createTaskTemplate(data: {
  product_id: number;
  title: string;
  description?: string | null;
  area_id?: number | null;
  assigned_user_id?: number | null;
  order_index: number;
  task_type?: string;
  requires_quote?: number;
}): Promise<ProductTaskTemplateType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO product_task_templates
          (product_id, title, description, area_id, assigned_user_id, order_index, task_type, requires_quote)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      args: [
        data.product_id,
        data.title,
        data.description ?? null,
        data.area_id ?? null,
        data.assigned_user_id ?? null,
        data.order_index,
        data.task_type ?? "execution",
        data.requires_quote ?? 0,
      ],
    });
    const id = Number(result.rows[0]?.id);
    revalidatePath(`/products/${data.product_id}`);
    const created = await getTaskTemplateById(id);
    return created!;
  } catch (error) {
    console.error("Error creating task template:", error);
    throw error;
  }
}

export async function updateTaskTemplate(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    area_id: number | null;
    assigned_user_id: number | null;
    task_type: string;
    requires_quote: number;
  }>
): Promise<ProductTaskTemplateType | null> {
  try {
    const updates: string[] = [];
    const args: unknown[] = [];

    if (data.title !== undefined) {
      args.push(data.title);
      updates.push(`title = $${args.length}`);
    }
    if (data.description !== undefined) {
      args.push(data.description);
      updates.push(`description = $${args.length}`);
    }
    if (data.area_id !== undefined) {
      args.push(data.area_id);
      updates.push(`area_id = $${args.length}`);
    }
    if (data.assigned_user_id !== undefined) {
      args.push(data.assigned_user_id);
      updates.push(`assigned_user_id = $${args.length}`);
    }
    if (data.task_type !== undefined) {
      args.push(data.task_type);
      updates.push(`task_type = $${args.length}`);
    }
    if (data.requires_quote !== undefined) {
      args.push(data.requires_quote);
      updates.push(`requires_quote = $${args.length}`);
    }

    if (updates.length === 0) return getTaskTemplateById(id);

    args.push(id);
    await db.execute({
      sql: `UPDATE product_task_templates SET ${updates.join(", ")} WHERE id = $${args.length}`,
      args,
    });

    const updated = await getTaskTemplateById(id);
    if (updated) revalidatePath(`/products/${updated.product_id}`);
    return updated;
  } catch (error) {
    console.error("Error updating task template:", error);
    throw error;
  }
}

export async function deleteTaskTemplate(id: number): Promise<void> {
  try {
    const template = await getTaskTemplateById(id);
    await db.execute({
      sql: `DELETE FROM product_task_templates WHERE id = $1`,
      args: [id],
    });
    if (template) revalidatePath(`/products/${template.product_id}`);
  } catch (error) {
    console.error("Error deleting task template:", error);
    throw error;
  }
}

/**
 * Reorders tasks for a product by updating order_index for each id in orderedIds.
 * Uses a transaction to ensure atomicity.
 */
export async function reorderTaskTemplates(
  productId: number,
  orderedIds: number[]
): Promise<void> {
  const transaction = await db.transaction("write");
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await transaction.execute({
        sql: `UPDATE product_task_templates SET order_index = $1 WHERE id = $2 AND product_id = $3`,
        args: [i, orderedIds[i], productId],
      });
    }
    await transaction.commit();
    revalidatePath(`/products/${productId}`);
  } catch (error) {
    await transaction.rollback();
    console.error("Error reordering task templates:", error);
    throw error;
  }
}
