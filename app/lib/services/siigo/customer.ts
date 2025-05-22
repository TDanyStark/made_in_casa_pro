import siigoClient from './client';
import {
  SiigoCustomerFilterType,
  SiigoCustomerType,
  SiigoCustomersResponseType
} from './SiigoDefinitions';

/**
 * Servicio para interactuar con los clientes en Siigo
 */
export class SiigoCustomerService {
  /**
   * Obtiene un listado de clientes según los filtros aplicados
   * @param filters - Filtros para la búsqueda
   */
  async getCustomers(filters: SiigoCustomerFilterType = {}): Promise<SiigoCustomersResponseType> {
    // Construimos la query string con los filtros
    const queryParams = new URLSearchParams();
    
    if (filters.page) queryParams.append('page', String(filters.page));
    if (filters.pageSize) queryParams.append('page_size', String(filters.pageSize));
    if (filters.identification) queryParams.append('identification', filters.identification);
    if (filters.branchOffice !== undefined) queryParams.append('branch_office', String(filters.branchOffice));
    if (filters.query) queryParams.append('query', filters.query);
    if (filters.active !== undefined) queryParams.append('active', String(filters.active));
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return siigoClient.request(`/v1/customers${queryString}`);
  }

  /**
   * Obtiene un cliente específico por ID
   * @param customerId - ID del cliente
   */
  async getCustomer(customerId: string): Promise<SiigoCustomerType> {
    return siigoClient.request(`/v1/customers/${customerId}`);
  }

  /**
   * Crea un nuevo cliente
   * @param customerData - Datos del cliente
   */
  async createCustomer(customerData: Omit<SiigoCustomerType, 'id'>): Promise<SiigoCustomerType> {
    return siigoClient.request(`/v1/customers`, 'POST', customerData);
  }

  /**
   * Actualiza un cliente existente
   * @param customerId - ID del cliente
   * @param customerData - Datos para actualizar
   */  async updateCustomer(customerId: string, customerData: Partial<SiigoCustomerType>): Promise<SiigoCustomerType> {
    return siigoClient.request(`/v1/customers/${customerId}`, 'PUT', customerData);
  }
}

// Exportamos una instancia del servicio
const customerService = new SiigoCustomerService();
export default customerService;

