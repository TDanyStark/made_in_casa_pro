"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProjectDetailType, UserRole } from "@/lib/definitions";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectQuotesTab } from "./ProjectQuotesTab";
import { ProjectNotesEditor } from "./ProjectNotesEditor";
import { ProjectCoManagersTab } from "./ProjectCoManagersTab";
import { ProjectInfoTab } from "./ProjectInfoTab";
import { ProjectManagerCard } from "./ProjectManagerCard";
import { ProjectBrandsCard } from "./ProjectBrandsCard";
import { ProjectAdjustmentsTab } from "./ProjectAdjustmentsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  PROJECT_EDIT_ROLES,
  PROJECT_FINANCIALS_VIEW_ROLES,
  PROJECT_SALE_PRICE_EDIT_ROLES,
} from "@/lib/role-groups";
import { ProjectFinancialCards } from "./ProjectFinancialCards";
import { ProjectMetricsTab } from "./ProjectMetricsTab";
import { ProjectSalePrice } from "./ProjectSalePrice";
import { EmailHistoryTable } from "@/components/notifications/EmailHistoryTable";

interface Props {
  projectId: number;
  userRole: UserRole;
  currentUserId?: number;
}

export function ProjectDetailClient({ projectId, userRole, currentUserId }: Props) {
  const canEdit = PROJECT_EDIT_ROLES.includes(userRole);
  const canViewFinancials = PROJECT_FINANCIALS_VIEW_ROLES.includes(userRole);
  const canEditSalePrice = PROJECT_SALE_PRICE_EDIT_ROLES.includes(userRole);
  // Los colaboradores solo ven Tareas y Notas.
  const canViewInfo = userRole !== UserRole.COLABORADOR;

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

      <ProjectSalePrice projectId={projectId} salePrice={project.sale_price} canEdit={canEditSalePrice} />

      {canViewFinancials && <ProjectFinancialCards projectId={projectId} />}

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          {canViewFinancials && <TabsTrigger value="metrics">Métricas</TabsTrigger>}
          {canEdit && <TabsTrigger value="quotes">Cotizaciones</TabsTrigger>}
          {canViewInfo && <TabsTrigger value="info">Información</TabsTrigger>}
          {canEdit && <TabsTrigger value="notifications">Notificaciones</TabsTrigger>}
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

        <TabsContent value="notes" className="mt-6">
          <ProjectNotesEditor
            projectId={projectId}
            initialContent={project.notes ?? ""}
            canEdit={canEdit}
          />
        </TabsContent>

        {canViewFinancials && (
          <TabsContent value="metrics" className="mt-6">
            <ProjectMetricsTab projectId={projectId} />
          </TabsContent>
        )}

        {canEdit && (
          <TabsContent value="quotes" className="mt-6">
            <ProjectQuotesTab projectId={projectId} canEdit={canEdit && project.status !== 'completed'} />
          </TabsContent>
        )}

        {canViewInfo && (
          <TabsContent value="info" className="mt-6 space-y-6">
            <ProjectManagerCard project={project} />
            <ProjectCoManagersTab
              projectId={projectId}
              clientId={project.client_id}
              mainManagerId={project.manager_id}
              coManagers={project.co_managers}
              canEdit={canEdit && project.status !== 'completed'}
            />
            {/* Las marcas asociadas se pueden editar incluso con el proyecto completado */}
            <ProjectBrandsCard project={project} canEdit={canEdit} />
            <ProjectInfoTab project={project} canEdit={canEdit && project.status !== 'completed'} />
          </TabsContent>
        )}

        {canEdit && (
          <TabsContent value="notifications" className="mt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Historial de emails enviados para este proyecto.
              </p>
              <EmailHistoryTable projectId={projectId} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
