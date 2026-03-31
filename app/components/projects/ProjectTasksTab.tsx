"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { get, post, patch, del } from "@/lib/services/apiService";
import {
  ProjectTaskType,
  ProjectTaskStatus,
  TaskType,
  TaskFlag,
} from "@/lib/definitions";
import { TaskAssignmentSelector, AssignMode } from "@/components/tasks/TaskAssignmentSelector";
import { SortableList } from "@/components/ui/sortable-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskValidationDialog } from "@/components/tasks/TaskValidationDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  CheckCircle,
  ChevronDown,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Status config ────────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<ProjectTaskStatus, { label: string; className: string; icon?: React.ReactNode }> = {
  not_started: {
    label: "Sin iniciar",
    className: "bg-muted text-muted-foreground",
  },
  waiting: {
    label: "En espera",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
    icon: <Clock className="h-3 w-3" />,
  },
  in_progress: {
    label: "En progreso",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "Completado",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  blocked: {
    label: "Bloqueado",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; className: string }> = {
  execution: { label: "Ejecución", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400" },
  validation: { label: "Validación", className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400" },
};

const TASK_FLAG_CONFIG: Record<TaskFlag, { label: string; className: string }> = {
  new: { label: "Nueva", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400" },
  correction: { label: "Corrección", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400" },
  adjustment: { label: "Ajuste", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400" },
};

// ─── Task form schema ────────────────────────────────────────────────────────

const taskSchema = z
  .object({
    title: z.string().min(1, "El título es requerido"),
    description: z.string().optional().nullable(),
    status: z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"]).optional(),
    task_type: z.enum(["execution", "validation"]).default("execution"),
    requires_quote: z.boolean().default(false),
    assign_mode: z.enum(["auto", "commercial", "specific"]).default("auto"),
    area_id: z.coerce.number().positive().optional().nullable(),
    assigned_user_id: z.coerce.number().positive().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.assign_mode === "specific" && !data.assigned_user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes seleccionar una persona cuando el modo es 'Persona específica'",
        path: ["assigned_user_id"],
      });
    }
    if (data.assign_mode === "auto" && !data.area_id && !data.requires_quote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona un área para la auto-asignación, o cambia a otro modo",
        path: ["area_id"],
      });
    }
  });

type TaskFormValues = z.infer<typeof taskSchema>;

function deriveAssignMode(task: ProjectTaskType): AssignMode {
  if (task.assign_to_commercial === 1) return "commercial";
  if (task.assigned_user_id !== null) return "specific";
  return "auto";
}

function rolLabel(rolId: number | null): string | null {
  if (rolId === 1) return "Admin";
  if (rolId === 2) return "Directivo";
  if (rolId === 3) return "Comercial";
  return null;
}

// ─── RefreshCountdown ─────────────────────────────────────────────────────────

function RefreshCountdown({
  onRefresh,
  dataUpdatedAt,
}: {
  onRefresh: () => void;
  dataUpdatedAt: number;
}) {
  const [progress, setProgress] = useState(1); // 1 = full, 0 = empty
  const INTERVAL_MS = 30_000;
  const size = 32;
  const radius = 13;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    setProgress(1);
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / INTERVAL_MS);
      setProgress(remaining);
    }, 100);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  const strokeDashoffset = circumference * (1 - progress);

  return (
    <button
      onClick={onRefresh}
      title="Actualizar tareas"
      className="relative flex items-center justify-center hover:opacity-75 transition-opacity"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={2.5}
          opacity={0.2}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      {/* Reload icon centered */}
      <RotateCcw className="absolute" size={12} />
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  productName: string | null;
  canEdit: boolean;
  currentUserId?: number;
  currentUserRole?: number;
}

// ─── Validate dialog ─────────────────────────────────────────────────────────

