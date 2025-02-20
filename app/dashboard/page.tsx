import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { UserRole } from "@/lib/definitions";



export default async function Page() {
  // Obtener la cookie "session"
  const cookie = (await cookies()).get("session")?.value;

  let role: number = 0;

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
      <h1 className="primaryH1">Dashboard - {UserRole[role]}</h1>
      {role === UserRole.ADMIN && <p>Dashboard de administrador</p>}
      {role === UserRole.COLABORADOR && <p>Dashboard de colaborador</p>}
      {role === UserRole.COMERCIAL && <p>Dashboard de Comercial</p>}
      {role === UserRole.DIRECTIVO && <p>Dashboard de DIRECTIVO</p>}
    </main>
  );
}
