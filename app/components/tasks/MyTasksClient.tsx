"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { get, post } from "@/lib/services/apiService";
import {
  ProjectTaskType,
  TaskType,
  TaskFlag,
  ProjectTaskStatus,
} from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskValidationDialog } from "./TaskValidationDialog";
import { TaskCompleteDialog } from "./TaskCompleteDialog";
import { TaskHistoryDialog } from "./TaskHistoryDialog";
import {
  CheckCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  History as HistoryIcon,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Status/type configs ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectTaskStatus, { label: string; className: string }> = {
  not_started: { label: "Sin iniciar", className: "bg-muted text-muted-foreground" },
  waiting: { label: "En espera", className: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400" },
  in_progress: { label: "En progreso", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Completado", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  blocked: { label: "Bloqueado", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const TYPE_CONFIG: Record<TaskType, { label: string; className: string }> = {
  execution: { label: "Ejecución", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400" },
  validation: { label: "Validación", className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400" },
};

const FLAG_CONFIG: Record<TaskFlag, { label: string; className: string }> = {
  new: { label: "Nueva", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  correction: { label: "Corrección", className: "bg-amber-50 text-amber-700 border-amber-200" },
  adjustment: { label: "Ajuste", className: "bg-orange-50 text-orange-700 border-orange-200" },
};

// ─── Extended task type with project info ─────────────────────────────────────

interface MyTask extends ProjectTaskType {
  project_title?: string;
  product_name?: string;
}

// ─── Validate dialog state ────────────────────────────────────────────────────

interface ValidateDialogState {
  open: boolean;
  task: MyTask | null;
  siblings: MyTask[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MyTasksClient() {
  const queryClient = useQueryClient();

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<MyTask | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [taskForHistory, setTaskForHistory] = useState<MyTask | null>(null);
  const [validateDialog, setValidateDialog] = useState<ValidateDialogState>({
    open: false,
    task: null,
    siblings: [],
  });

  const { data: tasks = [], isLoading } = useQuery<MyTask[]>({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const res = await get<MyTask[]>("my-tasks");
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const activeTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "not_started");
  const waitingTasks = tasks.filter((t) => t.status === "waiting");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  // Complete execution task
  const openCompleteDialog = (task: MyTask) => {
    setTaskToComplete(task);
    setCompleteDialogOpen(true);
  };

  const openHistoryDialog = (task: MyTask) => {
    setTaskForHistory(task);
    setHistoryDialogOpen(true);
  };

  // Open validate dialog — need to fetch siblings
  const openValidate = async (task: MyTask) => {
    try {
      const res = await get<MyTask[]>(`projects/${task.project_id}/tasks`);
      const allTasks = res.ok ? (res.data ?? []) : [];
      const siblings = allTasks
        .filter((t) => t.project_id === task.project_id)
        .sort((a, b) => a.order_index - b.order_index);
      setValidateDialog({ open: true, task, siblings });
    } catch {
      toast.error("Error al cargar las tareas del producto");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
        <CheckCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">No tienes tareas activas</p>
        <p className="text-sm text-muted-foreground mt-1">
          Las tareas que se te asignen aparecerán aquí.
        </p>
      </div>
    );
  }

  const renderTask = (task: MyTask) => {
    const taskType = task.task_type ?? "execution";
    const taskFlag = task.task_flag ?? "new";
    const isValidation = taskType === "validation";
    const isInProgress = task.status === "in_progress" || task.status === "not_started";
    const canAct = isInProgress;

    return (
      <div
        key={task.id}
        className={`rounded-lg border bg-card p-4 space-y-3 ${
          task.status === "blocked" ? "border-destructive/40 bg-destructive/5" : ""
        } ${task.status === "waiting" ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-medium text-sm">{task.title}</span>
              <Badge variant="outline" className={`text-xs ${TYPE_CONFIG[taskType]?.className}`}>
                {isValidation && <ShieldCheck className="h-3 w-3 mr-1" />}
                {TYPE_CONFIG[taskType]?.label}
              </Badge>
              {taskFlag !== "new" && (
                <Badge variant="outline" className={`text-xs ${FLAG_CONFIG[taskFlag]?.className}`}>
                  {FLAG_CONFIG[taskFlag]?.label}
                </Badge>
              )}
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
            )}

            {/* Dates section */}
            {(task.assigned_at || task.completed_at) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-1">
                 {task.assigned_at && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                       <Clock className="h-3 w-3" />
                       Asignada: {format(new Date(task.assigned_at), "d MMM, HH:mm", { locale: es })}
                    </div>
                 )}
                 {task.completed_at && (
                    <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                       <CheckCircle className="h-3 w-3" />
                       Completada: {format(new Date(task.completed_at), "d MMM, HH:mm", { locale: es })}
                    </div>
                 )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
              {task.project_title && (
                <Link
                  href={`/projects/${task.project_id}`}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {task.project_title}
                </Link>
              )}
              {task.product_name && (
                <span>· {task.product_name}</span>
              )}
            </div>
          </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => openHistoryDialog(task)}
                  title="Ver historial de entregables"
                >
                  <HistoryIcon className="h-3.5 w-3.5" />
                </Button>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    STATUS_CONFIG[task.status]?.className
                  }`}
                >
                  {task.status === "waiting" && <Clock className="h-3 w-3" />}
                  {task.status === "blocked" && <AlertTriangle className="h-3 w-3" />}
                  {STATUS_CONFIG[task.status]?.label}
                </span>
              </div>

              {canAct && !isValidation && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => openCompleteDialog(task)}
                  disabled={completingId === task.id}
                >
                  {completingId === task.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Completar
                </Button>
              )}

            {canAct && isValidation && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                onClick={() => openValidate(task)}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Validar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Activas ({activeTasks.length})
          </h2>
          {activeTasks.map(renderTask)}
        </section>
      )}

      {/* Blocked tasks */}
      {blockedTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Bloqueadas ({blockedTasks.length})
          </h2>
          {blockedTasks.map(renderTask)}
        </section>
      )}

      {/* Waiting tasks */}
      {waitingTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Próximas — esperando turno ({waitingTasks.length})
          </h2>
          {waitingTasks.map(renderTask)}
        </section>
      )}

      {/* Validate dialog */}
      <TaskValidationDialog
        open={validateDialog.open}
        onOpenChange={(open) => {
          if (!open) setValidateDialog({ open: false, task: null, siblings: [] });
        }}
        task={validateDialog.task}
        siblings={validateDialog.siblings}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        }}
      />

      {/* Complete Dialog */}
      <TaskCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        task={taskToComplete}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        }}
      />

      {/* History Dialog */}
      <TaskHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        taskId={taskForHistory?.id ?? null}
        taskTitle={taskForHistory?.title ?? ""}
      />
    </div>
  );
}
