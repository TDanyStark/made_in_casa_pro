import "server-only";
import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { UserRole } from "./definitions";

export const SESSION_SECRET_MISSING_MESSAGE = "SESSION_SECRET no está configurado";

/**
 * Clave de firma de la sesión. Se lee al usarla (no al importar el módulo) para
 * que build y tests sin la variable no fallen; nunca firma ni verifica con una
 * clave vacía.
 */
function getSessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(SESSION_SECRET_MISSING_MESSAGE);
  }
  return new TextEncoder().encode(secret);
}

// Define el tipo para la sesión
export interface SessionData extends JWTPayload {
  id: number;
  email: string;
  rol_id: UserRole;
  expiresAt?: Date | string;
}

export async function encrypt(payload: SessionData | undefined) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionKey());
}

export async function decrypt(session: string | undefined = ""): Promise<SessionData | null> {
  // Fuera del try: una configuración faltante no es una sesión inválida.
  const key = getSessionKey();
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ["HS256"],
    });
    return payload as SessionData;
  } catch (error) {
    console.log("Failed to verify session", error);
    return null;
  }
}

export async function createSession(user: {name: string, email: string, id: number, rol_id: UserRole}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const {name, email, id, rol_id} = user;
  const session = await encrypt({ name, email, id, rol_id, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function getUserRole(): Promise<UserRole> {
  const cookie = (await cookies()).get("session")?.value;
  let rol_id: UserRole = UserRole.NO_AUTHENTICADO; // Valor por defecto
  if (cookie) {
    try {
      const sessionData = await decrypt(cookie);
      if (sessionData?.rol_id) {
        rol_id = sessionData.rol_id;
      }
    } catch (error) {
      console.error("Error al desencriptar la sesión:", error);
    }
  }

  return rol_id;
}

// ─── OAuth state (CSRF) ───────────────────────────────────────────────────────
// Antes de redirigir a Google se genera un `state` aleatorio que viaja en la URL
// y en una cookie httpOnly de vida corta; el callback solo acepta la respuesta
// si ambos coinciden, y siempre borra la cookie.

const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

// Web Crypto (no `crypto` de Node): este módulo también lo importa el middleware (edge).
export function createOAuthState(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function oauthStateCookieOptions(path: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
    maxAge,
  };
}

export function setOAuthStateCookie(response: NextResponse, cookieName: string, state: string, path: string) {
  response.cookies.set(cookieName, state, oauthStateCookieOptions(path, OAUTH_STATE_MAX_AGE_SECONDS));
  return response;
}

export function clearOAuthStateCookie(response: NextResponse, cookieName: string, path: string) {
  response.cookies.set(cookieName, "", oauthStateCookieOptions(path, 0));
  return response;
}

/** true solo si el `state` de la query coincide con el guardado en la cookie. */
export function isValidOAuthState(request: NextRequest, cookieName: string): boolean {
  const expected = request.cookies.get(cookieName)?.value;
  const received = request.nextUrl.searchParams.get("state");
  if (!expected || !received) return false;
  return constantTimeEqual(expected, received);
}
