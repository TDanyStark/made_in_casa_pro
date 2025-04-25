// Servicio centralizado para manejar todas las llamadas a la API
type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

type ApiResponse<T> ={
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
};

/**
 * Realiza una petición fetch con opciones configurables
 * @param endpoint - Ruta del endpoint (sin /api/)
 * @param options - Opciones de la petición
 * @returns Respuesta formateada de la API
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions
): Promise<ApiResponse<T>> {
  // Asegurarse que el endpoint no comienza con /api/ (se añadirá automáticamente)
  const apiPath = endpoint.startsWith('/api/')
    ? endpoint
    : `/api/${endpoint}`;

  // Configuración por defecto de headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(apiPath, {
      method: options.method,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    return {
      data,
      status: response.status,
      ok: response.ok,
      error: !response.ok ? data.error || 'Error en la petición' : undefined,
    };
  } catch (error) {
    console.error('Error en fetchApi:', error);
    return {
      status: 500,
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Realiza una petición GET
 * @param endpoint - Ruta del endpoint (sin /api/)
 * @returns Respuesta formateada de la API
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return fetchApi<T>(endpoint, { method: 'GET' });
}

/**
 * Realiza una petición POST
 * @param endpoint - Ruta del endpoint (sin /api/)
 * @param data - Datos a enviar en el cuerpo de la petición
 * @returns Respuesta formateada de la API
 */
export async function post<T>(
  endpoint: string,
  data: Record<string, unknown>
): Promise<ApiResponse<T>> {
  return fetchApi<T>(endpoint, { method: 'POST', body: data });
}

/**
 * Realiza una petición PATCH
 * @param endpoint - Ruta del endpoint (sin /api/)
 * @param data - Datos a enviar en el cuerpo de la petición
 * @returns Respuesta formateada de la API
 */
export async function patch<T>(
  endpoint: string,
  data: Record<string, unknown>
): Promise<ApiResponse<T>> {
  return fetchApi<T>(endpoint, { method: 'PATCH', body: data });
}

/**
 * Realiza una petición DELETE
 * @param endpoint - Ruta del endpoint (sin /api/)
 * @param data - Datos opcionales a enviar en el cuerpo de la petición
 * @returns Respuesta formateada de la API
 */
export async function del<T>(
  endpoint: string,
  data?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  return fetchApi<T>(endpoint, { 
    method: 'DELETE',
    body: data
  });
}