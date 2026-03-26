"use client";

import { Badge } from "@/components/ui/badge";
import { ProjectStatus } from "@/lib/definitions";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Activo",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200",
  },
  paused: {
    label: "Pausado",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200",
  },
  completed: {
    label: "Completado",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
  },
  archived: {
    label: "Archivado",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200",
  },
};

interface Props {
  status: ProjectStatus;
}

export function ProjectStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
