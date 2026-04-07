"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProjectDetailType, UserRole } from "@/lib/definitions";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectQuotesTab } from "./ProjectQuotesTab";
import { ProjectNotesEditor } from "./ProjectNotesEditor";
import { ProjectCoManagersTab } from "./ProjectCoManagersTab";
import { ProjectInfoTab } from "./ProjectInfoTab";
import { ProjectAdjustmentsTab } from "./ProjectAdjustmentsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PROJECT_EDIT_ROLES } from "@/lib/role-groups";

interface Props {
  projectId: number;
  userRole: UserRole;
  currentUserId?: number;
}

export function ProjectDetailClient({ projectId, userRole, currentUserId }: Props) {
  const canEdit = PROJECT_EDIT_ROLES.includes(userRole);

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await get<ProjectDetailType>(`projects/${projectId}`);
      if (!res.ok) throw new Error(res.error);
      return res.data as unknown as ProjectDetailType;
    },
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Proyecto no encontrado</p>
        <Button asChild variant="outline">
          <Link href="/projects">Volver a proyectos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ProjectHeader project={project} />

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">
            Tareas
          </TabsTrigger>
          {canEdit && (
            <TabsTrigger value="quotes">Cotizaciones</TabsTrigger>
          )}
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="co-managers">
            Co-responsables
            {project.co_managers.length > 0 && (
              <span className="ml-1.5 text-xs opacity-60">{project.co_managers.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="info">Información</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <ProjectAdjustmentsTab
            projectId={projectId}
            projectStatus={project.status}
            productId={project.product_id ?? null}
            productName={project.product_name}
            canEdit={canEdit}
            currentUserId={currentUserId}
            currentUserRole={userRole}
            createdByName={project.created_by_name}
          />
        </TabsContent>

        {canEdit && (
          <TabsContent value="quotes" className="mt-6">
            <ProjectQuotesTab projectId={projectId} canEdit={canEdit && project.status !== 'completed'} />
          </TabsContent>
        )}

        <TabsContent value="notes" className="mt-6">
          <ProjectNotesEditor
            projectId={projectId}
            initialContent={project.notes ?? ""}
          />
        </TabsContent>

        <TabsContent value="co-managers" className="mt-6">
          <ProjectCoManagersTab
            projectId={projectId}
            mainManagerId={project.manager_id}
            coManagers={project.co_managers}
            canEdit={canEdit && project.status !== 'completed'}
          />
        </TabsContent>

        <TabsContent value="info" className="mt-6">
          <ProjectInfoTab project={project} canEdit={canEdit && project.status !== 'completed'} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
