import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { getUserRole } from "@/lib/session";
import { getProjectById } from "@/lib/queries/projects";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const projectId = parseInt(id);

  if (isNaN(projectId)) notFound();

  const [project, userRole] = await Promise.all([
    getProjectById(projectId),
    getUserRole(),
  ]);

  if (!project) notFound();

  return (
    <section className="container pb-12">
      <Breadcrumbs
        manualBreadcrumbs={[
          { href: "/projects", label: "Proyectos" },
          { href: `/projects/${id}`, label: project.title },
        ]}
      />
      <div className="mt-4">
        <ProjectDetailClient projectId={projectId} userRole={userRole} />
      </div>
    </section>
  );
}
