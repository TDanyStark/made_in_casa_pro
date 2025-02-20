import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

// 1. Specify protected and public routes
const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/"];

export default async function middleware(req: NextRequest) {
  // 2. Check if the current route is protected or public
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.includes(path);
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = (await cookies()).get("session")?.value;
  let session;

  if (!cookie) {
    console.log("No session cookie found.");
  } else {
    try {
      session = await decrypt(cookie);
    } catch (error) {
      console.error("Session decryption failed:", error);
      session = null; // Asegura que no se use un valor inválido
    }
  }
  // 4. Redirect to /login if the user is not authenticated
  if (isProtectedRoute && !session?.id) {
    // Evita redirigir si ya está en "/"
    if (req.nextUrl.pathname !== "/") {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
  }

  // 5. Redirect to /dashboard if the user is authenticated
  if (
    isPublicRoute &&
    session?.id &&
    !req.nextUrl.pathname.startsWith("/dashboard")
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
