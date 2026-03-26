import { db } from "../db";
import { revalidatePath } from "next/cache";
import { ProjectTaskType, ProjectTaskStatus } from "../definitions";

const TASK_SELECT = `
  pt.id,
  pt.project_id,
  pt.project_product_id,
  pt.template_id,
  pt.title,
  pt.description,
  pt.area_id,
  a.name  AS area_name,
  pt.assigned_user_id,
  u.name  AS assigned_user_name,
  pt.status,
  pt.order_index,
  pt.created_at,
  pt.updated_at
`;

const TASK_JOINS = `
  FROM project_tasks pt
  LEFT JOIN areas a ON pt.area_id = a.id
  LEFT JOIN users u ON pt.assigned_user_id = u.id
`;

export async function getProjectTaskById(id: number): Promise<ProjectTaskType | null> {
  try {
    const result = await db.execute({
      sql: `SELECT ${TASK_SELECT} ${TASK_JOINS} WHERE pt.id = $1`,
      args: [id],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as ProjectTaskType;
  } catch (error) {
    console.error("Error fetching project task by ID:", error);
    return null;
  }
}

export async function getTasksByProjectProduct(
  projectProductId: number
): Promise<ProjectTaskType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT ${TASK_SELECT} ${TASK_JOINS}
        WHERE pt.project_product_id = $1
        ORDER BY pt.order_index ASC, pt.id ASC
      `,
      args: [projectProductId],
    });
    return result.rows as unknown as ProjectTaskType[];
  } catch (error) {
    console.error("Error fetching tasks by project_product_id:", error);
    return [];
  }
}

export async function getTasksByProject(projectId: number): Promise<ProjectTaskType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT ${TASK_SELECT} ${TASK_JOINS}
        WHERE pt.project_id = $1
        ORDER BY pt.project_product_id ASC, pt.order_index ASC, pt.id ASC
      `,
      args: [projectId],
    });
    return result.rows as unknown as ProjectTaskType[];
  } catch (error) {
    console.error("Error fetching tasks by project:", error);
    return [];
  }
}

export async function createProjectTask(data: {
  project_id: number;
  project_product_id: number;
  template_id?: number | null;
  title: string;
  description?: string | null;
  area_id?: number | null;
  assigned_user_id?: number | null;
  status?: ProjectTaskStatus;
  order_index: number;
}): Promise<ProjectTaskType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO project_tasks
          (project_id, project_product_id, template_id, title, description, area_id, assigned_user_id, status, order_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      args: [
        data.project_id,
        data.project_product_id,
        data.template_id ?? null,
        data.title,
        data.description ?? null,
        data.area_id ?? null,
        data.assigned_user_id ?? null,
        data.status ?? "not_started",
        data.order_index,
      ],
    });
    const id = Number(result.rows[0]?.id);
    revalidatePath(`/projects/${data.project_id}`);
    const created = await getProjectTaskById(id);
    return created!;
  } catch (error) {
    console.error("Error creating project task:", error);
    throw error;
  }
}

export async function updateProjectTask(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    area_id: number | null;
    assigned_user_id: number | null;
    status: ProjectTaskStatus;
  }>
): Promise<ProjectTaskType | null> {
  try {
    const updates: string[] = [];
    const args: unknown[] = [];

    const fields: Array<[string, unknown]> = [
      ["title", data.title],
      ["description", data.description],
      ["area_id", data.area_id],
      ["assigned_user_id", data.assigned_user_id],
      ["status", data.status],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        args.push(val);
        updates.push(`${col} = $${args.length}`);
      }
    }

    if (updates.length === 0) return getProjectTaskById(id);

    updates.push("updated_at = CURRENT_TIMESTAMP");
    args.push(id);

    await db.execute({
      sql: `UPDATE project_tasks SET ${updates.join(", ")} WHERE id = $${args.length}`,
      args,
    });

    const updated = await getProjectTaskById(id);
    if (updated) revalidatePath(`/projects/${updated.project_id}`);
    return updated;
  } catch (error) {
    console.error("Error updating project task:", error);
    throw error;
  }
}

export async function deleteProjectTask(id: number): Promise<void> {
  try {
    const task = await getProjectTaskById(id);
    await db.execute({ sql: `DELETE FROM project_tasks WHERE id = $1`, args: [id] });
    if (task) revalidatePath(`/projects/${task.project_id}`);
  } catch (error) {
    console.error("Error deleting project task:", error);
    throw error;
  }
}

export async function reorderProjectTasks(
  projectProductId: number,
  projectId: number,
  orderedIds: number[]
): Promise<void> {
  const transaction = await db.transaction("write");
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await transaction.execute({
        sql: `UPDATE project_tasks SET order_index = $1 WHERE id = $2 AND project_product_id = $3`,
        args: [i, orderedIds[i], projectProductId],
      });
    }
    await transaction.commit();
    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    await transaction.rollback();
    console.error("Error reordering project tasks:", error);
    throw error;
  }
}

/**
 * Finds the internal collaborator (is_internal=1, rol_id=4) with the fewest
 * active (not completed) project tasks, to use for auto-assignment.
 */
export async function findLeastLoadedInternalCollaborator(): Promise<number | null> {
  try {
    const result = await db.execute({
      sql: `
        SELECT u.id
        FROM users u
        LEFT JOIN project_tasks pt ON pt.assigned_user_id = u.id
          AND pt.status != 'completed'
        WHERE u.rol_id = 4
          AND u.is_internal = 1
          AND u.is_active = 1
        GROUP BY u.id
        ORDER BY COUNT(pt.id) ASC
        LIMIT 1
      `,
      args: [],
    });
    if (result.rows.length === 0) return null;
    return Number((result.rows[0] as unknown as { id: number }).id);
  } catch (error) {
    console.error("Error finding least loaded collaborator:", error);
    return null;
  }
}

/**
 * Instantiates product_task_templates as project_tasks for a given project_product.
 * Auto-assigns internal collaborator if template has no assigned_user_id.
 */
export async function instantiateTasksFromTemplates(
  projectId: number,
  projectProductId: number,
  productId: number
): Promise<void> {
  try {
    const templates = await db.execute({
      sql: `
        SELECT id, title, description, area_id, assigned_user_id, order_index
        FROM product_task_templates
        WHERE product_id = $1
        ORDER BY order_index ASC, id ASC
      `,
      args: [productId],
    });

    const fallbackUserId = await findLeastLoadedInternalCollaborator();

    const transaction = await db.transaction("write");
    try {
      for (const tpl of templates.rows as unknown as Array<{
        id: number;
        title: string;
        description: string | null;
        area_id: number | null;
        assigned_user_id: number | null;
        order_index: number;
      }>) {
        const assignedTo = tpl.assigned_user_id ?? fallbackUserId;
        await transaction.execute({
          sql: `
            INSERT INTO project_tasks
              (project_id, project_product_id, template_id, title, description, area_id, assigned_user_id, status, order_index)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'not_started', $8)
          `,
          args: [
            projectId,
            projectProductId,
            tpl.id,
            tpl.title,
            tpl.description ?? null,
            tpl.area_id ?? null,
            assignedTo ?? null,
            tpl.order_index,
          ],
        });
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    revalidatePath(`/projects/${projectId}`);
  } catch (error) {
    console.error("Error instantiating tasks from templates:", error);
    throw error;
  }
}
