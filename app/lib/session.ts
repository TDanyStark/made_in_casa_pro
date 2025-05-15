import "server-only";
import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserRole } from "./definitions";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

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
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = ""): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
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