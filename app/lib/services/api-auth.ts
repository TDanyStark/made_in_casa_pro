import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/lib/definitions";

/**
 * Verifica si el usuario tiene uno de los roles permitidos para acceder a un endpoint API.
 * Usa la información del rol del usuario pasada por el middleware en los headers.
 * 
 * @param request La solicitud Next.js
 * @param allowedRoles Arreglo de roles que tienen permiso para acceder
 * @returns Un objeto con { isAuthorized, response, userRole }, donde response es undefined si está autorizado, o un NextResponse con error si no
 */
export function validateApiRole(
  request: NextRequest,
  allowedRoles: UserRole[]
) {
  const userRoleHeader = request.headers.get('x-user-role');
  
  // Si no hay header de rol, el usuario no está autenticado
  if (!userRoleHeader) {
    return {
      isAuthorized: false,
      userRole: UserRole.NO_AUTHENTICADO,
      response: NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    };
  }

  // Convertir el header de rol a un número para compararlo con UserRole enum
  const userRole = parseInt(userRoleHeader);
  
  // Verificar si el rol del usuario está en la lista de roles permitidos
  if (!allowedRoles.includes(userRole)) {
    return {
      isAuthorized: false,
      userRole,
      response: NextResponse.json(
        { error: "Acceso prohibido: No tienes permisos para esta operación" },
        { status: 403 }
      )
    };
  }

  // El usuario tiene autorización
  return {
    isAuthorized: true,
    userRole,
    response: undefined
  };
}

/**
 * Verifica si el método HTTP solicitado está entre los permitidos.
 * 
 * @param request La solicitud Next.js
 * @param allowedMethods Arreglo de métodos HTTP permitidos (por ejemplo, ['GET', 'POST'])
 * @returns Un objeto con { isValidMethod, response }, donde response es undefined si el método es válido
 */
export function validateHttpMethod(
  request: NextRequest,
  allowedMethods: string[]
) {
  const method = request.method;
  
  if (!allowedMethods.includes(method)) {
    return {
      isValidMethod: false,
      response: NextResponse.json(
        { error: `Método ${method} no permitido` },
        { status: 405, headers: { 'Allow': allowedMethods.join(', ') } }
      )
    };
  }

  return {
    isValidMethod: true,
    response: undefined
  };
}

/**
 * Obtiene el ID del usuario desde los headers de la solicitud.
 * Útil cuando necesitas saber quién realiza la solicitud para registro o verificaciones adicionales.
 * 
 * @param request La solicitud Next.js
 * @returns El ID del usuario o null si no está disponible
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}