interface ValidateDialogState {
  open: boolean;
  task: ProjectTaskType | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectTasksTab({
  projectId,
  productName,
  canEdit,
  currentUserId,
  currentUserRole,
}: Props) {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskType | null>(null);
  const [editingAssigneeOnly, setEditingAssigneeOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [validateDialog, setValidateDialog] = useState<ValidateDialogState>({
    open: false,
    task: null,
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      area_id: null,
      assigned_user_id: null,
      task_type: "execution",
      requires_quote: false,
    },
  });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data: tasks = [],
    isLoading: isLoadingTasks,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const res = await get<ProjectTaskType[]>(`projects/${projectId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60,
    refetchInterval: reordering ? false : 30_000,
    refetchIntervalInBackground: false,
  });

  const selectedTaskType = form.watch("task_type");
  const requiresQuote = form.watch("requires_quote");
  const assignMode = form.watch("assign_mode");
  const areaId = form.watch("area_id");

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const sortedTasks = [...tasks].sort((a, b) => a.order_index - b.order_index || a.id - b.id);

  const isMyTask = (task: ProjectTaskType) =>
    currentUserId !== undefined && task.assigned_user_id === currentUserId;

  const isAdmin = currentUserRole === 1 || currentUserRole === 2;

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingTask(null);
    setEditingAssigneeOnly(false);
    // New tasks default to waiting unless it's the very first one
    const defaultStatus = tasks.length === 0 ? "not_started" : "waiting";
    form.reset({
      title: "",
      description: "",
      status: defaultStatus,
      task_type: "execution",
      requires_quote: false,
      assign_mode: "auto",
      area_id: null,
      assigned_user_id: null,
    });
    setDialogOpen(true);
  };

  const openEdit = (task: ProjectTaskType) => {
    const assigneeOnly = task.status === "blocked";
    setEditingTask(task);
    setEditingAssigneeOnly(assigneeOnly);
    form.reset({
      title: task.title, description: task.description ?? "",
      status: task.status, task_type: task.task_type ?? "execution",
      requires_quote: task.requires_quote === 1,
      assign_mode: deriveAssignMode(task),
      area_id: task.area_id ?? null, assigned_user_id: task.assigned_user_id ?? null,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: TaskFormValues) => {
    // Rule: Validation task cannot be the first one (order_index === 0)
    // For new task: it's the first if there are no tasks yet
    // For editing: it's the first if its order_index is 0
    const isFirstTask = editingTask ? editingTask.order_index === 0 : tasks.length === 0;
    if (values.task_type === "validation" && isFirstTask) {
      form.setError("task_type", { 
        type: "manual", 
        message: "Una tarea de validación no puede ser la primera tarea del proyecto." 
      });
      return;
    }

    setSubmitting(true);
    try {
      const assign_to_commercial = values.assign_mode === "commercial" ? 1 : 0;
      const area_id = values.assign_mode !== "commercial" ? (values.area_id ?? null) : null;
      const assigned_user_id = values.assign_mode === "specific" ? (values.assigned_user_id ?? null) : null;

      const payload = {
        title: values.title, description: values.description ?? null,
        status: values.status, task_type: values.task_type,
        requires_quote: values.requires_quote ? 1 : 0,
        assign_to_commercial, area_id, assigned_user_id,
      };

      if (editingTask) {
        const res = await patch(`projects/${projectId}/tasks/${editingTask.id}`, payload);
        if (!res.ok) throw new Error(res.error);
        toast.success("Tarea actualizada");
      } else {
        const res = await post(`projects/${projectId}/tasks`, payload);
        if (!res.ok) throw new Error(res.error);
        toast.success("Tarea creada");
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch {
      toast.error("Error al guardar la tarea");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async (task: ProjectTaskType) => {
    setCompletingTaskId(task.id);
    try {
      const res = await post(`projects/${projectId}/tasks/${task.id}/complete`, {});
      if (!res.ok) throw new Error(res.error);

      const data = res.data as { blockedReason?: string | null };
      if (data?.blockedReason) {
        toast.warning(data.blockedReason, { duration: 6000 });
      } else {
        toast.success("Tarea completada. Se activó la siguiente tarea.");
      }
      invalidateAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al completar tarea";
      toast.error(msg);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const openValidateDialog = (task: ProjectTaskType) => {
    setValidateDialog({ open: true, task });
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const res = await del(`projects/${projectId}/tasks/${taskId}`);
      if (!res.ok) throw new Error(res.error);
      toast.success("Tarea eliminada");
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch {
      toast.error("Error al eliminar tarea");
    }
  };

  const handleReorder = async (reordered: ProjectTaskType[]) => {
    // Business Rule: Completed tasks cannot be reordered
    // Check if any task that was completed moved or if a new task took its place
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].status === "completed") {
        if (reordered[i].id !== tasks[i].id) {
          toast.error("No puedes reordenar las tareas completadas ni mover tareas antes de ellas.");
          return;
        }
      }
    }

    setReordering(true);

    // Actualizamos localmente el order_index de cada tarea para que el
    // componente no "salte" de vuelta al orden anterior mientras se guarda.
    const optimisticTasks = reordered.map((task, index) => ({
      ...task,
      order_index: index,
    }));

    queryClient.setQueryData(["project-tasks", projectId], optimisticTasks);

    try {
      const res = await post(`projects/${projectId}/tasks/reorder`, {
        orderedIds: optimisticTasks.map((t) => t.id),
      });
      if (!res.ok) throw new Error(res.error);
      
      // Invalidamos para asegurar que tenemos los datos frescos del servidor
      invalidateAll();
    } catch {
      toast.error("Error al reordenar");
      invalidateAll();
    } finally {
      setReordering(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoadingTasks) {
    return <Skeleton className="h-64 w-full" />;
  }

  const completed = sortedTasks.filter((t) => t.status === "completed").length;

  return (
    <TooltipProvider>
      <>
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {productName && (
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{productName}</span>
              </div>
            )}
            {sortedTasks.length > 0 && (
              <span className="text-sm text-muted-foreground">
                — {completed} de {sortedTasks.length} tareas completadas
                {reordering && <Loader2 className="inline ml-2 h-3.5 w-3.5 animate-spin" />}
              </span>
            )}
            <RefreshCountdown
              onRefresh={() => refetch()}
              dataUpdatedAt={dataUpdatedAt}
            />
            {isFetching && !isLoadingTasks && (
              <span className="text-xs text-muted-foreground">Actualizando...</span>
            )}
          </div>
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Agregar tarea
            </Button>
          )}
        </div>

        {/* ── Task list ── */}
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              No hay tareas aún.
            </p>
          </div>
        ) : (
          <SortableList
            items={sortedTasks}
            onReorder={handleReorder}
            renderItem={(task, dragHandle) => {
              const taskType = task.task_type ?? "execution";
              const taskFlag = task.task_flag ?? "new";
              // Editability lock
              // Reordering and basic editing is now always allowed if the user has edit permissions
              const canEditThisTask = canEdit;
              const canEditAssigneeOnly = false; // We use canEditThisTask for everything now

              const isWaiting = task.status === "waiting";
              const isBlocked = task.status === "blocked";
              const isInProgress = task.status === "in_progress";
              const isNotStarted = task.status === "not_started";
              const isCompleted = task.status === "completed";
              const isValidation = taskType === "validation";
              const canComplete = (isInProgress || isNotStarted) && !isValidation && (isMyTask(task) || isAdmin);
              const canValidate = (isInProgress || isNotStarted) && isValidation && (isMyTask(task) || isAdmin);
              const needsQuote = task.requires_quote === 1 && isBlocked;

              return (
                <div
                  className={`flex items-start gap-3 rounded-md border bg-card p-3 transition-opacity ${
                    isWaiting ? "opacity-60" : ""
                  } ${isBlocked ? "border-destructive/50 bg-destructive/5" : ""}`}
                >
                  {canEdit && (
                    <div className="flex-shrink-0 pt-0.5">
                      {isCompleted ? (
                        <div className="p-1.5 opacity-20 grayscale cursor-not-allowed">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      ) : (
                        dragHandle
                      )}
                    </div>
                  )}
                  {(isWaiting || isBlocked) && (
                    <div className="flex-shrink-0 pt-1 pl-1">
                      {isBlocked ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Title + type/flag badges */}
                    <div className="flex items-center flex-wrap gap-2 mb-0.5">
                      <p className="font-semibold text-sm leading-snug">{task.title}</p>
                      <span className="text-muted-foreground/40 text-xs select-none">·</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${TASK_TYPE_CONFIG[taskType]?.className}`}
                      >
                        {isValidation ? (
                          <ShieldCheck className="h-3 w-3 mr-1" />
                        ) : null}
                        {TASK_TYPE_CONFIG[taskType]?.label}
                      </Badge>
                      {taskFlag !== "new" && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${TASK_FLAG_CONFIG[taskFlag]?.className}`}
                        >
                          {TASK_FLAG_CONFIG[taskFlag]?.label}
                        </Badge>
                      )}
                      {task.requires_quote === 1 && (
                        <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
                          Cotización
                        </Badge>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {/* Blocked reason */}
                    {isBlocked && needsQuote && (
                      <p className="text-xs text-destructive mt-1 font-medium">
                        Esperando cotización de externo
                      </p>
                    )}
                    {isBlocked && !needsQuote && (
                      <p className="text-xs text-destructive mt-1 font-medium">
                        Sin colaborador asignado
                      </p>
                    )}

                    {/* Area / user badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {task.area_name && (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            {task.area_name}
                          </Badge>
                          <span className="text-muted-foreground/40 text-xs select-none">·</span>
                        </>
                      )}
                      {task.assign_to_commercial === 1 && !task.assigned_user_name && (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50 dark:bg-blue-900/20">
                          Comercial del proyecto
                        </Badge>
                      )}
                      {task.assigned_user_name && (
                        <Badge variant="outline" className="text-xs">
                          {task.assigned_user_name}
                          {rolLabel(task.assigned_user_rol_id ?? null) && (
                            <span className="ml-1 text-muted-foreground">
                              ({rolLabel(task.assigned_user_rol_id ?? null)})
                            </span>
                          )}
                          {isMyTask(task) && (
                            <span className="ml-1 text-primary">(tú)</span>
                          )}
                        </Badge>
                      )}
                      {!task.assigned_user_name && task.assign_to_commercial !== 1 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Sin asignar
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Right: status + actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                           className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            TASK_STATUS_CONFIG[task.status]?.className ?? ""
                          }`}
                        >
                          {TASK_STATUS_CONFIG[task.status]?.icon}
                          {TASK_STATUS_CONFIG[task.status]?.label ?? task.status}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isWaiting
                          ? "Esta tarea está asignada pero esperando que termine la anterior"
                          : TASK_STATUS_CONFIG[task.status]?.label}
                      </TooltipContent>
                    </Tooltip>

