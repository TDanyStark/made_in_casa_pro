import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CollaboratorProjectView } from "@/components/projects/CollaboratorProjectView";
import { getUserRole, decrypt } from "@/lib/session";
import { getProjectDetail } from "@/lib/queries/projects";
import { getTasksByProject, getTasksForQuoteView, getOpenQuoteTaskIds } from "@/lib/queries/projectTasks";
import { cookies } from "next/headers";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CollaboratorProjectPage({ params }: Props) {
  const { id } = await params;
  const projectId = parseInt(id);

  if (isNaN(projectId)) notFound();

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = sessionCookie ? await decrypt(sessionCookie) : null;

  // Verify collaborator has invitation to quote this project
  const invitedTasks = await getTasksForQuoteView(projectId, session?.id ?? 0);
  if (invitedTasks.length === 0) {
    return (
      <section className="container pb-12">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground mb-4">
            No tienes invitación para cotizar en este proyecto.
          </p>
        </div>
      </section>
    );
  }

  const [project, userRole, tasks, openQuoteTaskIds] = await Promise.all([
    getProjectDetail(projectId),
    getUserRole(),
    getTasksByProject(projectId),
    getOpenQuoteTaskIds(projectId, session?.id ?? 0),
  ]);

  if (!project) notFound();

  // Only include task IDs that are still open for quoting (not yet assigned to someone else)
  const invitedTaskIds = openQuoteTaskIds;

  return (
    <section className="container pb-12">
      <Breadcrumbs
        manualBreadcrumbs={[
          { href: "/my-quotes", label: "Mis Cotizaciones" },
          { href: `/my-quotes/projects/${id}`, label: project.title },
        ]}
      />
      <div className="mt-4">
        <CollaboratorProjectView
          projectId={projectId}
          project={project}
          tasks={tasks}
          invitedTaskIds={invitedTaskIds}
          userRole={userRole}
          currentUserId={session?.id}
        />
      </div>
    </section>
  );
}
