import { db } from "../db";
import { SkillType } from "../definitions";

export async function getSkills(userId?: number) {
  try {
    const sql = `
      SELECT 
        s.id, 
        s.name,
        CASE WHEN us.skill_id IS NOT NULL THEN 1 ELSE 0 END as selected
      FROM skills s
      LEFT JOIN user_skills us ON s.id = us.skill_id AND us.user_id = $1
      ORDER BY s.name ASC
    `;
    
    const result = await db.execute({
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
    const result = await db.execute({
      sql: `
        SELECT id, name
        FROM skills
        WHERE id = $1
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
    const result = await db.execute({
      sql: `INSERT INTO skills (name) VALUES ($1) RETURNING id`,
      args: [skillData.name],
    });

    const skillId = Number(result.rows[0]?.id);
    
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
      updates.push("name = $1");
      args.push(name);
    }

    if (updates.length > 0) {
      // Add the id at the end of args for WHERE clause
      args.push(id);

      await db.execute({
        sql: `UPDATE skills SET ${updates.join(", ")} WHERE id = $2`,
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
      LEFT JOIN user_skills us ON s.id = us.skill_id AND us.user_id = $1
    `;
    const args: (number | null | string)[] = [user_id || null];

    // Build WHERE clause for search
    if (search) {
      sql += ` WHERE unaccent(s.name) ILIKE unaccent($2)`;
      const searchParam = `%${search}%`;
      args.push(searchParam);
    }

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as count
      FROM skills s
      LEFT JOIN user_skills us ON s.id = us.skill_id AND us.user_id = $1
    `;
    if (search) {
      countSql += ` WHERE unaccent(s.name) ILIKE unaccent($2)`;
    }
    const countResult = await db.execute({ sql: countSql, args });
    const total = Number(countResult.rows[0]?.count ?? 0);

    // Execute query
    const result = await db.execute({
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
