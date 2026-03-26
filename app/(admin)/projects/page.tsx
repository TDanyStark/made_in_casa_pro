import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ListProjectsClient } from "@/components/projects/ListProjectsClient";
import { getUserRole } from "@/lib/session";
import { UserRole } from "@/lib/definitions";

export default async function ProjectsPage() {
  const role = await getUserRole();
  const canCreate = role === UserRole.ADMIN || role === UserRole.DIRECTIVO || role === UserRole.COMERCIAL;

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
