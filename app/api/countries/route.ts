import { createCountry, getCountries } from '@/lib/queries/countries';
export async function GET() {
  // const cookieStore = await cookies();
  // const token = cookieStore.get('session');

  // console.log(token); // Esto imprimirá { name: 'session', value: 'tu_jwt_token' } si la cookie existe
  const res = await getCountries();
  const countries = res.rows;
  return Response.json({ 
    countries: countries
  });
}


interface PostRequestBody {
  name: string;
  flag: string;
}

export async function POST(request: Request): Promise<Response> {
  const body: PostRequestBody = await request.json();
  const { name, flag } = body;
  
  try {
    const res = await createCountry(name, flag);
    const id = Number(res.lastInsertRowid); // Convertir BigInt a Number

    return Response.json({ id, message: "País creado exitosamente" }, { status: 201 });
  } catch (error) {
    return Response.json({ message: "Error al crear país: " + error }, { status: 500 });
  }
}
