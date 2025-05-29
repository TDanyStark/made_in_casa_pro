import { turso } from "../db";
import { UserSkillType } from "../definitions";

export async function getUserSkills(userId: number) {
  try {
    const result = await turso.execute({
      sql: `
        SELECT us.user_id, us.skill_id, s.name as skill_name
        FROM user_skills us
        JOIN skills s ON us.skill_id = s.id
        WHERE us.user_id = ?
        ORDER BY s.name ASC
      `,
      args: [userId],
    });

    return result.rows as unknown as UserSkillType[];
  } catch (error) {
    console.error("Error fetching user skills:", error);
    return [];
  }
}

export async function addUserSkill(userId: number, skillId: number) {
  try {
    // Check if the relationship already exists
    const existingResult = await turso.execute({
      sql: `SELECT 1 FROM user_skills WHERE user_id = ? AND skill_id = ?`,
      args: [userId, skillId],
    });

    // If the relationship already exists, just return it
    if (existingResult.rows.length > 0) {
      return getUserSkillById(userId, skillId);
    }

    // If not, create it
    await turso.execute({
      sql: `INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?)`,
      args: [userId, skillId],
    });

    return getUserSkillById(userId, skillId);
  } catch (error) {
    console.error("Error adding user skill:", error);
    throw error;
  }
}

export async function removeUserSkill(userId: number, skillId: number) {
  try {
    await turso.execute({
      sql: `DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?`,
      args: [userId, skillId],
    });
    
    return true;
  } catch (error) {
    console.error("Error removing user skill:", error);
    throw error;
  }
}

export async function getUserSkillById(userId: number, skillId: number) {
  try {
    const result = await turso.execute({
      sql: `
        SELECT us.user_id, us.skill_id, s.name as skill_name
        FROM user_skills us
        JOIN skills s ON us.skill_id = s.id
        WHERE us.user_id = ? AND us.skill_id = ?
      `,
      args: [userId, skillId],
    });

    if (result.rows.length === 0) return null;

    return result.rows[0] as unknown as UserSkillType;
  } catch (error) {
    console.error("Error fetching user skill by ID:", error);
    return null;
  }
}
