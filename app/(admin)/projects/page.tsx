import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ListProjectsClient } from "@/components/projects/ListProjectsClient";
import { PROJECT_EDIT_ROLES } from "@/lib/role-groups";
import { getUserRole } from "@/lib/session";

export default async function ProjectsPage() {
  const role = await getUserRole();
  const canCreate = PROJECT_EDIT_ROLES.includes(role);

  return (
    <section className="container">
      <Breadcrumbs
        manualBreadcrumbs={[{ href: "/projects", label: "Proyectos" }]}
      />
      <h1 className="primaryH1">Proyectos</h1>
      <div className="mt-6">
        <ListProjectsClient canCreate={canCreate} />
      </div>
    </section>
  );
}
