import { createClient } from '@/lib/queries/clients';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session');

  return Response.json({ 
    message: 'Hello from Next.js!', 
    token: token?.value // Accede al valor del JWT
  });
}


export async function POST(request: Request) {
  const body = await request.json();
  const {name, country_id} = body;

  try{
    await createClient(name, country_id);
  } catch (error) {
    return Response.json({
      message: 'Error creating client!' + String(error),
    }, {
      status: 500,
    });
  }

  revalidatePath('/clients');

  return Response.json({
    message: 'Client created!',
  }, {
    status: 201,
  });
}