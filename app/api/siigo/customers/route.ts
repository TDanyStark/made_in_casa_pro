import { NextRequest, NextResponse } from 'next/server';
import { getSiigoCustomers, searchSiigoCustomersByName, searchSiigoCustomerByIdentification } from '@/lib/queries/siigo-customers';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { OPERATIONS_ROLES } from '@/lib/role-groups';
import { parsePagination } from '@/lib/utils/pagination';

/** Siigo API default and maximum `page_size`. */
const SIIGO_DEFAULT_PAGE_SIZE = 25;
const SIIGO_MAX_PAGE_SIZE = 100;

/**
 * GET /api/siigo/customers
 * Endpoint para obtener clientes de Siigo con filtros opcionales
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const searchParams = request.nextUrl.searchParams;
  // parsePagination validates `page`/`limit`; this endpoint names the size `pageSize`.
  const pagination = parsePagination(
    new URLSearchParams({
      page: searchParams.get('page') ?? '',
      limit: searchParams.get('pageSize') || String(SIIGO_DEFAULT_PAGE_SIZE),
    }),
    { maxLimit: SIIGO_MAX_PAGE_SIZE }
  );
  if (!pagination.success) return pagination.response;
  const { page, limit: pageSize } = pagination;
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
