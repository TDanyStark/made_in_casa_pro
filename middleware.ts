import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
// import { getToken } from 'next-auth/jwt';
// import { NextRequest, NextResponse } from 'next/server';

// 1. Use middleware directly
export const { auth: middleware } = NextAuth(authConfig)
 
// 2. Wrapped middleware option
// const { auth } = NextAuth(authConfig)

// export default auth(async function middleware(req: NextRequest) {
//   // Obtenemos el token para verificar si el usuario está autenticado
//   const token = await getToken({ req, secret: process.env.AUTH_SECRET })

//   // Ejemplo: Si la ruta es /dashboard, verificar si existe token (usuario autenticado)
//   if (req.nextUrl.pathname.startsWith('/dashboard') && !token) {
//     return NextResponse.redirect(new URL('/login', req.url))
//   }

//   return NextResponse.next()
// })

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};