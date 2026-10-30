import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ListProjectsClient } from "@/components/projects/ListProjectsClient";
import { PROJECT_CREATOR_ROLES, PROJECT_CREATOR_VIEW_ROLES } from "@/lib/role-groups";
import { getUserRole } from "@/lib/session";
import { UserRole } from "@/lib/definitions";

export default async function ProjectsPage() {
  const role = await getUserRole();
  const canCreate = PROJECT_CREATOR_ROLES.includes(role);
  const canSeeCreator = PROJECT_CREATOR_VIEW_ROLES.includes(role);
  // El comercial solo ve los proyectos que creó: el filtro por creador no le aplica
  const canFilterByCreator = role !== UserRole.COMERCIAL;

  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[{ href: "/projects", label: "Proyectos" }]}
      />
      <h1 className="primaryH1">Proyectos</h1>
      <div className="mt-6">
        <ListProjectsClient
          canCreate={canCreate}
          canSeeCreator={canSeeCreator}
          canFilterByCreator={canFilterByCreator}
        />
      </div>
    </section>
  );
}
