"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, HardDrive, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectDetailType, ProjectStatus } from "@/lib/definitions";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { ProjectProgressBar } from "./ProjectProgressBar";
import { patch } from "@/lib/services/apiService";
import EditableText from "@/components/input/EditableText";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Completado" },
  { value: "archived", label: "Archivado" },
];

interface Props {
  project: ProjectDetailType;
}

export function ProjectHeader({ project }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ProjectStatus>(project.status);

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
      </div>

      <ProjectProgressBar progress={project.progress} />
    </div>
  );
}
