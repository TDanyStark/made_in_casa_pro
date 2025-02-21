import { getCountries } from '@/lib/queries/countries';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session');

  console.log(token); // Esto imprimirá { name: 'session', value: 'tu_jwt_token' } si la cookie existe
  const res = await getCountries();
  const countries = res.rows;
  console.log(res.rows);
  return Response.json({ 
    countries: countries

  });
}

export async function POST(request) {
  const body = await request.json();
  console.log(body);
  return Response.json({ message: 'POST request received' });
}
