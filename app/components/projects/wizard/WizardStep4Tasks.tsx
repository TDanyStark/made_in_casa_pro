"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProductTaskTemplateType } from "@/lib/definitions";
import { SortableList } from "@/components/ui/sortable-list";
import { TaskAssignmentSelector, AssignMode } from "@/components/tasks/TaskAssignmentSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Pencil,
  Plus,
  Trash2,
  ChevronDown,
  Clock,
  ShieldCheck,
  User,
} from "lucide-react";
import { WizardState, TaskOverride, ExtraTask } from "@/hooks/useProjectWizard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserOption {
  id: number;
  name: string;
  rol_id: number;
  is_internal: number;
  area_id: number | null;
  area_name: string | null;
  active_task_count: number;
}

interface LocalTask {
  id: number;           // for template tasks: template_id; for extra tasks: negative localId
  template_id: number | null;  // null for extra tasks
  isExtra: boolean;
  title: string;
  description: string;
  area_id: number | null;
  area_name: string | null;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assign_to_commercial: number;
  assign_mode: AssignMode;
  requires_quote: boolean;
  quoter_ids: number[];
  order_index: number;
  task_type: "execution" | "validation";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveAssignMode(task: Partial<LocalTask>): AssignMode {
  if (task.assign_to_commercial === 1) return "commercial";
  if (task.assigned_user_id !== null) return "specific";
  return "auto";
}

// ─── Task Settings Dialog ─────────────────────────────────────────────────────

interface TaskSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: LocalTask | null;
  onSave: (taskId: number, changes: Partial<LocalTask>) => void;
  users: UserOption[];
  createdByName?: string | null;
}

