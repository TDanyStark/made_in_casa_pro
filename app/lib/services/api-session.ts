import { cookies } from "next/headers";
import { decrypt, SessionData } from "@/lib/session";

export async function getCurrentSession(): Promise<SessionData | null> {
  const cookie = (await cookies()).get("session")?.value;
  if (!cookie) return null;

  try {
    return await decrypt(cookie);
  } catch (error) {
    console.error("Error al desencriptar la sesión:", error);
    return null;
  }
}
