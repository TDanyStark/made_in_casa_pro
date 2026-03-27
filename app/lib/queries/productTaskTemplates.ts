import { db } from "../db";
import { revalidatePath } from "next/cache";
import { ProductTaskTemplateType } from "../definitions";

// Shared SELECT fragment
const TPL_SELECT = `
  ptt.id,
  ptt.product_id,
  ptt.title,
  ptt.description,
  ptt.area_id,
  a.name    AS area_name,
  ptt.assigned_user_id,
  u.name    AS assigned_user_name,
  u.rol_id  AS assigned_user_rol_id,
  ptt.order_index,
  ptt.task_type,
  ptt.requires_quote,
  ptt.assign_to_commercial,
  ptt.created_at
`;

const TPL_JOINS = `
  FROM product_task_templates ptt
  LEFT JOIN areas a ON ptt.area_id = a.id
  LEFT JOIN users u ON ptt.assigned_user_id = u.id
`;

export async function getTaskTemplatesByProductId(
  productId: number
): Promise<ProductTaskTemplateType[]> {
  try {
    const result = await db.execute({
      sql: `SELECT ${TPL_SELECT} ${TPL_JOINS} WHERE ptt.product_id = $1 ORDER BY ptt.order_index ASC, ptt.id ASC`,
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
      sql: `SELECT ${TPL_SELECT} ${TPL_JOINS} WHERE ptt.id = $1`,
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
  assign_to_commercial?: number;
}): Promise<ProductTaskTemplateType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO product_task_templates
          (product_id, title, description, area_id, assigned_user_id, order_index,
           task_type, requires_quote, assign_to_commercial)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        data.assign_to_commercial ?? 0,
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
    assign_to_commercial: number;
  }>
): Promise<ProductTaskTemplateType | null> {
  try {
    const updates: string[] = [];
    const args: unknown[] = [];

    const fields: Array<[string, unknown]> = [
      ["title", data.title],
      ["description", data.description],
      ["area_id", data.area_id],
      ["assigned_user_id", data.assigned_user_id],
      ["task_type", data.task_type],
      ["requires_quote", data.requires_quote],
      ["assign_to_commercial", data.assign_to_commercial],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        args.push(val);
        updates.push(`${col} = $${args.length}`);
      }
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