function TaskSettingsDialog({ open, onOpenChange, task, onSave, users, createdByName }: TaskSettingsDialogProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftType, setDraftType] = useState<"execution" | "validation">("execution");

  useEffect(() => {
    if (task) {
      setDraftTitle(task.title);
      setDraftDescription(task.description || "");
      setDraftType(task.task_type);
    }
  }, [task, open]);

  if (!task) return null;

  const handleDone = () => {
    onSave(task.id, {
      title: draftTitle,
      description: draftDescription,
      task_type: draftType,
    });
    onOpenChange(false);
  };

  const resolveAndSave = (changes: Partial<LocalTask>) => {
    const nextTask = { ...task, ...changes };
    let resolvedName = nextTask.assigned_user_name;

    if (changes.assign_mode || changes.area_id !== undefined || changes.assigned_user_id !== undefined || changes.requires_quote !== undefined) {
      if (nextTask.requires_quote) {
        resolvedName = null;
      } else if (nextTask.assign_mode === "specific" && nextTask.assigned_user_id) {
        resolvedName = users.find(u => u.id === nextTask.assigned_user_id)?.name ?? null;
      } else if (nextTask.assign_mode === "commercial") {
        resolvedName = createdByName || "Comercial del proyecto";
      } else if (nextTask.assign_mode === "auto" && nextTask.area_id) {
        const u = users.find(u => u.area_id === nextTask.area_id && u.rol_id === 4 && u.is_internal === 1);
        resolvedName = u?.name ?? null;
      } else {
        resolvedName = null;
      }
    }

    onSave(task.id, { ...changes, assigned_user_name: resolvedName });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar tarea</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Título de la tarea"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción (opcional)</label>
            <Input
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Añade detalles sobre esta tarea..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de tarea</label>
            <Select 
              value={draftType} 
              onValueChange={(v) => setDraftType(v as "execution" | "validation")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="execution">Ejecución</SelectItem>
                <SelectItem value="validation">Validación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="requires_quote"
              checked={task.requires_quote}
              onCheckedChange={(checked) => resolveAndSave({ 
                requires_quote: !!checked, 
                assigned_user_id: checked ? null : task.assigned_user_id,
                assign_mode: checked ? "auto" : task.assign_mode
              })}
            />
            <div className="space-y-1 -mt-1">
              <label htmlFor="requires_quote" className="text-sm font-medium leading-none cursor-pointer">
                Requiere cotización de externo
              </label>
              <p className="text-xs text-muted-foreground">
                El flujo se bloqueará hasta que un externo presente su propuesta y sea aceptada.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <TaskAssignmentSelector
              assignMode={task.assign_mode}
              onAssignModeChange={(mode) => resolveAndSave({ assign_mode: mode })}
              areaId={task.area_id}
              onAreaIdChange={(id) => resolveAndSave({ 
                area_id: id, 
                area_name: users.find(u => u.area_id === id)?.area_name ?? null 
              })}
              assignedUserId={task.assigned_user_id}
              onAssignedUserIdChange={(id) => resolveAndSave({ assigned_user_id: id })}
              quoterIds={task.quoter_ids}
              onQuoterIdsChange={(ids) => resolveAndSave({ quoter_ids: ids })}
              requiresQuote={task.requires_quote}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={handleDone}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ─── Main component ───────────────────────────────────────────────────────────

export function WizardStep4Tasks({ state, onNext, onBack, update }: Props) {
  const productId = state.product?.id ?? null;

  // Fetch task templates
  const { data: templates = [], isLoading } = useQuery<ProductTaskTemplateType[]>({
    queryKey: ["product-task-templates", productId],
    queryFn: async () => {
      if (!productId) return [];
      const res = await get<ProductTaskTemplateType[]>(`products/${productId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch all users
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["all-users-for-wizard-tasks"],
    queryFn: async () => {
      const res = await get<UserOption[]>(`collaborators?all_users=1`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const [removedTemplateIds, setRemovedTemplateIds] = useState<number[]>([]);
  const [taskToEdit, setTaskToEdit] = useState<LocalTask | null>(null);

  const nextLocalId = useRef<number>(-1);
  const initialized = useRef(false);

  useEffect(() => {
    if (templates.length === 0 && (state.extra_tasks?.length ?? 0) === 0) {
      initialized.current = false;
      setLocalTasks([]);
      return;
    }

    if (initialized.current) return;
    if (users.length === 0) return;
    initialized.current = true;

    const removedIds = state.removed_template_ids ?? [];
    setRemovedTemplateIds(removedIds);

    const getResolvedAssignee = (task: Partial<LocalTask>) => {
      if (task.assigned_user_id) {
        const u = users.find((u) => u.id === task.assigned_user_id);
        return { id: u?.id ?? null, name: u?.name ?? null };
      }
      if (task.assign_to_commercial === 1) {
        return { id: null, name: state.created_by_name || "Comercial del proyecto" };
      }
      if (task.area_id) {
        const areaUser = users.find(u => u.area_id === task.area_id && u.rol_id === 4 && u.is_internal === 1);
        return { id: areaUser?.id ?? null, name: areaUser?.name ?? null };
      }
      return { id: null, name: null };
    };

    const templateTasks: LocalTask[] = templates
      .filter((t) => !removedIds.includes(t.id))
      .map((t) => {
        const existing = state.task_overrides.find((o) => o.template_id === t.id);
        const resolvedUserId = existing?.assigned_user_id !== undefined ? existing.assigned_user_id : t.assigned_user_id;
        const assignToComm = existing?.assign_to_commercial !== undefined ? existing.assign_to_commercial : t.assign_to_commercial;

        const { id: finalId, name: resolvedUserName } = getResolvedAssignee({
          assigned_user_id: resolvedUserId,
          assign_to_commercial: assignToComm,
          area_id: t.area_id
        });

        return {
          id: t.id,
          template_id: t.id,
          isExtra: false,
          title: existing?.title ?? t.title,
          description: t.description || "",
          area_id: t.area_id,
          area_name: t.area_name,
          assigned_user_id: finalId,
          assigned_user_name: resolvedUserName,
          assign_to_commercial: assignToComm,
          assign_mode: deriveAssignMode({ assigned_user_id: finalId, assign_to_commercial: assignToComm }),
          requires_quote: t.requires_quote === 1,
          quoter_ids: t.quoters?.map(q => q.user_id) ?? [],
          order_index: existing?.order_index ?? t.order_index,
          task_type: existing?.task_type ?? t.task_type,
        };
      });

    const extraRows: LocalTask[] = (state.extra_tasks ?? []).map((e) => {
      const { id: finalId, name: resolvedUserName } = getResolvedAssignee({
        assigned_user_id: e.assigned_user_id,
        assign_to_commercial: e.assign_to_commercial,
        area_id: e.area_id
      });

      return {
        id: e.localId,
        template_id: null,
        isExtra: true,
        title: e.title,
        description: "",
        area_id: e.area_id,
        area_name: null,
        assigned_user_id: finalId,
        assigned_user_name: resolvedUserName,
        assign_to_commercial: e.assign_to_commercial ?? 0,
        assign_mode: deriveAssignMode({ assigned_user_id: finalId, assign_to_commercial: e.assign_to_commercial }),
        requires_quote: false,
        quoter_ids: [],
        order_index: e.order_index,
        task_type: e.task_type,
      };
    });

    setLocalTasks([...templateTasks, ...extraRows].sort((a, b) => a.order_index - b.order_index));
  }, [templates, users, state, state.task_overrides, state.extra_tasks, state.removed_template_ids]);

  const syncWizardState = (tasks: LocalTask[], removedIds: number[]) => {
    const task_overrides: TaskOverride[] = tasks
      .filter((t) => t.template_id !== null)
      .map((t) => ({
        template_id: t.template_id!,
        title: t.title,
        assigned_user_id: t.assigned_user_id,
        assign_to_commercial: t.assign_to_commercial,
        order_index: tasks.indexOf(t),
        task_type: t.task_type,
      }));

    const extra_tasks: ExtraTask[] = tasks
      .filter((t) => t.isExtra)
      .map((t) => ({
        localId: t.id,
        title: t.title,
        assigned_user_id: t.assigned_user_id,
        assign_to_commercial: t.assign_to_commercial,
        area_id: t.area_id,
        task_type: t.task_type,
        order_index: tasks.indexOf(t),
      }));

    update({ task_overrides, extra_tasks, removed_template_ids: removedIds });
  };

  const updateTask = (taskId: number, changes: Partial<LocalTask>) => {
    setLocalTasks((prev) => {
      const updated = prev.map((t) => (t.id === taskId ? { ...t, ...changes } : t));
      syncWizardState(updated, removedTemplateIds);
      return updated;
    });
  };

  const handleReorder = (reordered: LocalTask[]) => {
    const updated = reordered.map((t, idx) => ({ ...t, order_index: idx }));
    setLocalTasks(updated);
    syncWizardState(updated, removedTemplateIds);
  };

  const handleAddTask = () => {
    const localId = nextLocalId.current--;
    const newTask: LocalTask = {
      id: localId,
      template_id: null,
      isExtra: true,
      title: "Nueva tarea",
      description: "",
      area_id: null,
      area_name: null,
      assigned_user_id: null,
      assigned_user_name: null,
      assign_to_commercial: 0,
      assign_mode: "auto",
      requires_quote: false,
      quoter_ids: [],
      order_index: localTasks.length,
      task_type: "execution",
    };
    const updated = [...localTasks, newTask];
    setLocalTasks(updated);
    setTaskToEdit(newTask);
    syncWizardState(updated, removedTemplateIds);
  };

  const handleRemoveTask = (task: LocalTask) => {
    const updated = localTasks
      .filter((t) => t.id !== task.id)
      .map((t, idx) => ({ ...t, order_index: idx }));

    let updatedRemovedIds = removedTemplateIds;
    if (task.template_id !== null) {
      updatedRemovedIds = [...removedTemplateIds, task.template_id];
      setRemovedTemplateIds(updatedRemovedIds);
    }

    setLocalTasks(updated);
    syncWizardState(updated, updatedRemovedIds);
  };

  if (!productId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Selecciona un producto en el paso anterior</p>
        </div>
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack}>Atrás</Button>
          <Button type="button" onClick={() => onNext({})}>Siguiente</Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Tareas del proyecto</h2>
        <p className="text-sm text-muted-foreground">
          Revisa y ajusta las tareas para <span className="font-medium text-foreground">{state.product?.name}</span>.
        </p>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
          <div>
            <h3 className="text-base font-semibold text-primary/80">Versión 1 (Original)</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="text-amber-600 dark:text-amber-400 font-medium italic">Se creará con el proyecto</span>
              <span>•</span>
              <span>Total: {localTasks.length} tareas</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" onClick={handleAddTask} className="h-8">
               <Plus className="h-3.5 w-3.5 mr-1.5" />
               Agregar tarea
             </Button>
             <div className="p-1 text-muted-foreground">
               <ChevronDown className="h-5 w-5" />
             </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {localTasks.length === 0 ? (
            <div className="text-center py-8 border rounded-lg border-dashed">
              <p className="text-sm text-muted-foreground">No hay tareas definidas.</p>
            </div>
          ) : (
            <SortableList
              items={localTasks}
              onReorder={handleReorder}
              renderItem={(task, dragHandle) => {
                const isValidation = task.task_type === "validation";
                return (
                  <div className="flex items-start gap-3 rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex-shrink-0 pt-0.5">{dragHandle}</div>
                    
                    <div className="flex-shrink-0 pt-1 pl-1">
                      <Clock className="h-4 w-4 text-muted-foreground/50" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-0.5">
                        <p className="font-semibold text-sm leading-snug">{task.title}</p>
                        <span className="text-muted-foreground/40 text-xs select-none">·</span>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${isValidation ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          {isValidation && <ShieldCheck className="h-2.5 w-2.5 mr-1" />}
                          {isValidation ? "Validación" : "Ejecución"}
                        </Badge>
                        {task.requires_quote && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-700 border-amber-400 bg-amber-50">
                            Cotización requerida
                          </Badge>
                        )}
                        {task.isExtra && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-700 border-emerald-400 bg-emerald-50">
                            Nueva
                          </Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {task.area_name && (
                          <>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase font-semibold tracking-wider">
                              {task.area_name}
                            </Badge>
                            <span className="text-muted-foreground/40 text-xs select-none">·</span>
                          </>
                        )}
                        {task.assigned_user_name ? (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 flex items-center gap-1">
                            <User className="h-2.5 w-2.5" />
                            {task.assigned_user_name}
                            {task.assign_mode === "auto" && <span className="text-[9px] opacity-60 ml-0.5 italic">(auto)</span>}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground border-dashed">
                             Sin asignar
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                        En espera
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setTaskToEdit(task)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveTask(task)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>Atrás</Button>
        <Button type="button" onClick={() => onNext({})}>Siguiente</Button>
      </div>

      <TaskSettingsDialog
        open={!!taskToEdit}
        onOpenChange={(open) => !open && setTaskToEdit(null)}
        task={taskToEdit}
        onSave={updateTask}
        users={users}
        createdByName={state.created_by_name}
      />
    </div>
  );
}

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
  update: (data: Partial<WizardState>) => void;
}
