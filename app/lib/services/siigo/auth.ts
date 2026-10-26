import 'server-only';

interface SiigoAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface SiigoErrorResponse {
  Status: number;
  Errors: {
    Code: string;
    Message: string;
    Params: unknown[];
    Detail: string;
  }[];
}

/** Tiempo máximo de espera por una respuesta de Siigo. */
export const SIIGO_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Lee el cuerpo de error de Siigo sin romper si no es JSON (p. ej. HTML de un 502).
 * Devuelve null cuando el cuerpo no se puede interpretar como JSON.
 */
export async function readSiigoErrorBody(response: Response): Promise<unknown | null> {
  try {
    return JSON.parse(await response.text());
  } catch {
    return null;
  }
}

// Almacena el token y su fecha de expiración
let tokenData: {
  accessToken: string;
  expiresAt: Date | null;
} = {
  accessToken: '',
  expiresAt: null,
};

/**
 * Comprueba si el token actual es válido o ha expirado
 * @returns Boolean indicando si el token ha expirado
 */
const isTokenExpired = (): boolean => {
  if (!tokenData.expiresAt) return true;
  
  // Agregamos un margen de 5 minutos para evitar usar un token que está a punto de expirar
  const nowWithMargin = new Date(Date.now() + 5 * 60 * 1000);
  return nowWithMargin >= tokenData.expiresAt;
};

/**
 * Obtiene un token de autenticación para la API de Siigo
 * Si hay un token válido en memoria, lo devuelve. Si no, solicita uno nuevo.
 * @returns Token de acceso para la API de Siigo
 */
export async function getSiigoToken(): Promise<string> {
  // Si ya tenemos un token válido, lo devolvemos
  if (tokenData.accessToken && !isTokenExpired()) {
    return tokenData.accessToken;
  }

  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const apiUrl = process.env.SIIGO_API_URL || 'https://api.siigo.com/v1';

  if (!username || !accessKey) {
    throw new Error('Credenciales de Siigo no configuradas en variables de entorno');
  }

  try {
    const response = await fetch(`${apiUrl}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Partner-Id': 'madeincasapro'
      },
      body: JSON.stringify({
        username,
        access_key: accessKey
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(SIIGO_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await readSiigoErrorBody(response) as SiigoErrorResponse | null;
      throw new Error(`Error al autenticar con Siigo: ${errorData?.Errors?.[0]?.Message || response.statusText}`);
    }

    const data = await response.json() as SiigoAuthResponse;
    
    // Actualiza el token y calcula su tiempo de expiración (en segundos)
    tokenData = {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000)
    };

    return tokenData.accessToken;
  } catch (error) {
    console.error('Error al obtener token de Siigo:', error);
    throw error;
  }
}

/**
 * Fuerza la renovación del token independientemente de si ha expirado o no
 * Útil cuando se recibe un error 401 de la API
 */
export async function forceRenewSiigoToken(): Promise<string> {
  // Invalidamos el token actual
  tokenData = {
    accessToken: '',
    expiresAt: null
  };
  
  // Obtenemos un nuevo token
  return getSiigoToken();
}
