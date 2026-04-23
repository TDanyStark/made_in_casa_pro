"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, ExternalLink, HardDrive, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProjectDetailType, ProjectStatus } from "@/lib/definitions";
import { ProjectProgressBar } from "./ProjectProgressBar";
import { patch, post } from "@/lib/services/apiService";
import EditableText from "@/components/input/EditableText";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Completado" },
  { value: "archived", label: "Archivado" },
  { value: "in_adjustments", label: "En Ajustes" },
];

interface Props {
  project: ProjectDetailType;
}

export function ProjectHeader({ project }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [completing, setCompleting] = useState(false);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    try {
      const res = await patch(`projects/${project.id}`, { status: newStatus });
      if (!res.ok) throw new Error(res.error);
      setStatus(newStatus);
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Estado actualizado");
    } catch {
      toast.error("Error al actualizar el estado");
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await post(`projects/${project.id}/complete`, {});
      if (!res.ok) throw new Error(res.error);
      setStatus("completed");
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Proyecto completado");
    } catch {
      toast.error("Error al completar el proyecto");
    } finally {
      setCompleting(false);
    }
  };

  const canComplete =
    project.progress === 100 &&
    (status === "active" || status === "in_adjustments");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-tight">
            <EditableText
              height={32}
              value={project.title}
              endpoint={`projects/${project.id}`}
              fieldName="title"
              as="span"
              endpointIdParam="id"
            />
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{project.brand_name}</span>
            {project.client_name && <span> · {project.client_name}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {project.drive_folder_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer">
                <HardDrive className="h-3.5 w-3.5 mr-1.5" />
                Drive
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </a>
            </Button>
          )}

          {canComplete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs gap-1.5" disabled={completing}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Completar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Completar proyecto</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas las tareas han sido completadas. Al confirmar, el proyecto quedara
                    marcado como completado y podras iniciar versiones de ajuste si es necesario.
                    Esta accion no se puede deshacer directamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleComplete} disabled={completing}>
                    {completing ? "Completando..." : "Completar proyecto"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Select value={status} onValueChange={(v) => handleStatusChange(v as ProjectStatus)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{project.manager_name}</span>
          {project.co_managers.length > 0 && (
            <span>+ {project.co_managers.length} co-responsable{project.co_managers.length > 1 ? "s" : ""}</span>
          )}
        </div>

        {project.campaign_name && (
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {project.campaign_name}
          </span>
        )}
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
          <span>Creado: {format(new Date(project.created_at), "MMM d, yyyy", { locale: es })}</span>
          {project.completed_at && (
            <>
              <span>•</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Finalizado: {format(new Date(project.completed_at), "MMM d, yyyy", { locale: es })}</span>
            </>
          )}
        </div>
      </div>

      <ProjectProgressBar progress={project.progress} />
    </div>
  );
}
