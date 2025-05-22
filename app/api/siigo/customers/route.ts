import { NextRequest, NextResponse } from 'next/server';
import { getSiigoCustomers, searchSiigoCustomersByName, searchSiigoCustomerByIdentification } from '@/lib/queries/siigo-customers';

/**
 * GET /api/siigo/customers
 * Endpoint para obtener clientes de Siigo con filtros opcionales
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '25');
  const term = searchParams.get('term') || '';
  
  try {
    let response;
    
    if (term) {
      // Verificamos si el término parece un número de identificación (solo dígitos)
      if (/^\d+$/.test(term)) {
        response = await searchSiigoCustomerByIdentification(term);
      } else {
        response = await searchSiigoCustomersByName(term);
      }
    } else {
      response = await getSiigoCustomers({ page, pageSize });
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error al procesar la solicitud de clientes Siigo:', error);
    return NextResponse.json(
      { error: 'Error al obtener clientes de Siigo' },
      { status: 500 }
    );
  }
}