                    {canComplete && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleCompleteTask(task)}
                        disabled={completingTaskId === task.id}
                      >
                        {completingTaskId === task.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                        Completar
                      </Button>
                    )}

                    {canValidate && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                        onClick={() => openValidateDialog(task)}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Validar
                      </Button>
                    )}

                    {(canEditThisTask || canEditAssigneeOnly) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(task)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEditThisTask && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará &quot;{task.title}&quot;. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}

        {/* ── Create / Edit Task Dialog ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {editingTask
                  ? editingAssigneeOnly
                    ? "Asignar colaborador"
                    : "Editar tarea"
                  : "Nueva tarea"}
              </DialogTitle>
            </DialogHeader>
            {editingAssigneeOnly && (
              <p className="text-xs text-muted-foreground -mt-1">
                Esta tarea está bloqueada. Solo puedes cambiar el colaborador asignado.
              </p>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Diseñar el contenido del email"
                          disabled={editingAssigneeOnly}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          disabled={editingAssigneeOnly}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!editingAssigneeOnly && (
                  <FormField
                    control={form.control}
                    name="task_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de tarea</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="execution">
                                <div className="flex flex-col items-start text-left">
                                  <span>Ejecución</span>
                                  <span className="text-xs text-muted-foreground whitespace-normal">El colaborador ejecuta y pasa automáticamente al siguiente paso</span>
                                </div>
                              </SelectItem>
                              <SelectItem
                                value="validation"
                                disabled={editingTask ? editingTask.order_index === 0 : tasks.length === 0}
                              >
                                <div className="flex flex-col items-start text-left">
                                  <span>Validación</span>
                                  <span className="text-xs text-muted-foreground whitespace-normal">Paso de control: puede aprobar o rechazar (regresar el flujo)</span>
                                  {(editingTask ? editingTask.order_index === 0 : tasks.length === 0) && (
                                    <span className="text-[10px] text-destructive mt-0.5">No disponible para la primera tarea</span>
                                  )}
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!editingAssigneeOnly && selectedTaskType === "execution" && (
                  <FormField
                    control={form.control}
                    name="requires_quote"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3 rounded-md border p-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) form.setValue("assigned_user_id", null);
                            }}
                          />
                        </FormControl>
                        <div className="space-y-0.5 -mt-1">
                          <FormLabel className="text-sm font-medium cursor-pointer">
                            Requiere cotización de externo
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            El flujo se bloqueará aquí hasta que un externo sea invitado a cotizar y la cotización sea aceptada.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                <div className="space-y-1">
                  <TaskAssignmentSelector
                    assignMode={assignMode}
                    onAssignModeChange={(mode) => {
                      form.setValue("assign_mode", mode);
                      form.clearErrors(["assigned_user_id", "area_id"]);
                    }}
                    areaId={areaId ?? null}
                    onAreaIdChange={(id) => {
                      form.setValue("area_id", id);
                      form.clearErrors("area_id");
                    }}
                    assignedUserId={form.watch("assigned_user_id") ?? null}
                    onAssignedUserIdChange={(id) => {
                      form.setValue("assigned_user_id", id);
                      if (id) form.clearErrors("assigned_user_id");
                    }}
                    requiresQuote={requiresQuote}
                    projectId={projectId}
                  />
                  {form.formState.errors.assigned_user_id && (
                    <p className="text-xs text-destructive font-medium px-1">
                      {form.formState.errors.assigned_user_id.message}
                    </p>
                  )}
                  {form.formState.errors.area_id && (
                    <p className="text-xs text-destructive font-medium px-1">
                      {form.formState.errors.area_id.message}
                    </p>
                  )}
                </div>

                {editingTask && !editingAssigneeOnly && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ?? "not_started"}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(TASK_STATUS_CONFIG) as ProjectTaskStatus[]).map((val) => (
                                <SelectItem key={val} value={val}>
                                  {TASK_STATUS_CONFIG[val].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingTask ? "Guardar cambios" : "Agregar tarea"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* ── Validate Dialog ── */}
        <TaskValidationDialog
          open={validateDialog.open}
          onOpenChange={(open) => {
            if (!open) setValidateDialog({ open: false, task: null });
          }}
          task={validateDialog.task}
          siblings={tasks}
          onSuccess={invalidateAll}
        />
      </>
    </TooltipProvider>
  );
}
