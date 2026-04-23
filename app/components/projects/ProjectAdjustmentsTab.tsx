"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/services/apiService";
import { ProjectAdjustmentType, UserRole } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, ExternalLink, HardDrive, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ProjectTasksTab } from "./ProjectTasksTab";
import { AdjustmentWizard } from "./AdjustmentWizard";

interface Props {
  projectId: number;
  projectStatus: string;
  productId: number | null;
  productName: string | null;
  canEdit: boolean;
  currentUserId?: number;
  currentUserRole: UserRole;
  createdByName?: string | null;
}

export function ProjectAdjustmentsTab({
  projectId,
  projectStatus,
  productId,
  productName,
  canEdit,
  currentUserId,
  currentUserRole,
  createdByName,
}: Props) {
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ["project-adjustments", projectId],
    queryFn: async () => {
      const res = await get<ProjectAdjustmentType[]>(`projects/${projectId}/adjustments`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60,
  });

  const lastAdjustment = adjustments.length > 0 ? adjustments[adjustments.length - 1] : null;
  const canCreateNew =
    projectStatus === "completed" ||
    (lastAdjustment && lastAdjustment.status === "completed");

  const handleConfirm = async (data: {
    notes: string;
    tasks: object[];
  }) => {
    setIsSubmitting(true);
    try {
      const res = await post<ProjectAdjustmentType>(`projects/${projectId}/adjustments`, data);
      if (!res.ok) throw new Error(res.error || "Error al crear ajuste");
      toast.success("Ajuste creado correctamente");
      setWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-adjustments", projectId], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["project", projectId], refetchType: "all" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al crear ajuste");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const allVersions = [...adjustments].reverse();

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Tareas y Versiones</h2>
            <p className="text-sm text-muted-foreground">Historial de todas las iteraciones del proyecto.</p>
          </div>

          {canEdit && canCreateNew && (
            <Button onClick={() => setWizardOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Ajuste
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {allVersions.map((adj, index) => (
            <VersionAccordion
              key={adj.id}
              adjustment={adj}
              isInitiallyExpanded={index === 0}
              isLatest={index === 0}
              projectId={projectId}
              projectStatus={projectStatus}
              productName={productName}
              canEdit={canEdit}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      </div>

      <AdjustmentWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        projectId={projectId}
        productId={productId}
        createdByName={createdByName}
        userRole={currentUserRole}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
      />
    </>
  );
}

function VersionAccordion({
  adjustment,
  isInitiallyExpanded,
  isLatest,
  projectId,
  projectStatus,
  productName,
  canEdit,
  currentUserId,
  currentUserRole,
}: {
  adjustment: ProjectAdjustmentType;
  isInitiallyExpanded: boolean;
  isLatest: boolean;
  projectId: number;
  projectStatus: string;
  productName: string | null;
  canEdit: boolean;
  currentUserId?: number;
  currentUserRole: UserRole;
}) {
  const [expanded, setExpanded] = useState(isInitiallyExpanded);

  const isCompleted = adjustment.status === "completed";
  // Allow editing the latest version when the project is active/in_adjustments,
  // even if that adjustment was previously marked completed (e.g. after a manual
  // status rollback). Older versions are always read-only.
  const projectIsEditable = projectStatus === "active" || projectStatus === "in_adjustments";
  const versionCanEdit = isLatest && projectIsEditable ? true : !isCompleted;
  const label = adjustment.version_number === 1 ? "Versión 1 (Original)" : `Versión ${adjustment.version_number}`;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="text-base font-semibold">{label}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className={isCompleted ? "text-green-600 dark:text-green-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
              {isCompleted ? "Completado" : "Activo"}
            </span>
            <span>•</span>
            <span>Creado: {format(new Date(adjustment.created_at), "MMM d, yyyy", { locale: es })}</span>
            {adjustment.completed_at && (
              <>
                <span>•</span>
                <span>Finalizado: {format(new Date(adjustment.completed_at), "MMM d, yyyy", { locale: es })}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {adjustment.drive_folder_url && (
            <Button variant="outline" size="sm" asChild onClick={e => e.stopPropagation()}>
              <a href={adjustment.drive_folder_url} target="_blank" rel="noopener noreferrer">
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
        <div className="border-t">
          {/* Notes section */}
          {adjustment.notes && (
            <div className="px-5 pt-4 pb-3 border-b bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notas del ajuste</p>
              <div
                className="text-sm prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: adjustment.notes }}
              />
            </div>
          )}

          <div className="p-4">
            <ProjectTasksTab
              projectId={projectId}
              productName={productName}
              canEdit={canEdit && versionCanEdit}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              adjustmentId={adjustment.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
