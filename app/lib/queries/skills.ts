import { turso } from "../db";
import { SkillType } from "../definitions";

export async function getSkills(userId?: number) {
  try {
    const sql = `
      SELECT 
        s.id, 
        s.name,
        CASE WHEN us.skill_id IS NOT NULL THEN 1 ELSE 0 END as selected
      FROM skills s
      LEFT JOIN user_skills us ON s.id = us.skill_id AND us.user_id = ?
      ORDER BY s.name ASC
    `;
    
    const result = await turso.execute({
      sql,
      args: [userId || null]
    });
    
    return result.rows as unknown as SkillType[];
  } catch (error) {
    console.error("Error fetching skills:", error);
    return [];
  }
}

export async function getSkillById(id: string) {
  try {
    const result = await turso.execute({
      sql: `
        SELECT id, name
        FROM skills
        WHERE id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    return result.rows[0] as unknown as SkillType;
  } catch (error) {
    console.error("Error fetching skill by ID:", error);
    return null;
  }
}

export async function createSkill(skillData: Omit<SkillType, "id">) {
  try {
    const result = await turso.execute({
      sql: `INSERT INTO skills (name) VALUES (?)`,
      args: [skillData.name],
    });

    const skillId = Number(result.lastInsertRowid);
    
    return {
      id: skillId,
      name: skillData.name,
    };
  } catch (error) {
    console.error("Error creating skill:", error);
    throw error;
  }
}

export async function updateSkill(id: string, updateData: Partial<SkillType>) {
  try {
    const { name } = updateData;
    const updates = [];
    const args = [];

    // Build update statement based on provided fields
    if (name) {
      updates.push("name = ?");
      args.push(name);
    }

    if (updates.length > 0) {
      // Add the id at the end of args for WHERE clause
      args.push(id);

      await turso.execute({
        sql: `UPDATE skills SET ${updates.join(", ")} WHERE id = ?`,
        args,
      });

      // Get the updated skill to return
      return getSkillById(id);
    }

    // If no fields to update, just return the existing skill
    return getSkillById(id);
  } catch (error) {
    console.error("Error updating skill:", error);
    throw error;
  }
}

export async function getSkillsWithPagination({
  search,
  user_id,
}: {
  page?: number;
  limit?: number;
  search?: string;
  user_id?: number;
}) {
  try {
    let sql = `
      SELECT 
        s.id, 
        s.name,
        CASE WHEN us.skill_id IS NOT NULL THEN 1 ELSE 0 END as selected
      FROM skills s
      LEFT JOIN user_skills us ON s.id = us.skill_id AND us.user_id = ?
    `;
    const args: (number | null | string)[] = [user_id || null];
    const countArgs: (number | null | string)[] = [user_id || null];

    // Build WHERE clause for search
    if (search) {
      sql += ` WHERE s.name LIKE ?`;
      const searchParam = `%${search}%`;
      args.push(searchParam);
      countArgs.push(searchParam);
    }

    // // Get total count for pagination
    // let countSql = `SELECT COUNT(*) as count FROM skills`;
    // if (search) {
    //   countSql += ` WHERE name LIKE ?`;
    // }

    // const countResult = await turso.execute({
    //   sql: countSql,
    //   args: countArgs,
    // });

    // const total = Number(countResult.rows[0].count);
    const total = 1;


    // Add order by and pagination
    // sql += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
    // const offset = (page - 1) * limit;
    // args.push(limit, offset);

    // Execute query
    const result = await turso.execute({
      sql,
      args,
    });

    // Transform the result
    const skills = result.rows as unknown as SkillType[];

    return {
      skills,
      total,
    };
  } catch (error) {
    console.error("Error fetching skills with pagination:", error);
    return { skills: [], total: 0 };
  }
}
