import { type NextAuthConfig } from "next-auth"

declare module "next-auth" {
  interface User {
    rol?: number | null
  }
}

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) { // User is available during sign-in
        token.rol = user.rol
      }
      return token
    },
    session({ session, token }) {
      session.user.rol = token.rol as number
      return session
    }
  },
  session: { strategy: "jwt" },
  providers: [], // Add providers with an empty array for now
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;