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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Pencil,
  Check,
  X,
  User,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileText,
  ListTodo,
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

// ─── Inline editable title ────────────────────────────────────────────────────

function InlineTitle({ taskId, value, autoFocus, onSave }: { taskId: number; value: string; autoFocus?: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(autoFocus ?? false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) { setDraft(value); setEditing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => { const t = draft.trim() || value; if (t !== value) onSave(t); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) return (
    <div className="flex items-center gap-1 flex-1">
      <Input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
        className="h-7 text-sm py-0 px-2" />
      <button type="button" onMouseDown={e => { e.preventDefault(); commit(); }} className="text-primary hover:text-primary/80 p-0.5"><Check className="h-3.5 w-3.5" /></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); cancel(); }} className="text-muted-foreground hover:text-destructive p-0.5"><X className="h-3.5 w-3.5" /></button>
    </div>
  );

  return (
    <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
      className="group flex items-center gap-1.5 text-left text-sm font-medium hover:text-primary transition-colors">
      {value}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </button>
  );
}

// ─── Assignee picker ──────────────────────────────────────────────────────────

function AssigneePicker({ task, users, onAssign }: {
  task: LocalTask; users: UserOption[];
  onAssign: (userId: number | null, userName: string | null, assignToCommercial?: number) => void;
}) {
  const currentValue = task.assigned_user_id ? task.assigned_user_id.toString() : task.assign_to_commercial === 1 ? "commercial" : "none";
  const admins = users.filter(u => u.rol_id === 1);
  const directivos = users.filter(u => u.rol_id === 2);
  const comerciales = users.filter(u => u.rol_id === 3);
  const internals = users.filter(u => u.rol_id === 4 && u.is_internal === 1);
  const externals = users.filter(u => u.rol_id === 4 && u.is_internal === 0);

  const renderGroup = (label: string, groupUsers: UserOption[]) => {
    if (groupUsers.length === 0) return null;
    return (
      <SelectGroup>
        <SelectLabel className="text-xs text-muted-foreground/60 font-normal py-1 px-2 uppercase tracking-wider">{label}</SelectLabel>
        {groupUsers.map(u => (
          <SelectItem key={u.id} value={u.id.toString()}>
            <span className="flex items-center gap-1.5">{u.name}{u.area_name && <span className="text-xs text-muted-foreground">· {u.area_name}</span>}</span>
          </SelectItem>
        ))}
      </SelectGroup>
    );
  };

  return (
    <Select value={currentValue} onValueChange={val => {
      if (val === "none") onAssign(null, null, 0);
      else if (val === "commercial") onAssign(null, null, 1);
      else { const u = users.find(u => u.id.toString() === val); onAssign(u?.id ?? null, u?.name ?? null, 0); }
    }}>
      <SelectTrigger className="h-7 text-xs w-auto min-w-[140px] max-w-[200px] gap-1 px-2">
        <User className="h-3 w-3 text-muted-foreground shrink-0" />
        <SelectValue><span className={!task.assigned_user_name ? "text-muted-foreground" : ""}>{task.assigned_user_name || "Sin asignar"}</span></SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none"><span className="text-xs">{task.area_name ? `Auto (${task.area_name})` : "Sin asignar"}</span></SelectItem>
        <SelectItem value="commercial"><span className="text-xs">Comercial del proyecto</span></SelectItem>
        <SelectSeparator />
        {renderGroup("Admin", admins)}
        {directivos.length > 0 && admins.length > 0 && <SelectSeparator />}
        {renderGroup("Directivo", directivos)}
        {comerciales.length > 0 && <SelectSeparator />}
        {renderGroup("Comercial", comerciales)}
        {internals.length > 0 && <SelectSeparator />}
        {renderGroup("Colaborador interno", internals)}
        {externals.length > 0 && <SelectSeparator />}
        {renderGroup("Colaborador externo", externals)}
      </SelectContent>
    </Select>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function AdjustmentWizard({ open, onOpenChange, productId, createdByName, onConfirm, isSubmitting }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [notes, setNotes] = useState("");

  const [localTasks, setLocalTasks] = useState<LocalTask[]>([]);
  const [newTaskId, setNewTaskId] = useState<number | null>(null);
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
      // Resolve the actual user for area-based auto-assign so we show the right name
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
      area_id: null, area_name: null, assigned_user_id: null, assigned_user_name: null,
      assign_to_commercial: 0, assign_mode: "auto",
      requires_quote: false, quoter_ids: [],
      order_index: localTasks.length, task_type: "execution",
    };
    setLocalTasks(prev => [...prev, task]);
    setNewTaskId(lid);
  };

  const handleRemoveTask = (task: LocalTask) => {
    // Simply remove from the local list — the final task list sent to the API omits it
    setLocalTasks(prev => prev.filter(t => t.id !== task.id).map((t, i) => ({ ...t, order_index: i })));
  };

  const handleSubmit = async () => {
    // Send the full ordered list — backend resolves auto-assignments server-side
    const tasks = localTasks.map(t => ({
      template_id: t.template_id ?? null,
      title: t.title,
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

              {loadingTemplates ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : localTasks.length > 0 ? (
                <SortableList
                  items={localTasks}
                  onReorder={handleReorder}
                  renderItem={(task, dragHandle) => (
                    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2.5">
                      <div className="flex-shrink-0">{dragHandle}</div>
                      <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-center">
                        {localTasks.findIndex(t => t.id === task.id) + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <InlineTitle
                          taskId={task.id}
                          value={task.title}
                          autoFocus={task.id === newTaskId}
                          onSave={v => { updateTask(task.id, { title: v }); if (task.id === newTaskId) setNewTaskId(null); }}
                        />
                        {task.area_name && <Badge variant="secondary" className="text-xs mt-0.5">{task.area_name}</Badge>}
                        {task.isExtra && <Badge variant="outline" className="text-xs mt-0.5 text-muted-foreground">Nueva</Badge>}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <AssigneePicker
                          task={task}
                          users={users}
                          onAssign={(userId, userName, atc) => {
                            let name = userName;
                            if (!userId) {
                              if (atc === 1) name = createdByName || "Comercial del proyecto";
                              else if (task.area_id) name = users.find(u => u.area_id === task.area_id && u.rol_id === 4 && u.is_internal === 1)?.name ?? null;
                            }
                            updateTask(task.id, { assigned_user_id: userId, assigned_user_name: name, assign_to_commercial: atc ?? task.assign_to_commercial });
                          }}
                        />
                        <Select value={task.task_type} onValueChange={v => updateTask(task.id, { task_type: v as "execution" | "validation" })}>
                          <SelectTrigger className="h-7 text-xs w-[100px] gap-1 px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="execution">Ejecución</SelectItem>
                            <SelectItem value="validation" disabled={localTasks.findIndex(t => t.id === task.id) === 0}>Validación</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" type="button" onClick={() => handleRemoveTask(task)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
                  <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No hay tareas. Agrega tareas personalizadas.</p>
                </div>
              )}

              <Button variant="outline" size="sm" type="button" onClick={handleAddTask} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Agregar tarea
              </Button>
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
    </Dialog>
  );
}
