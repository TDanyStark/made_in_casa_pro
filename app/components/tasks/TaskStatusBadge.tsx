"use client";

import { Badge } from "@/components/ui/badge";
import { ProjectTaskStatus } from "@/lib/definitions";
import { cn } from "@/lib/utils";

export const TASK_STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  not_started: "Sin iniciar",
  waiting: "En espera",
  in_progress: "En progreso",
  completed: "Completada",
  blocked: "Bloqueada",
};

export const TASK_STATUS_STYLES: Record<ProjectTaskStatus, string> = {
  not_started:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  waiting:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  in_progress:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  completed:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  blocked:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
};

export const TASK_STATUS_DOT: Record<ProjectTaskStatus, string> = {
  not_started: "bg-slate-400",
  waiting: "bg-amber-400",
  in_progress: "bg-blue-500 animate-pulse",
  completed: "bg-emerald-500",
  blocked: "bg-red-500",
};

interface TaskStatusBadgeProps {
  status: ProjectTaskStatus;
  className?: string;
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 border font-medium",
        TASK_STATUS_STYLES[status],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", TASK_STATUS_DOT[status])} />
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}
