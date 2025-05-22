import 'server-only';
import { SiigoCustomerType, SiigoCustomersResponseType, SiigoCustomerFilterType } from '@/lib/services/siigo/SiigoDefinitions';
import customerService  from '@/lib/services/siigo/customer';

/**
 * Obtiene una lista de clientes desde la API de Siigo
 * @param filters Filtros opcionales para la consulta
 * @returns Lista paginada de clientes
 */
export async function getSiigoCustomers(
  filters: SiigoCustomerFilterType = { page: 1, pageSize: 25 }
): Promise<SiigoCustomersResponseType> {
  try {
    const customers = await customerService.getCustomers(filters);
    return customers;
  } catch (error) {
    console.error('Error al obtener clientes de Siigo:', error);
    // Devuelve una respuesta vacía si hay un error
    return {
      pagination: {
        page: filters.page || 1,
        page_size: filters.pageSize || 25,
        total_results: 0
      },
      results: [],
      _links: {
        self: { href: '' }
      }
    };
  }
}

/**
 * Obtiene un cliente específico desde la API de Siigo
 * @param customerId ID del cliente a obtener
 * @returns Información del cliente o null si no se encuentra
 */
export async function getSiigoCustomerById(customerId: string): Promise<SiigoCustomerType | null> {
  try {
    const customer = await customerService.getCustomer(customerId);
    return customer;
  } catch (error) {
    console.error(`Error al obtener cliente de Siigo con ID ${customerId}:`, error);
    return null;
  }
}

/**
 * Busca clientes de Siigo por nombre
 * @param nameQuery Término de búsqueda para el nombre
 * @returns Lista de clientes que coinciden con la búsqueda
 */
export async function searchSiigoCustomersByName(
  nameQuery: string
): Promise<SiigoCustomersResponseType> {
  return getSiigoCustomers({ query: nameQuery });
}

/**
 * Busca un cliente de Siigo por su número de identificación
 * @param identification Número de identificación
 * @returns Cliente que coincide con la identificación o listado vacío
 */
export async function searchSiigoCustomerByIdentification(
  identification: string
): Promise<SiigoCustomersResponseType> {
  return getSiigoCustomers({ identification });
}
