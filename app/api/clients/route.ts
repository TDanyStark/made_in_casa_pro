import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session');

  return Response.json({ 
    message: 'Hello from Next.js!', 
    token: token?.value // Accede al valor del JWT
  });
}
