"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectType } from "@/lib/definitions";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { ProjectProgressBar } from "./ProjectProgressBar";
import {
  User,
  Package,
  Tag,
  UserPlus,
  ExternalLink,
  FolderOpen,
  LucideIcon,
} from "lucide-react";

interface Props {
  project: ProjectType;
  showCreator?: boolean;
}

interface MetaItemData {
  icon: LucideIcon;
  label: string;
  value: string;
}

function MetaItem({ icon: Icon, label, value }: MetaItemData) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted ring-1 ring-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm text-foreground leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

export function ProjectCard({ project, showCreator = false }: Props) {
  const metaItems: MetaItemData[] = [
    { icon: User, label: "Manager", value: project.manager_name },
  ];

  if (project.product_name) {
    metaItems.push({
      icon: Package,
      label: "Producto",
      value: project.product_name,
    });
  }
  
  if (showCreator && project.created_by_name) {
    metaItems.push({
      icon: UserPlus,
      label: "Creado por",
      value: project.created_by_name,
    });
  }

  if (project.campaign_name) {
    metaItems.push({
      icon: Tag,
      label: "Campaña",
      value: project.campaign_name,
    });
  }

  

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card className="py-2 relative h-full overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200">
        {/* Top accent gradient line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <CardContent className="space-y-3 px-4 py-3">
          {/* Header: title + status badge + drive */}
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {project.title}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                {project.drive_folder_url && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(project.drive_folder_url!, "_blank");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    title="Abrir carpeta en Drive"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </button>
                )}
                <ProjectStatusBadge status={project.status} />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {project.brand_name}
              </span>
              {project.client_name && <span> · {project.client_name}</span>}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Progress section */}
          <ProjectProgressBar progress={project.progress} />

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {metaItems.map((item) => (
              <MetaItem key={item.label} {...item} />
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
