import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/lib/definitions";
import { cookies } from "next/headers";
import { decrypt, SessionData } from "../session";
import { getUserConnectedEmailStatus, isGmailConnectionRequired } from "@/lib/queries/userEmailConnections";
import { getSessionUserState, SessionUserState } from "./session-user";

/**
 * Rutas que pueden operar sin Gmail conectado.
 * Incluye las rutas de conexión OAuth, settings (para que el admin pueda
 * configurar credenciales), /me (necesario para cargar el rol del usuario
 * en la UI antes de redirigir), y logout.
 */
function canSkipGmailConnection(request: NextRequest) {
  const path = request.nextUrl.pathname;
  return (
    path.startsWith("/api/user-email/") ||
    path.startsWith("/api/settings") ||
    path === "/api/me" ||
    path === "/api/auth/logout"
  );
}

/**
 * Verifica si el usuario tiene uno de los roles permitidos para acceder a un endpoint API.
 * El estado activo y el rol se releen de la BD en cada llamada (no se confía en el
 * rol del JWT, que dura 7 días): un usuario desactivado recibe 401.
 *
 * @param request La solicitud Next.js
 * @param allowedRoles Arreglo de roles que tienen permiso para acceder
 * @returns Un objeto con { isAuthorized, response, userRole }, donde response es undefined si está autorizado, o un NextResponse con error si no
 */
export async function validateApiRole(
  request: NextRequest,
  allowedRoles: readonly UserRole[]
) {
  const cookie = (await cookies()).get("session")?.value;

  if (!cookie) {
    return {
      isAuthorized: false,
      userRole: UserRole.NO_AUTHENTICADO,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  let session: SessionData | null = null;
  try {
    // Intentar desencriptar la cookie de sesión
    session = await decrypt(cookie);
  } catch (error) {
    console.error("Error al desencriptar la sesión:", error);
    session = null;
  }
  // Si no hay cookie de sesión, el usuario no está autenticado
  if (!session) {
    return {
      isAuthorized: false,
      userRole: UserRole.NO_AUTHENTICADO,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  const userRoleHeader = session.rol_id;
  // Si no hay header de rol, el usuario no está autenticado
  if (!userRoleHeader) {
    return {
      isAuthorized: false,
      userRole: UserRole.NO_AUTHENTICADO,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  let userState: SessionUserState | null;
  try {
    userState = await getSessionUserState(session);
  } catch (error) {
    console.error("Error al leer el usuario de la sesión:", error);
    return {
      isAuthorized: false,
      userRole: UserRole.NO_AUTHENTICADO,
      response: NextResponse.json({ error: "Error al validar la sesión" }, { status: 500 }),
    };
  }

  // Usuario eliminado o desactivado después de emitir el JWT
  if (!userState || !userState.is_active) {
    return {
      isAuthorized: false,
      userRole: UserRole.NO_AUTHENTICADO,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  // El rol vigente es el de la BD, no el del JWT
  const userRole = userState.rol_id;

  // Verificar si el rol del usuario está en la lista de roles permitidos
  if (!allowedRoles.includes(userRole)) {
    return {
      isAuthorized: false,
      userRole,
      response: NextResponse.json(
        { error: "Acceso prohibido: No tienes permisos para esta operación" },
        { status: 403 }
      ),
    };
  }

  // Admin siempre puede acceder — necesita poder configurar el sistema
  // incluso cuando Gmail no está conectado.
  const isAdminRole = userRole === UserRole.ADMIN;

  if (isGmailConnectionRequired() && !canSkipGmailConnection(request) && !isAdminRole) {
    const hasConnectedGmail = await getUserConnectedEmailStatus(session.id);
    if (!hasConnectedGmail) {
      return {
        isAuthorized: false,
        userRole,
        response: NextResponse.json(
          { error: "Debes conectar Gmail para continuar" },
          { status: 428 }
        ),
      };
    }
  }

  // El usuario tiene autorización
  return {
    isAuthorized: true,
    userRole,
    response: undefined,
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
        { status: 405, headers: { Allow: allowedMethods.join(", ") } }
      ),
    };
  }

  return {
    isValidMethod: true,
    response: undefined,
  };
}
