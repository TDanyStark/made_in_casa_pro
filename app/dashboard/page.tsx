import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { UserRole } from "@/lib/definitions";



export default async function Page() {
  // Obtener la cookie "session"
  const cookie = (await cookies()).get("session")?.value;

  let role: number | null = null;

  if (cookie) {
    try {
      const sessionData = await decrypt(cookie);
      if (sessionData) {
        role = (sessionData as { role: number }).role;
      }
    } catch (error) {
      console.error("Error al desencriptar la sesión:", error);
    }
  }

  return (
    <main>
      <h1 className="primaryH1">Dashboard</h1>
      {role !== null ? <p>Tu rol es: {UserRole[role]}</p> : <p>No autorizado</p>}
    </main>
  );
}
