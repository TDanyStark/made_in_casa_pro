import { createCountry, getCountries } from '@/lib/queries/countries';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { UserRole } from '@/lib/definitions';
import { z } from 'zod';

// Schema para validar los datos de países
const countrySchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  flag: z.string().min(1, "La bandera es obligatoria")
});

export async function GET(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (permitir a todos los usuarios autenticados ver países)
  const roleValidation = validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.COMERCIAL, 
    UserRole.DIRECTIVO,
    UserRole.COLABORADOR
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    const res = await getCountries();
    const countries = res.rows;
    return NextResponse.json({ 
      countries: countries
    });
  } catch (error) {
    console.error("Error al obtener países:", error);
    return NextResponse.json(
      { error: "Error al obtener países" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (solo administradores pueden crear países)
  const roleValidation = validateApiRole(request, [
    UserRole.ADMIN
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    const body = await request.json();
    
    // Validación de los datos
    const validationResult = countrySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: "Datos de país inválidos", 
        details: validationResult.error.format() 
      }, { status: 400 });
    }
    
    const { name, flag } = validationResult.data;
    
    const res = await createCountry(name, flag);
    const id = Number(res.lastInsertRowid); // Convertir BigInt a Number

    return NextResponse.json({ id, message: "País creado exitosamente" }, { status: 201 });
  } catch (error) {
    console.error("Error al crear país:", error);
    return NextResponse.json({ message: "Error al crear país: " + error }, { status: 500 });
  }
}
