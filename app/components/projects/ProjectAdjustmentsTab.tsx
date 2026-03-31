"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/services/apiService";
import { ProjectAdjustmentType, UserRole } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Plus, ExternalLink, HardDrive, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ProjectTasksTab } from "./ProjectTasksTab";

interface Props {
  projectId: number;
  projectStatus: string;
  productName: string | null;
  canEdit: boolean;
  currentUserId?: number;
  currentUserRole: UserRole;
  projectCreatedAt: string;
  projectCompletedAt?: string;
  projectDriveUrl?: string | null;
}

export function ProjectAdjustmentsTab({
  projectId,
  projectStatus,
  productName,
  canEdit,
  currentUserId,
  currentUserRole,
  projectCreatedAt,
  projectCompletedAt,
  projectDriveUrl,
}: Props) {
  const queryClient = useQueryClient();

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ["project-adjustments", projectId],
    queryFn: async () => {
      const res = await get<ProjectAdjustmentType[]>(`projects/${projectId}/adjustments`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60,
  });

  const { mutate: createAdjustment, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await post<{ data: ProjectAdjustmentType; ok: boolean; error?: string }>(`projects/${projectId}/adjustments`, {});
      if (!res.ok) throw new Error(res.error || "Error al crear ajuste");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Nuevo ajuste creado");
      queryClient.invalidateQueries({ queryKey: ["project-adjustments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const lastAdjustment = adjustments.length > 0 ? adjustments[adjustments.length - 1] : null;
  const canCreateNew = 
    projectStatus === "completed" || 
    (lastAdjustment && lastAdjustment.status === "completed");

  // Combinar V1 (proyecto original) y ajustes
  const allVersions = [
    {
      id: "v1",
      title: "Versión 1 (Original)",
      adjustmentId: null,
      status: adjustments.length > 0 ? "completed" : projectStatus,
      createdAt: projectCreatedAt,
      completedAt: projectCompletedAt,
      driveUrl: projectDriveUrl,
    },
    ...adjustments.map((adj) => ({
      id: `v${adj.version_number}`,
      title: `Versión ${adj.version_number}`,
      adjustmentId: adj.id,
      status: adj.status,
      createdAt: adj.created_at,
      completedAt: adj.completed_at,
      driveUrl: adj.drive_folder_url,
    }))
  ].reverse(); // Invertir para mostrar la versión más reciente (ej. V2) arriba

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Historial de Tareas y Versiones</h2>
          <p className="text-sm text-muted-foreground">Administra las iteraciones de este proyecto.</p>
        </div>

        {canEdit && canCreateNew && (
          <Button onClick={() => createAdjustment()} disabled={isCreating} size="sm">
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Nuevo Ajuste
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {allVersions.map((version, index) => {
          // Expandir por defecto solo la versión más reciente
          return (
            <VersionAccordion
              key={version.id}
              version={version}
              isInitiallyExpanded={index === 0}
              projectId={projectId}
              productName={productName}
              canEdit={canEdit}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          );
        })}
      </div>
    </div>
  );
}

function VersionAccordion({
  version,
  isInitiallyExpanded,
  projectId,
  productName,
  canEdit,
  currentUserId,
  currentUserRole,
}: {
  version: {
    id: string;
    title: string;
    adjustmentId: number | null;
    status: string;
    createdAt: string;
    completedAt?: string;
    driveUrl?: string | null;
  };
  isInitiallyExpanded: boolean;
  projectId: number;
  productName: string | null;
  canEdit: boolean;
  currentUserId?: number;
  currentUserRole: UserRole;
}) {
  const [expanded, setExpanded] = useState(isInitiallyExpanded);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="text-base font-semibold">{version.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className={version.status === 'completed' ? "text-green-600 dark:text-green-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
              {version.status === 'completed' ? 'Completado' : 'Activo'}
            </span>
            <span>•</span>
            <span>Creado: {format(new Date(version.createdAt), "MMM d, yyyy", { locale: es })}</span>
            {version.completedAt && (
              <>
                <span>•</span>
                <span>Finalizado: {format(new Date(version.completedAt), "MMM d, yyyy", { locale: es })}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {version.driveUrl && (
            <Button variant="outline" size="sm" asChild onClick={(e) => e.stopPropagation()}>
              <a href={version.driveUrl} target="_blank" rel="noopener noreferrer">
                <HardDrive className="h-3.5 w-3.5 mr-1.5" />
                Drive
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </a>
            </Button>
          )}
          <div className="p-1 text-muted-foreground">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t bg-muted/10">
          <ProjectTasksTab
            projectId={projectId}
            productName={productName}
            canEdit={canEdit && version.status !== 'completed'}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            adjustmentId={version.adjustmentId}
          />
        </div>
      )}
    </div>
  );
}
