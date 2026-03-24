-- Migration: create user_skills join table
-- Depende de: users (010), skills (004)
CREATE TABLE IF NOT EXISTS user_skills (
  user_id  INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, skill_id),
  CONSTRAINT fk_user_skills_user_id  FOREIGN KEY (user_id)  REFERENCES users  (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_skills_skill_id FOREIGN KEY (skill_id) REFERENCES skills (id) ON UPDATE CASCADE ON DELETE CASCADE
);
