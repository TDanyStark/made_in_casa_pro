import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { getUserRole, decrypt } from "@/lib/session";
import { getProjectById } from "@/lib/queries/projects";
import { cookies } from "next/headers";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const projectId = parseInt(id);

  if (isNaN(projectId)) notFound();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = sessionCookie ? await decrypt(sessionCookie) : null;

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
        <ProjectDetailClient
          projectId={projectId}
          userRole={userRole}
          currentUserId={session?.id}
        />
      </div>
    </section>
  );
}
