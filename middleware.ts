import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { UserRole } from "@/lib/definitions";

// 🔹 Definir rutas protegidas y los roles que pueden acceder
const routePermissions: Record<string, UserRole[]> = {
  "/dashboard": [UserRole.COMERCIAL, UserRole.DIRECTIVO, UserRole.COLABORADOR, UserRole.ADMIN],
  "/admin": [UserRole.ADMIN], // Solo administradores
  "/reports": [UserRole.DIRECTIVO, UserRole.ADMIN], // Directivos y Admins
  "/sales": [UserRole.COMERCIAL, UserRole.ADMIN], // Comerciales y Admins
};

// 🔹 Definir la única ruta pública
const publicRoute = "/";

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = path === publicRoute;
  const allowedRoles = routePermissions[path];

  const cookie = (await cookies()).get("session")?.value;
  let session = null;

  // Intentar desencriptar la cookie de sesión
  if (cookie) {
    try {
      session  = await decrypt(cookie);
    } catch (error) {
      console.error("Error al desencriptar la sesión:", error);
      session = null;
    }
  }
  const userRole: UserRole = Object.values(UserRole).includes(session?.role as UserRole) ? (session?.role as UserRole) ?? UserRole.NO_AUTHENTICADO : UserRole.NO_AUTHENTICADO; // Si no hay sesión, rol 0 (no autenticado)

  // 🔹 1. Si el usuario autenticado intenta visitar "/", redirigir a /dashboard
  if (isPublicRoute && session?.id) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // 🔹 2. Si no hay sesión y la ruta es protegida, redirigir a /login
  if (!session?.id && allowedRoles) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // 🔹 3. Si el usuario tiene sesión pero no tiene permiso, redirigir a /dashboard
  if (session?.id && allowedRoles && !allowedRoles.includes(userRole)) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // 🔹 4. Permitir acceso si pasa todas las validaciones
  return NextResponse.next();
}

// 🔹 Rutas en las que NO se ejecutará el middleware (API, estáticos, imágenes)
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
