import bcrypt from 'bcrypt';
import { connectDB } from '../lib/neon';

const sql = await connectDB();

// Datos para la tabla Roles
const roles = [
  { id: 1, rol: 'comercial' },
  { id: 2, rol: 'directivo' },
  { id: 3, rol: 'colaborador' },
  { id: 4, rol: 'admin' },
];

// Datos para la tabla users
const users = [
  {
    name: 'Daniel Amado',
    email: 'daniel@d.com',
    password: '123456',
    rol: 'admin',
  },
  {
    name: 'Maria Pérez',
    email: 'maria@p.com',
    password: 'password123',
    rol: 'comercial',
  },
  // Puedes agregar más usuarios según necesites
];

async function seedDatabase() {
  // Crear la tabla Roles si no existe
  await sql`
    CREATE TABLE IF NOT EXISTS Roles (
      id SERIAL PRIMARY KEY,
      rol VARCHAR(50) NOT NULL UNIQUE
    );
  `;

  // Insertar datos en la tabla Roles
  await Promise.all(
    roles.map(role =>
      sql`
        INSERT INTO Roles (id, rol)
        VALUES (${role.id}, ${role.rol})
        ON CONFLICT (id) DO NOTHING;
      `
    )
  );

  // Crear la tabla users si no existe
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      rol INT REFERENCES Roles(id)
    );
  `;

  // Insertar datos en la tabla users
  await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // Obtener el ID del rol correspondiente
      const [{ id: roleId }] = await sql`SELECT id FROM Roles WHERE rol = ${user.rol} LIMIT 1`;
      if (!roleId) {
        throw new Error(`El rol "${user.rol}" no existe en la tabla Roles.`);
      }

      return sql`
        INSERT INTO users (name, email, password, rol)
        VALUES (${user.name}, ${user.email}, ${hashedPassword}, ${roleId})
        ON CONFLICT (email) DO NOTHING;
      `;
    })
  );
}

export async function GET() {
  try {
    await sql`BEGIN`;
    await seedDatabase();
    await sql`COMMIT`;
    return Response.json({ message: 'Base de datos inicializada correctamente.' });
  } catch (error) {
    await sql`ROLLBACK`;
    console.error('Error al inicializar la base de datos:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
