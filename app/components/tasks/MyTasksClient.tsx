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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  Clock,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

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
  const [validateDialog, setValidateDialog] = useState<ValidateDialogState>({
    open: false,
    task: null,
    siblings: [],
  });
  const [validateAction, setValidateAction] = useState<"approve" | "reject">("approve");
  const [validateTarget, setValidateTarget] = useState("");
  const [validateNotes, setValidateNotes] = useState("");
  const [validating, setValidating] = useState(false);

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
  const handleComplete = async (task: MyTask) => {
    setCompletingId(task.id);
    try {
      const res = await post(`projects/${task.project_id}/tasks/${task.id}/complete`, {});
      if (!res.ok) throw new Error(res.error);
      const data = res.data as { blockedReason?: string | null };
      if (data?.blockedReason) {
        toast.warning(data.blockedReason, { duration: 6000 });
      } else {
        toast.success("Tarea completada");
      }
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al completar";
      toast.error(msg);
    } finally {
      setCompletingId(null);
    }
  };

  // Open validate dialog — need to fetch siblings
  const openValidate = async (task: MyTask) => {
    try {
      const res = await get<MyTask[]>(`projects/${task.project_id}/tasks`);
      const allTasks = res.ok ? (res.data ?? []) : [];
      const siblings = allTasks
        .filter((t) => t.project_product_id === task.project_product_id)
        .sort((a, b) => a.order_index - b.order_index);
      setValidateDialog({ open: true, task, siblings });
      setValidateAction("approve");
      setValidateTarget("");
      setValidateNotes("");
    } catch {
      toast.error("Error al cargar las tareas del producto");
    }
  };

  const handleValidate = async () => {
    if (!validateDialog.task) return;
    setValidating(true);
    try {
      const body: Record<string, unknown> = {
        action: validateAction,
        notes: validateNotes || null,
      };
      if (validateAction === "reject") {
        if (!validateTarget) {
          toast.error("Selecciona a qué tarea regresar");
          return;
        }
        body.target_order_index = parseInt(validateTarget);
      }

      const res = await post(
        `projects/${validateDialog.task.project_id}/tasks/${validateDialog.task.id}/validate`,
        body
      );
      if (!res.ok) throw new Error(res.error);

      const data = res.data as { blockedReason?: string | null };
      if (validateAction === "approve") {
        if (data?.blockedReason) {
          toast.warning(data.blockedReason, { duration: 6000 });
        } else {
          toast.success("Validación aprobada");
        }
      } else {
        toast.success("Enviado a corrección");
      }

      setValidateDialog({ open: false, task: null, siblings: [] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al validar");
    } finally {
      setValidating(false);
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
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                STATUS_CONFIG[task.status]?.className
              }`}
            >
              {task.status === "waiting" && <Clock className="h-3 w-3" />}
              {task.status === "blocked" && <AlertTriangle className="h-3 w-3" />}
              {STATUS_CONFIG[task.status]?.label}
            </span>

            {canAct && !isValidation && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleComplete(task)}
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
      <Dialog
        open={validateDialog.open}
        onOpenChange={(open) => {
          if (!open) setValidateDialog({ open: false, task: null, siblings: [] });
        }}
      >
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              Validar tarea
            </DialogTitle>
          </DialogHeader>
          {validateDialog.task && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Tarea: <span className="font-medium text-foreground">{validateDialog.task.title}</span>
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Acción</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValidateAction("approve")}
                    className={`rounded-md border p-3 text-sm font-medium transition-colors ${
                      validateAction === "approve"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    <CheckCircle className="h-4 w-4 mx-auto mb-1" />
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidateAction("reject")}
                    className={`rounded-md border p-3 text-sm font-medium transition-colors ${
                      validateAction === "reject"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    <ChevronDown className="h-4 w-4 mx-auto mb-1" />
                    Rechazar
                  </button>
                </div>
              </div>

              {validateAction === "reject" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Regresar al paso</label>
                  <Select value={validateTarget} onValueChange={setValidateTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tarea destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {validateDialog.siblings
                        .filter(
                          (t) =>
                            t.id !== validateDialog.task!.id &&
                            t.order_index < validateDialog.task!.order_index
                        )
                        .map((t) => (
                          <SelectItem key={t.id} value={t.order_index.toString()}>
                            {t.order_index + 1}. {t.title}
                            {t.assigned_user_name && ` — ${t.assigned_user_name}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notas (opcional)</label>
                <Textarea
                  rows={2}
                  placeholder={
                    validateAction === "approve"
                      ? "Comentario opcional..."
                      : "Explica qué debe corregirse..."
                  }
                  value={validateNotes}
                  onChange={(e) => setValidateNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setValidateDialog({ open: false, task: null, siblings: [] })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleValidate}
              disabled={validating || (validateAction === "reject" && !validateTarget)}
              className={`gap-2 ${
                validateAction === "reject"
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {validating && <Loader2 className="h-4 w-4 animate-spin" />}
              {validateAction === "approve" ? "Aprobar" : "Rechazar y enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
