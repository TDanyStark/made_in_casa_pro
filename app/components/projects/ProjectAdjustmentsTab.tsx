"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/services/apiService";
import { ProjectAdjustmentType, UserRole } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Plus, ExternalLink, HardDrive } from "lucide-react";
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
}

export function ProjectAdjustmentsTab({
  projectId,
  projectStatus,
  productName,
  canEdit,
  currentUserId,
  currentUserRole,
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

  const [activeTab, setActiveTab] = useState<number | null>(
    adjustments.length > 0 ? adjustments[adjustments.length - 1].id : null
  );

  // If new adjustments are added, switch to the newest one
  if (adjustments.length > 0 && activeTab === null) {
    setActiveTab(adjustments[adjustments.length - 1].id);
  }

  const { mutate: createAdjustment, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await post<ProjectAdjustmentType>(`projects/${projectId}/adjustments`, {});
      if (!res.ok) throw new Error(res.error || "Error al crear ajuste");
      return res.data;
    },
    onSuccess: (newAdj) => {
      toast.success("Nuevo ajuste creado");
      queryClient.invalidateQueries({ queryKey: ["project-adjustments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      if (newAdj) setActiveTab(newAdj.id);
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

  const currentAdjustment = adjustments.find((a) => a.id === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ajustes (versiones adicionales) para este proyecto.</p>
          ) : (
            adjustments.map((adj) => (
              <Button
                key={adj.id}
                variant={activeTab === adj.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(adj.id)}
              >
                v{adj.version_number}
              </Button>
            ))
          )}
        </div>

        {canEdit && canCreateNew && (
          <Button onClick={() => createAdjustment()} disabled={isCreating} size="sm">
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Nuevo Ajuste
          </Button>
        )}
      </div>

      {currentAdjustment && (
        <div className="border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4">
            <div>
              <h3 className="text-lg font-semibold">Versión {currentAdjustment.version_number}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>Creado: {format(new Date(currentAdjustment.created_at), "MMM d, yyyy", { locale: es })}</span>
                {currentAdjustment.completed_at && (
                  <>
                    <span>•</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      Finalizado: {format(new Date(currentAdjustment.completed_at), "MMM d, yyyy", { locale: es })}
                    </span>
                  </>
                )}
              </div>
            </div>

            {currentAdjustment.drive_folder_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={currentAdjustment.drive_folder_url} target="_blank" rel="noopener noreferrer">
                  <HardDrive className="h-3.5 w-3.5 mr-1.5" />
                  Drive v{currentAdjustment.version_number}
                  <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                </a>
              </Button>
            )}
          </div>

          <div className="pt-2">
            <ProjectTasksTab
              projectId={projectId}
              productName={productName}
              canEdit={canEdit && currentAdjustment.status !== 'completed'}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              adjustmentId={currentAdjustment.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
