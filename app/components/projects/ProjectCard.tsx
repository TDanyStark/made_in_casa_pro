"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProjectType } from "@/lib/definitions";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { ProjectProgressBar } from "./ProjectProgressBar";
import { User, Package, HardDrive, Tag, UserPlus } from "lucide-react";

interface Props {
  project: ProjectType;
  showCreator?: boolean;
}

export function ProjectCard({ project, showCreator = false }: Props) {
  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {project.title}
            </h3>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{project.brand_name}</span>
            {project.client_name && (
              <span> · {project.client_name}</span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <ProjectProgressBar progress={project.progress} />

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {project.manager_name}
            </span>

            {project.product_name && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {project.product_name}
              </span>
            )}

            {project.campaign_name && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {project.campaign_name}
              </span>
            )}

            {showCreator && project.created_by_name && (
              <span className="flex items-center gap-1" title="Creado por">
                <UserPlus className="h-3 w-3" />
                {project.created_by_name}
              </span>
            )}

            {project.drive_folder_url && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(project.drive_folder_url!, "_blank");
                }}
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors"
                title="Abrir carpeta en Drive"
              >
                <HardDrive className="h-3 w-3" />
                Drive
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
