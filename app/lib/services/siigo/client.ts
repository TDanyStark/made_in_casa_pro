import 'server-only';
import { getSiigoToken, forceRenewSiigoToken } from './auth';

/**
 * Cliente base para realizar llamadas a la API de Siigo
 */
export class SiigoClient {
  private baseUrl: string = process.env.SIIGO_API_URL || 'https://api.siigo.com';
  private partnerId = 'madeincasapro';

  /**
   * Realiza una petición a la API de Siigo con manejo automático de token
   * @param endpoint - Ruta del endpoint (sin incluir la base URL)
   * @param method - Método HTTP (GET, POST, PUT, DELETE)
   * @param body - Cuerpo de la petición (opcional)
   * @returns Respuesta de la API
   */
  async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: object
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Primer intento con token actual o nuevo si ha expirado
    const response = await this.makeRequest<T>(url, method, body);
    return response;
  }

  /**
   * Método interno que realiza la petición HTTP y maneja la renovación del token
   */
  private async makeRequest<T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: object,
    isRetry: boolean = false
  ): Promise<T> {
    try {
      // Obtiene el token (reutiliza el existente o solicita uno nuevo si ha expirado)
      const token = await getSiigoToken();
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Partner-Id': this.partnerId
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store'
      });

      // Si recibimos 401 Unauthorized y no estamos en un reintento, renovamos el token y reintentamos
      if (response.status === 401 && !isRetry) {
        // Forzamos renovación del token y reintentamos
        await forceRenewSiigoToken();
        return this.makeRequest<T>(url, method, body, true);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error en la API de Siigo: ${JSON.stringify(errorData)}`);
      }

      return await response.json() as T;
    } catch (error) {
      console.error(`Error en petición a Siigo [${method} ${url}]:`, error);
      throw error;
    }
  }
}

// Exportamos una instancia por defecto del cliente
const siigoClient = new SiigoClient();
export default siigoClient;
