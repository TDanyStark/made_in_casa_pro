import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { UserRole } from "@/lib/definitions";
import { publicRoute, checkRoutePermission } from "@/lib/permissions";

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = path === publicRoute;
  const headers = new Headers(req.headers);
  headers.set("x-current-path", req.nextUrl.pathname);

  const cookie = (await cookies()).get("session")?.value;
  let session = null;

  // Intentar desencriptar la cookie de sesión
  if (cookie) {
    try {
      session = await decrypt(cookie);
    } catch (error) {
      console.error("Error al desencriptar la sesión:", error);
      session = null;
    }
  }

  const userRole: UserRole = Object.values(UserRole).includes(session?.role as UserRole) 
    ? (session?.role as UserRole) 
    : UserRole.NO_AUTHENTICADO;

  // 1. Si es ruta pública y el usuario está autenticado, redirigir a dashboard
  if (isPublicRoute && session?.id) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // 2. Si el usuario no está autenticado y la ruta no es pública
  if (!session?.id && !isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // 3. Si el usuario está autenticado, verificar permisos para la ruta
  if (session?.id && !isPublicRoute) {
    // Usar la nueva función que maneja rutas dinámicas
    const hasPermission = checkRoutePermission(path, userRole);
    
    if (!hasPermission) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
  }

  // 4. Permitir el acceso si pasa todas las validaciones
  return NextResponse.next({ headers });
}

// 🔹 Rutas en las que NO se ejecutará el middleware (API, estáticos, imágenes)
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.webp|.*\\.jpg|.*\\.ico).*)',
  ],
};
