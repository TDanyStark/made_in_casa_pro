"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProductTaskTemplateType, UserRole } from "@/lib/definitions";
import { SortableList } from "@/components/ui/sortable-list";
import { TaskAssignmentSelector, AssignMode } from "@/components/tasks/TaskAssignmentSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  User,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileText,
  ListTodo,
  Clock,
  ShieldCheck,
} from "lucide-react";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(
  () => import("@/components/clients/RichTextEditor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="h-40 w-full animate-pulse bg-muted rounded-md" /> }
);

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
  id: number;
  template_id: number | null;
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  productId: number | null;
  createdByName?: string | null;
  userRole: UserRole;
  onConfirm: (data: {
    notes: string;
    tasks: { 
      template_id?: number | null; 
      title: string; 
      description: string;
      assigned_user_id?: number | null; 
      assign_to_commercial?: number; 
      area_id?: number | null; 
      task_type?: string;
      requires_quote?: number;
      quoter_ids?: number[];
    }[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

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
  projectId: number;
  onSave: (taskId: number, changes: Partial<LocalTask>) => void;
  users: UserOption[];
  createdByName?: string | null;
}

function TaskSettingsDialog({ open, onOpenChange, task, projectId, onSave, users, createdByName }: TaskSettingsDialogProps) {
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
              id="requires_quote_wizard"
              checked={task.requires_quote}
              onCheckedChange={(checked) => resolveAndSave({ 
                requires_quote: !!checked, 
                assigned_user_id: checked ? null : task.assigned_user_id,
                assign_mode: checked ? "auto" : task.assign_mode
              })}
            />
            <div className="space-y-1 -mt-1">
              <label htmlFor="requires_quote_wizard" className="text-sm font-medium leading-none cursor-pointer">
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
              projectId={projectId}
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

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function AdjustmentWizard({ 
  open, 
  onOpenChange, 
  projectId, 
  productId, 
  createdByName, 
  onConfirm, 
  isSubmitting 
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [notes, setNotes] = useState("");

  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const [taskToEdit, setTaskToEdit] = useState<LocalTask | null>(null);
  const nextLocalId = useRef(-1);
  const initialized = useRef(false);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setNotes("");
      setLocalTasks([]);
      initialized.current = false;
    }
  }, [open]);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<ProductTaskTemplateType[]>({
    queryKey: ["product-task-templates", productId],
    queryFn: async () => {
      if (!productId) return [];
      const res = await get<ProductTaskTemplateType[]>(`products/${productId}/tasks`);
      return res.ok ? (res.data ?? []) : [];
    },
    enabled: !!productId && open,
    staleTime: 1000 * 60 * 5,
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["all-users-for-wizard-tasks"],
    queryFn: async () => {
      const res = await get<UserOption[]>(`collaborators?all_users=1`);
      return res.ok ? (res.data ?? []) : [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: open,
  });

  // Initialize tasks from templates when moving to step 2
  useEffect(() => {
    if (step !== 2 || initialized.current) return;
    if (users.length === 0) return;
    initialized.current = true;

    const getResolvedName = (task: Partial<LocalTask>): string | null => {
      if (task.assigned_user_id) return users.find(u => u.id === task.assigned_user_id)?.name ?? null;
      if (task.assign_to_commercial === 1) return createdByName || "Comercial del proyecto";
      if (task.area_id) {
        const u = users.find(u => u.area_id === task.area_id && u.rol_id === 4 && u.is_internal === 1);
        return u?.name ?? null;
      }
      return null;
    };

    const rows: LocalTask[] = templates.map(t => {
      let resolvedUserId = t.assigned_user_id;
      if (!resolvedUserId && Number(t.assign_to_commercial) !== 1 && t.area_id) {
        const areaUser = users.find(u => u.area_id === t.area_id && u.rol_id === 4 && u.is_internal === 1);
        resolvedUserId = areaUser?.id ?? null;
      }
      return {
        id: t.id,
        template_id: t.id,
        isExtra: false,
        title: t.title,
        description: t.description || "",
        area_id: t.area_id,
        area_name: t.area_name,
        assigned_user_id: resolvedUserId,
        assigned_user_name: getResolvedName({ assigned_user_id: resolvedUserId, assign_to_commercial: t.assign_to_commercial, area_id: t.area_id }),
        assign_to_commercial: t.assign_to_commercial,
        assign_mode: deriveAssignMode({ assigned_user_id: resolvedUserId, assign_to_commercial: t.assign_to_commercial }),
        requires_quote: t.requires_quote === 1,
        quoter_ids: t.quoters?.map(q => q.user_id) ?? [],
        order_index: t.order_index,
        task_type: t.task_type,
      };
    });

    setLocalTasks(rows.sort((a, b) => a.order_index - b.order_index));
  }, [step, templates, users, createdByName]);

  const updateTask = (taskId: number, changes: Partial<LocalTask>) =>
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...changes } : t));

  const handleReorder = (reordered: LocalTask[]) =>
    setLocalTasks(reordered.map((t, i) => ({ ...t, order_index: i })));

  const handleAddTask = () => {
    const lid = nextLocalId.current--;
    const task: LocalTask = {
      id: lid, template_id: null, isExtra: true, title: "Nueva tarea",
      description: "",
      area_id: null, area_name: null, assigned_user_id: null, assigned_user_name: null,
      assign_to_commercial: 0, assign_mode: "auto",
      requires_quote: false, quoter_ids: [],
      order_index: localTasks.length, task_type: "execution",
    };
    setLocalTasks(prev => [...prev, task]);
    setTaskToEdit(task);
  };

  const handleRemoveTask = (task: LocalTask) => {
    setLocalTasks(prev => prev.filter(t => t.id !== task.id).map((t, i) => ({ ...t, order_index: i })));
  };

  const handleSubmit = async () => {
    const tasks = localTasks.map(t => ({
      template_id: t.template_id ?? null,
      title: t.title,
      description: t.description,
      assigned_user_id: t.assigned_user_id,
      assign_to_commercial: t.assign_to_commercial,
      area_id: t.area_id,
      task_type: t.task_type,
      requires_quote: t.requires_quote ? 1 : 0,
      quoter_ids: t.quoter_ids,
    }));

    await onConfirm({ notes, tasks });
  };

  const STEPS = [
    { label: "Notas del ajuste", icon: FileText },
    { label: "Tareas", icon: ListTodo },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Nuevo Ajuste</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              const Icon = s.icon;
              return (
                <div key={n} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${active ? "bg-primary text-primary-foreground" : done ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Step 1: Notes ── */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Describe los cambios o correcciones que se incluyen en este ajuste. Esta nota quedará registrada en el historial de versiones.
              </p>
              <div className="min-h-[280px]">
                <RichTextEditor
                  value={notes}
                  onChange={setNotes}
                  placeholder="Ej: El cliente solicitó cambiar los colores del banner y agregar el logo en la versión mobile..."
                  expandable={false}
                  title="Notas del ajuste"
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Tasks ── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Revisa las tareas para este ajuste. Puedes reordenarlas, cambiar responsables, agregar o eliminar tareas.
              </p>

              <div className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
                  <div>
                    <h3 className="text-base font-semibold text-primary/80">Ajuste de tareas</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="text-amber-600 dark:text-amber-400 font-medium italic">Nueva iteración</span>
                      <span>•</span>
                      <span>Total: {localTasks.length} tareas</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddTask} className="h-8">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Agregar tarea
                  </Button>
                </div>

                <div className="p-4 space-y-4">
                  {loadingTemplates ? (
                    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : localTasks.length > 0 ? (
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
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
                      <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No hay tareas. Agrega tareas personalizadas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex justify-between items-center p-6 pt-4 border-t bg-muted/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => step === 1 ? onOpenChange(false) : setStep(1)}
            disabled={isSubmitting}
          >
            {step === 1 ? "Cancelar" : <><ChevronLeft className="h-4 w-4 mr-1" />Atrás</>}
          </Button>

          {step === 1 ? (
            <Button type="button" onClick={() => setStep(2)}>
              Siguiente — Tareas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="min-w-[140px]">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSubmitting ? "Creando ajuste..." : "Crear Ajuste"}
            </Button>
          )}
        </div>
      </DialogContent>
      <TaskSettingsDialog
        open={!!taskToEdit}
        onOpenChange={(open) => !open && setTaskToEdit(null)}
        task={taskToEdit}
        projectId={projectId}
        onSave={(taskId, changes) => {
          updateTask(taskId, changes);
          if (taskToEdit?.id === taskId) {
            setTaskToEdit((prev) => (prev ? { ...prev, ...changes } : null));
          }
        }}
        users={users}
        createdByName={createdByName}
      />
    </Dialog>
  );
}
