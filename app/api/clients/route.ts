import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session');

  console.log(token); // Esto imprimirá { name: 'session', value: 'tu_jwt_token' } si la cookie existe

  return Response.json({ 
    message: 'Hello from Next.js!', 
    token: token?.value // Accede al valor del JWT
  });
}
