import "server-only";
import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserRole } from "./definitions";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: JWTPayload | undefined) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.log("Failed to verify session", error);
  }
}

export async function createSession(user: {email: string, id: number, role: number}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const {id, email, role} = user;
  const session = await encrypt({ id, email, role, expiresAt });
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
  let role: UserRole = UserRole.NO_AUTHENTICADO; // Valor por defecto

  if (cookie) {
    try {
      const sessionData = await decrypt(cookie);
      if (sessionData?.role) {
        role = sessionData.role as UserRole;
      }
    } catch (error) {
      console.error("Error al desencriptar la sesión:", error);
    }
  }

  return role;
}