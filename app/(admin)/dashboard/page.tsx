import { getUserRole } from "@/lib/session";
import { UserRole } from "@/lib/definitions";
import { isDirectivoScopeRole } from "@/lib/role-groups";

export default async function Page() {
  const role = await getUserRole();
  return (
    <section>
      <h1 className="primaryH1">Dashboard - {UserRole[role]}</h1>
      {role === UserRole.ADMIN && <p>Dashboard de administrador</p>}
      {role === UserRole.COLABORADOR && <p>Dashboard de colaborador</p>}
      {role === UserRole.COMERCIAL && <p>Dashboard de Comercial</p>}
      {isDirectivoScopeRole(role) && <p>Dashboard de liderazgo</p>}
    </section>
  );
}
